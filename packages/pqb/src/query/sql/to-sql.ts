import { Query } from '../query';
import { QueryData, QueryType } from '../query-data';
import { QueryBuilder } from '../db';
import {
  addWithToSql,
  ctesToSql,
  setFreeTopCteAs,
  TopCTE,
} from '../basic-features/cte/cte.sql';
import { SubQueryForSql } from '../sub-query/sub-query-for-sql';
import { pushTruncateSql } from '../extra-features/truncate/truncate.sql';
import { pushColumnInfoSql } from '../extra-features/get-column-info/get-column-info.sql';
import { makeInsertSql } from '../basic-features/mutate/insert.sql';
import { pushUpdateSql } from '../basic-features/mutate/update.sql';
import { pushDeleteSql } from '../basic-features/mutate/delete.sql';
import { pushCopySql } from '../extra-features/copy-table-data/copy-table-data.sql';
import {
  _clone,
  JoinItem,
  makeRowToJson,
  makeSql,
  MoreThanOneRowError,
  QueryInternal,
  Sql,
} from '../index';
import { moveMutativeQueryToCteBase } from '../basic-features/cte/move-mutative-query-to-cte-base.sql';
import { _queryWhereNotExists } from '../basic-features/where/where';
import { pushDistinctSql } from '../basic-features/distinct/distinct.sql';
import { setSqlCtxSelectList } from '../basic-features/select/select.sql';
import { pushFromAndAs } from '../basic-features/from/fromAndAs.sql';
import { pushJoinSql } from '../basic-features/join/join.sql';
import { pushWhereStatementSql } from '../basic-features/where/where.sql';
import { columnToSql } from './column-to-sql';
import { pushHavingSql } from '../basic-features/having/having.sql';
import { windowToSql } from '../basic-features/window/window.sql';
import { pushOrderBySql } from '../basic-features/order/order.sql';
import { pushLimitOffsetSql } from '../basic-features/limit-offset/limit-offset.sql';
import { addTableHook } from '../extra-features/hooks/hooks.sql';
import { RunAfterQuery } from './sql';
import { HasCteHooks, TableHook } from '../basic-features/select/hook-select';
import { DelayedRelationSelect } from '../basic-features/select/delayed-relational-select';
import { isExpression } from '../expressions/expression';
import { pushUnionSql } from '../basic-features/union/union.sql';
import { pushForSql } from '../basic-features/for/for.sql';

interface ToSqlOptionsInternal {
  hasNonSelect?: boolean;
  // selected value in JOIN LATERAL will have an alias to reference it from SELECT
  aliasValue?: true;
  // for insert batching logic: skip a batch check when is inside a WITH subquery
  skipBatchCheck?: true;
  selectedCount?: number;
  selectList?: string[];
}

export interface ToSqlValues {
  values: unknown[];
}

export interface TopToSqlCtx
  extends ToSqlOptionsInternal,
    HasCteHooks,
    ToSqlValues {
  topCtx: TopToSqlCtx;
  topCTE?: TopCTE;
  tableHook?: TableHook;
  delayedRelationSelect?: DelayedRelationSelect;
  cteHookTopNullSelectAppended?: boolean;
}

export interface ToSQLCtx extends ToSqlOptionsInternal, ToSqlValues {
  topCtx: TopToSqlCtx;
  qb: QueryBuilder;
  q: QueryData;
  sql: string[];
  selectedCount: number;
  cteName?: string;
  wrapAs?: string;
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
  returnType: Query['returnType'];
  result: Query['result'];
  shape: Query['shape'];
}

export interface ToSql {
  (
    table: ToSQLQuery,
    type: QueryType,
    topCtx?: TopToSqlCtx,
    isSubSql?: boolean,
    cteName?: string,
  ): Sql;
}

export const toSql: ToSql = (table, type, topCtx, isSubSql, cteName) => {
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

  ctesToSql(ctx, query.with);

  let result: Sql;

  let selectKeywordPos: number | undefined;
  let prependedSelectParenthesis: boolean | undefined;

  let fromQuery: SubQueryForSql | undefined;

  if (query.asFns) {
    let as;
    if (isSubSql) {
      as = cteName || setFreeTopCteAs(ctx);
    } else {
      as = ctx.wrapAs = setFreeTopCteAs(ctx);
    }
    for (const fn of query.asFns) {
      fn(as);
    }
  }

  if (type && type !== 'upsert') {
    const tableName = table.table ?? query.as;
    if (!tableName) throw new Error(`Table is missing for ${type}`);

    if (type === 'truncate') {
      pushTruncateSql(ctx, tableName, query);
      result = makeSql(ctx, type, isSubSql);
    } else if (type === 'columnInfo') {
      pushColumnInfoSql(ctx, table, query);
      result = makeSql(ctx, type, isSubSql);
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
        result = makeSql(ctx, type, isSubSql);
      } else {
        throw new Error(`Unsupported query type ${type}`);
      }
    }
  } else {
    let selectSqlPos: number | undefined;
    let runAfterQuery: RunAfterQuery | undefined;
    let skipSelect: boolean | undefined;
    if (type === 'upsert') {
      const upsertUpdate = query.upsertUpdate && query.updateData;
      if (isSubSql || query.upsertSecond) {
        skipSelect = true;

        const upsertOrCreate = _clone(table as Query);

        // it expected for update to not find records, do not throw if not found
        if (upsertOrCreate.q.returnType === 'oneOrThrow') {
          upsertOrCreate.q.returnType = 'one';
        } else if (upsertOrCreate.q.returnType === 'valueOrThrow') {
          upsertOrCreate.q.returnType = 'value';
        }

        const { as, makeSql: makeFirstSql } = moveMutativeQueryToCteBase(
          toSql,
          ctx,
          upsertOrCreate as unknown as SubQueryForSql,
          upsertUpdate ? 'update' : null,
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
          toSql,
          ctx,
          upsertOrCreate as unknown as SubQueryForSql,
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

        if (upsertUpdate) {
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
      pushUnionSql(ctx, query.union, quotedAs);
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

    pushLimitOffsetSql(ctx, query, fromQuery);

    pushForSql(ctx, query, type, quotedAs);

    addTableHook(ctx, table, query, query.hookSelect);

    // compose select in the last moment because NULL for CTE selects
    // can be added by sub queries added in where or in other places
    if (selectSqlPos !== undefined && ctx.selectList?.length) {
      sql[selectSqlPos] += ' ' + ctx.selectList.join(', ');
    }

    if (selectKeywordPos !== undefined && !isSubSql && ctx.topCtx.cteHooks) {
      sql[selectKeywordPos] = '(' + sql[selectKeywordPos];
      prependedSelectParenthesis = true;
    }

    result = makeSql(ctx, type, isSubSql, runAfterQuery);
  }

  if (!ctx.cteName) {
    result.tableHook = ctx.topCtx.tableHook;
    if (!topCtx) {
      result.delayedRelationSelect = ctx.topCtx.delayedRelationSelect;
    }
  }

  if (!isSubSql) {
    if (ctx.topCtx.cteHooks && 'text' in result) {
      result.cteHooks = ctx.topCtx.cteHooks;

      if (ctx.topCtx.cteHooks.hasSelect) {
        if (prependedSelectParenthesis) {
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
  }

  if ('text' in result) addWithToSql(ctx, result, isSubSql);

  return result;
};
