import { Query, QueryInternal, queryTypeWithLimitOne } from '../query/query';
import { columnToSql, makeRowToJson } from './common';
import { JoinItem } from './types';
import { pushDistinctSql } from './distinct';
import { pushSelectSql } from './select';
import { windowToSql } from './window';
import { pushJoinSql } from './join';
import { pushWhereStatementSql } from './where';
import { pushHavingSql } from './having';
import { pushFromAndAs } from './fromAndAs';
import { makeInsertSql } from './insert';
import { pushUpdateSql } from './update';
import { pushDeleteSql } from './delete';
import { pushTruncateSql } from './truncate';
import { pushColumnInfoSql } from './columnInfo';
import { pushOrderBySql } from './orderBy';
import { QueryData } from './data';
import { pushCopySql } from './copy';
import {
  addValue,
  DelayedRelationSelect,
  isExpression,
  Sql,
  HasCteHooks,
  CteTableHook,
  MoreThanOneRowError,
} from '../core';
import { QueryBuilder } from '../query/db';
import { getSqlText } from './utils';
import {
  addWithToSql,
  ctesToSql,
  moveMutativeQueryToCte,
  TopCTE,
} from '../query/cte/cte.sql';
import { getQueryAs } from '../common/utils';
import { _clone } from '../query';
import { _queryWhereNotExists } from '../queryMethods';
import { RunAfterQuery } from '../core/query/query';
import { Column } from '../columns';

interface ToSqlOptionsInternal extends ToSQLOptions, HasCteHooks {
  // selected value in JOIN LATERAL will have an alias to reference it from SELECT
  aliasValue?: true;
  // for insert batching logic: skip a batch check when is inside a WITH subquery
  skipBatchCheck?: true;
  selectedCount?: number;
  topCTE?: TopCTE;
}

export interface ToSQLCtx extends ToSqlOptionsInternal, ToSQLOptions {
  qb: QueryBuilder;
  q: QueryData;
  sql: string[];
  values: unknown[];
  delayedRelationSelect?: DelayedRelationSelect;
  selectedCount: number;
  topCTE?: TopCTE;
  cteSqls?: string[];
  inCte?: boolean;
}

export interface ToSQLOptions {
  values?: unknown[];
  hasNonSelect?: boolean;
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

export const toCteSubSqlText = (
  options: ToSqlOptionsInternal,
  q: ToSQLQuery,
  cteName: string,
  type: QueryData['type'],
): string => getSqlText(subToSql(options, q, cteName, type));

export const toSubSqlText = (
  options: ToSqlOptionsInternal,
  q: ToSQLQuery,
  type?: QueryData['type'],
): string => getSqlText(subToSql(options, q, undefined, type));

const subToSql = (
  options: ToSqlOptionsInternal,
  q: ToSQLQuery,
  cteName?: string,
  type = q.q.type,
): Sql => {
  const sql = queryTypeToSQL(q, type, options, true, !!cteName);
  if (sql.tableHook && (sql.tableHook.after || sql.tableHook.afterCommit)) {
    const shape: Column.Shape.Data = {};
    if (sql.tableHook.select) {
      for (const key of sql.tableHook.select.keys()) {
        shape[key] = q.shape[key] as unknown as Column.Pick.Data;
      }
    }

    const item: CteTableHook = {
      table: q.table!,
      shape,
      tableHook: sql.tableHook,
    };

    cteName ??= getQueryAs(q);
    if (options.cteHooks) {
      if (sql.tableHook.select) options.cteHooks.hasSelect = true;
      options.cteHooks.tableHooks[cteName] ??= item;
    } else {
      options.cteHooks = {
        hasSelect: !!sql.tableHook.select,
        tableHooks: { [cteName]: item },
      };
    }
  }
  return sql;
};

export const toSQL = (table: ToSQLQuery, options?: ToSqlOptionsInternal): Sql =>
  queryTypeToSQL(table, table.q.type, options);

const queryTypeToSQL = (
  table: ToSQLQuery,
  type: QueryData['type'],
  options?: ToSqlOptionsInternal,
  isSubSql?: boolean,
  inCte?: boolean,
): Sql => {
  const query = table.q;
  const sql: string[] = [];
  const values = options?.values || [];
  const ctx: ToSQLCtx = {
    qb: table.qb,
    q: query,
    sql,
    values,
    aliasValue: options?.aliasValue,
    skipBatchCheck: options?.skipBatchCheck,
    hasNonSelect: options?.hasNonSelect,
    cteHooks: options?.cteHooks,
    selectedCount: 0,
    topCTE: options?.topCTE,
    inCte,
  };

  const cteSqls = query.with && ctesToSql(ctx, query.with);

  let result: Sql;

  let fromQuery: Query | undefined;
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
    let runAfterQuery: RunAfterQuery | undefined;
    let skipSelect: boolean | undefined;
    if (type === 'upsert') {
      if (isSubSql || query.upsertSecond) {
        skipSelect = true;

        const upsertOrCreate = _clone(table as Query);
        const { as, makeSql: makeFirstSql } = moveMutativeQueryToCte(
          ctx,
          upsertOrCreate,
          query.updateData ? 'u' : 'f',
          query.updateData ? 'update' : null,
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

        const { makeSql: makeSecondSql } = moveMutativeQueryToCte(
          ctx,
          upsertOrCreate,
          'c',
          'insert',
        );

        sql.push(makeFirstSql(), 'UNION ALL', makeSecondSql());
      } else {
        const second = _clone(table);
        second.q.upsertSecond = true;
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
          const result = queryTypeToSQL(table, 'update', options, isSubSql);
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
      const firstSql = subToSql(ctx, query.union.b);
      ctx.delayedRelationSelect = firstSql.delayedRelationSelect;
      const s = getSqlText(firstSql);
      sql.push(query.union.p ? s : `(${s})`);

      for (const u of query.union.u) {
        const s = isExpression(u.a)
          ? u.a.toSQL(ctx, quotedAs)
          : toSubSqlText(ctx, u.a);
        sql.push(`${u.k} ${u.p ? s : '(' + s + ')'}`);
      }
    } else if (!skipSelect) {
      sql.push('SELECT');

      if (query.distinct) {
        pushDistinctSql(ctx, table, query.distinct, quotedAs);
      }

      const aliases = query.group ? [] : undefined;
      pushSelectSql(ctx, table, query, quotedAs, isSubSql, aliases);

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

    result = {
      text: sql.join(' '),
      values,
      tableHook: query.hookSelect && {
        select: query.hookSelect,
      },
      delayedRelationSelect: ctx.delayedRelationSelect,
      runAfterQuery,
    };
  }

  if (options && (type || ctx.hasNonSelect)) {
    options.hasNonSelect = true;
  }

  if (!isSubSql && ctx.cteHooks && 'text' in result) {
    result.cteHooks = ctx.cteHooks;

    if (ctx.cteHooks.hasSelect) {
      result.text += ` UNION ALL SELECT ${'NULL, '.repeat(
        ctx.selectedCount || 0,
      )}json_build_object(${Object.entries(ctx.cteHooks.tableHooks)
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

  if (options && ctx.topCTE) {
    options.topCTE = ctx.topCTE;
  }

  return result;
};

export function pushLimitSQL(sql: string[], values: unknown[], q: QueryData) {
  if (!q.returnsOne) {
    if (queryTypeWithLimitOne[q.returnType as string] && !q.returning) {
      sql.push(`LIMIT 1`);
    } else if (q.limit) {
      sql.push(`LIMIT ${addValue(values, q.limit)}`);
    }
  }
}
