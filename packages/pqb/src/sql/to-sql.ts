import { Query, QueryInternal } from '../query/query';
import { QueryData } from './data';
import {
  addValue,
  DelayedRelationSelect,
  HasCteHooks,
  isExpression,
  MoreThanOneRowError,
  Sql,
  TableHook,
} from '../core';
import { QueryBuilder } from '../query/db';
import {
  addWithToSql,
  ctesToSql,
  moveMutativeQueryToCte,
  TopCTE,
} from '../query/cte/cte.sql';
import { SubQueryForSql } from '../query/to-sql/sub-query-for-sql';
import { pushTruncateSql } from './truncate';
import { pushColumnInfoSql } from './columnInfo';
import { makeInsertSql } from './insert';
import { pushUpdateSql } from './update';
import { pushDeleteSql } from './delete';
import { pushCopySql } from './copy';
import { RunAfterQuery } from '../core/query/query';
import { _clone } from '../query';
import { moveMutativeQueryToCteBase } from '../query/cte/move-mutative-query-to-cte-base.sql';
import { _queryWhereNotExists } from '../queryMethods';
import { pushDistinctSql } from './distinct';
import { setSqlCtxSelectList } from './select';
import { pushFromAndAs } from './fromAndAs';
import { pushJoinSql } from './join';
import { JoinItem } from './types';
import { pushWhereStatementSql } from './where';
import { columnToSql, makeRowToJson } from './common';
import { pushHavingSql } from './having';
import { windowToSql } from './window';
import { pushOrderBySql } from './orderBy';
import { pushLimitSQL } from './limit';
import { addTableHook } from '../query/hooks/hooks.sql';

interface ToSqlOptionsInternal {
  values?: unknown[];
  hasNonSelect?: boolean;
  // selected value in JOIN LATERAL will have an alias to reference it from SELECT
  aliasValue?: true;
  // for insert batching logic: skip a batch check when is inside a WITH subquery
  skipBatchCheck?: true;
  selectedCount?: number;
  selectList?: string[];
}

export interface TopToSqlCtx extends ToSqlOptionsInternal, HasCteHooks {
  topCtx: TopToSqlCtx;
  topCTE?: TopCTE;
  values: unknown[];
  tableHook?: TableHook;
  delayedRelationSelect?: DelayedRelationSelect;
  cteHookTopNullSelectAppended?: boolean;
}

export interface ToSQLCtx extends ToSqlOptionsInternal {
  topCtx: TopToSqlCtx;
  qb: QueryBuilder;
  q: QueryData;
  sql: string[];
  values: unknown[];
  selectedCount: number;
  cteSqls?: string[];
  cteName?: string;
}

export interface ToSQLQuery {
  __isQuery: Query['__isQuery'];
  q: Query['q'];
  qb: Query['qb'];
  table?: Query['table'];
  internal: QueryInternal;
  relations: Query['relations'];
  withData: Query['withData'];
  clone: Query['clone'];
  baseQuery: Query['baseQuery'];
  meta: Query['meta'];
  returnType: Query['returnType'];
  result: Query['result'];
  shape: Query['shape'];
}

export const toSql = (
  table: ToSQLQuery,
  type: QueryData['type'],
  topCtx?: TopToSqlCtx,
  isSubSql?: boolean,
  cteName?: string,
): Sql => {
  const query = table.q;
  const sql: string[] = [];
  const values = topCtx?.values || [];
  const ctx: ToSQLCtx = {
    topCtx: topCtx!,
    qb: table.qb,
    q: query,
    sql,
    values,
    aliasValue: topCtx?.aliasValue,
    skipBatchCheck: topCtx?.skipBatchCheck,
    hasNonSelect: topCtx?.hasNonSelect,
    selectedCount: 0,
    cteName,
  };

  if (topCtx) {
    if (type) topCtx.hasNonSelect = true;
  } else if (!topCtx) {
    ctx.topCtx = ctx as TopToSqlCtx;
  }

  const cteSqls = query.with && ctesToSql(ctx.topCtx, query.with);

  let result: Sql;

  let selectKeywordPos: number | undefined;

  let fromQuery: SubQueryForSql | undefined;

  if (type && type !== 'upsert') {
    const tableName = table.table ?? query.as;
    if (!tableName) throw new Error(`Table is missing for ${type}`);

    if (type === 'truncate') {
      pushTruncateSql(ctx, tableName, query);
      result = { text: sql.join(' '), values };
    } else if (type === 'columnInfo') {
      pushColumnInfoSql(ctx, table, query);
      result = { text: sql.join(' '), values };
    } else {
      const quotedAs = `"${query.as || tableName}"`;

      if (type === 'insert') {
        result = makeInsertSql(ctx, table, query, `"${tableName}"`, isSubSql);
      } else if (type === 'update') {
        result = pushUpdateSql(ctx, table, query, quotedAs, isSubSql);
      } else if (type === 'delete') {
        result = pushDeleteSql(ctx, table, query, quotedAs, isSubSql);
      } else if (type === 'copy') {
        pushCopySql(ctx, table, query, quotedAs);
        result = { text: sql.join(' '), values };
      } else {
        throw new Error(`Unsupported query type ${type}`);
      }
    }
  } else {
    let selectSqlPos: number | undefined;
    let runAfterQuery: RunAfterQuery | undefined;
    let skipSelect: boolean | undefined;
    if (type === 'upsert') {
      if (isSubSql || query.upsertSecond) {
        skipSelect = true;

        const upsertOrCreate = _clone(table as Query);
        const { as, makeSql: makeFirstSql } = moveMutativeQueryToCteBase(
          ctx,
          upsertOrCreate as unknown as SubQueryForSql,
          query.upsertUpdate ? 'u' : 'f',
          query.upsertUpdate && query.updateData ? 'update' : null,
        );

        upsertOrCreate.q.and =
          upsertOrCreate.q.or =
          upsertOrCreate.q.scopes =
            undefined;

        _queryWhereNotExists(
          upsertOrCreate,
          upsertOrCreate.baseQuery.from(as),
          [],
        );

        const { makeSql: makeSecondSql } = moveMutativeQueryToCteBase(
          ctx,
          upsertOrCreate as unknown as SubQueryForSql,
          'c',
          'insert',
        );

        sql.push(makeFirstSql(isSubSql), 'UNION ALL', makeSecondSql(isSubSql));
      } else {
        const second = _clone(table);
        second.q.upsertSecond = true;
        // let's call before hooks only once for upsert
        second.q.before = undefined;
        runAfterQuery = (queryResult) => {
          if (queryResult.rowCount) {
            second.q.upsertSecond = undefined;
            if (queryResult.rowCount > 1) {
              throw new MoreThanOneRowError(
                second,
                `Only one row was expected to find, found ${queryResult.rowCount} rows.`,
              );
            }
            return;
          }

          return second
            .then((result) => ({ result }))
            .finally(() => {
              second.q.upsertSecond = undefined;
            });
        };

        if (query.updateData) {
          const result = toSql(table, 'update', topCtx, isSubSql);
          if ('text' in result) {
            result.runAfterQuery = runAfterQuery;
          }
          return result;
        }
      }
    }

    const quotedAs =
      (query.as || table.table) && `"${query.as || table.table}"`;

    if (query.union) {
      const { b } = query.union;
      const s = moveMutativeQueryToCte(ctx, b);
      sql.push(query.union.p ? s : `(${s})`);

      for (const u of query.union.u) {
        const s = isExpression(u.a)
          ? u.a.toSQL(ctx, quotedAs)
          : moveMutativeQueryToCte(ctx, u.a);
        sql.push(`${u.k} ${u.p ? s : '(' + s + ')'}`);
      }
    } else if (!skipSelect) {
      selectKeywordPos = sql.length;
      sql.push('SELECT');

      if (query.distinct) {
        pushDistinctSql(ctx, table, query.distinct, quotedAs);
      }

      selectSqlPos = sql.length - 1;

      const aliases = query.group ? [] : undefined;
      setSqlCtxSelectList(ctx, table, query, quotedAs, isSubSql, aliases);

      fromQuery =
        ((table.table || query.from) &&
          pushFromAndAs(ctx, table, query, quotedAs)) ||
        undefined;

      if (query.join) {
        pushJoinSql(
          ctx,
          table,
          query as QueryData & { join: JoinItem[] },
          quotedAs,
        );
      }

      if (query.and || query.or || query.scopes) {
        pushWhereStatementSql(ctx, table, query, quotedAs);
      }

      if (query.group) {
        const group = query.group.map((item) => {
          if (isExpression(item)) {
            return item.toSQL(ctx, quotedAs);
          } else {
            const i = (aliases as string[]).indexOf(item as string);
            return i !== -1
              ? i + 1
              : columnToSql(
                  ctx,
                  table.q,
                  table.shape,
                  item as string,
                  quotedAs,
                );
          }
        });
        sql.push(`GROUP BY ${group.join(', ')}`);
      }

      if (query.having) pushHavingSql(ctx, query, quotedAs);

      if (query.window) {
        const window: string[] = [];
        for (const item of query.window) {
          for (const key in item) {
            window.push(
              `"${key}" AS ${windowToSql(ctx, query, item[key], quotedAs)}`,
            );
          }
        }
        sql.push(`WINDOW ${window.join(', ')}`);
      }
    }

    if (query.order) {
      pushOrderBySql(ctx, query, quotedAs, query.order);
    }

    if (query.useFromLimitOffset) {
      const q = fromQuery?.q as QueryData;
      if (q.limit) {
        sql.push(`LIMIT ${addValue(values, q.limit)}`);
      }
      if (q.offset) {
        sql.push(`OFFSET ${addValue(values, q.offset)}`);
      }
    } else {
      pushLimitSQL(sql, values, query);

      if (query.offset && !query.returnsOne) {
        sql.push(`OFFSET ${addValue(values, query.offset)}`);
      }
    }

    if (query.for) {
      sql.push('FOR', query.for.type);
      const { tableNames } = query.for;
      if (tableNames) {
        sql.push(
          'OF',
          isExpression(tableNames)
            ? tableNames.toSQL(ctx, quotedAs)
            : tableNames.map((x) => `"${x}"`).join(', '),
        );
      }
      if (query.for.mode) sql.push(query.for.mode);
    }

    addTableHook(ctx, table, query, query.hookSelect);

    // compose select in the last moment because NULL for CTE selects
    // can be added by sub queries added in where or in other places
    if (selectSqlPos !== undefined && ctx.selectList?.length) {
      sql[selectSqlPos] += ' ' + ctx.selectList.join(', ');
    }

    if (selectKeywordPos !== undefined && !isSubSql && ctx.topCtx.cteHooks) {
      sql[selectKeywordPos] = '(' + sql[selectKeywordPos];
    }

    result = {
      text: sql.join(' '),
      values,
      runAfterQuery,
    };
  }

  if (!ctx.cteName) {
    result.tableHook = ctx.topCtx.tableHook;
    if (!topCtx) {
      result.delayedRelationSelect = ctx.topCtx.delayedRelationSelect;
    }
  }

  if (!isSubSql && ctx.topCtx.cteHooks && 'text' in result) {
    result.cteHooks = ctx.topCtx.cteHooks;

    if (ctx.topCtx.cteHooks.hasSelect) {
      if (selectKeywordPos !== undefined) {
        result.text += ')';
      }

      result.text += ` UNION ALL SELECT ${'NULL, '.repeat(
        ctx.selectedCount || 0,
      )}json_build_object(${Object.entries(ctx.topCtx.cteHooks.tableHooks)
        .map(
          ([cteName, data]) =>
            `'${cteName}', (SELECT json_agg(${makeRowToJson(
              cteName,
              data.shape,
              false,
              true,
            )}) FROM "${cteName}")`,
        )
        .join(', ')})`;
    }
  }

  if ('text' in result) addWithToSql(ctx, result, cteSqls, isSubSql);

  return result;
};
