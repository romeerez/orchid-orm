import { Query, QueryInternal, queryTypeWithLimitOne } from '../query/query';
import { columnToSql } from './common';
import { JoinItem } from './types';
import { pushDistinctSql } from './distinct';
import { pushSelectSql } from './select';
import { windowToSql } from './window';
import { pushJoinSql } from './join';
import { pushWhereStatementSql } from './where';
import { pushHavingSql } from './having';
import { pushWithSql } from './with';
import { pushFromAndAs } from './fromAndAs';
import { makeInsertSql } from './insert';
import { pushUpdateSql } from './update';
import { pushDeleteSql } from './delete';
import { pushTruncateSql } from './truncate';
import { pushColumnInfoSql } from './columnInfo';
import { pushOrderBySql } from './orderBy';
import { QueryData, SelectQueryData } from './data';
import { pushCopySql } from './copy';
import { addValue, isExpression, Sql } from 'orchid-core';
import { Db } from '../query/db';
import { getSqlText } from './utils';

export interface ToSQLCtx {
  queryBuilder: Db;
  q: QueryData;
  sql: string[];
  values: unknown[];
  // selected value in JOIN LATERAL will have an alias to reference it from SELECT
  aliasValue?: true;
}

export interface ToSQLOptions {
  clearCache?: boolean;
  values?: unknown[];
}

interface ToSqlOptionsInternal extends ToSQLOptions {
  aliasValue?: true;
}

export interface ToSQLQuery {
  __isQuery: Query['__isQuery'];
  q: Query['q'];
  queryBuilder: Query['queryBuilder'];
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

export const toSQL = (table: ToSQLQuery, options?: ToSQLOptions): Sql => {
  if (table.q.sqlCache && !options?.clearCache) {
    const cached = table.q.sqlCache;
    if (
      options?.values &&
      'values' in cached &&
      cached.values &&
      options.values !== cached.values
    ) {
      options.values.push(...cached.values);
    }
    return cached;
  }

  return (table.q.sqlCache = makeSQL(table, options));
};

export const makeSQL = (
  table: ToSQLQuery,
  options?: ToSqlOptionsInternal,
): Sql => {
  const query = table.q;
  const sql: string[] = [];
  const values = options?.values || [];
  const ctx: ToSQLCtx = {
    queryBuilder: table.queryBuilder,
    q: query,
    sql,
    values,
    aliasValue: options?.aliasValue,
  };

  if (query.with) {
    pushWithSql(ctx, query.with);
  }

  if (query.type && query.type !== 'upsert') {
    const tableName = table.table ?? query.as;
    if (!tableName) throw new Error(`Table is missing for ${query.type}`);

    if (query.type === 'truncate') {
      pushTruncateSql(ctx, tableName, query);
      return { text: sql.join(' '), values };
    }

    if (query.type === 'columnInfo') {
      pushColumnInfoSql(ctx, table, query);
      return { text: sql.join(' '), values };
    }

    const quotedAs = `"${query.as || tableName}"`;

    if (query.type === 'insert') {
      return makeInsertSql(ctx, table, query, `"${tableName}"`);
    }

    if (query.type === 'update') {
      return {
        hookSelect: pushUpdateSql(ctx, table, query, quotedAs),
        text: sql.join(' '),
        values,
      };
    }

    if (query.type === 'delete') {
      return {
        hookSelect: pushDeleteSql(ctx, table, query, quotedAs),
        text: sql.join(' '),
        values,
      };
    }

    if (query.type === 'copy') {
      pushCopySql(ctx, table, query, quotedAs);
      return { text: sql.join(' '), values };
    }
  }

  const quotedAs = (query.as || table.table) && `"${query.as || table.table}"`;

  if (query.union) {
    const s = getSqlText(makeSQL(query.union.b, { values }));
    sql.push(query.union.p ? s : `(${s})`);

    for (const u of query.union.u) {
      const s = isExpression(u.a)
        ? u.a.toSQL(ctx, quotedAs)
        : getSqlText(makeSQL(u.a, { values }));
      sql.push(`${u.k} ${u.p ? s : '(' + s + ')'}`);
    }
  } else {
    sql.push('SELECT');

    if (query.distinct) {
      pushDistinctSql(ctx, table, query.distinct, quotedAs);
    }

    const aliases = query.group ? [] : undefined;
    pushSelectSql(ctx, table, query, quotedAs, aliases);

    if (table.table || query.from) {
      pushFromAndAs(ctx, table, query, quotedAs);
    }

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
            : columnToSql(ctx, table.q, table.shape, item as string, quotedAs);
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

  pushLimitSQL(sql, values, query);

  if (query.offset) {
    sql.push(`OFFSET ${addValue(values, query.offset)}`);
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

  return { text: sql.join(' '), values, hookSelect: query.hookSelect };
};

export function pushLimitSQL(
  sql: string[],
  values: unknown[],
  q: SelectQueryData,
) {
  if (!q.returnsOne) {
    if (queryTypeWithLimitOne[q.returnType as string] && !q.returning) {
      sql.push(`LIMIT 1`);
    } else if (q.limit) {
      sql.push(`LIMIT ${addValue(values, q.limit)}`);
    }
  }
}
