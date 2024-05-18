import { Query, queryTypeWithLimitOne } from '../query/query';
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
import { pushInsertSql } from './insert';
import { pushUpdateSql } from './update';
import { pushDeleteSql } from './delete';
import { pushTruncateSql } from './truncate';
import { pushColumnInfoSql } from './columnInfo';
import { pushOrderBySql } from './orderBy';
import { QueryData, SelectQueryData } from './data';
import { pushCopySql } from './copy';
import { addValue, isExpression, Sql } from 'orchid-core';
import { Db } from '../query/db';

export type ToSQLCtx = {
  queryBuilder: Db;
  sql: string[];
  values: unknown[];
  // selected value in JOIN LATERAL will have an alias to reference it from SELECT
  aliasValue?: true;
};

export type toSQLCacheKey = typeof toSQLCacheKey;
export const toSQLCacheKey = Symbol('toSQLCache');

export type ToSQLOptions = {
  clearCache?: boolean;
  values?: unknown[];
};

type ToSqlOptionsInternal = ToSQLOptions & {
  aliasValue?: true;
};

export type ToSQLQuery = {
  __isQuery: Query['__isQuery'];
  q: Query['q'];
  queryBuilder: Query['queryBuilder'];
  table?: Query['table'];
  internal: Query['internal'];
  relations: Query['relations'];
  withData: Query['withData'];
  clone: Query['clone'];
  baseQuery: Query['baseQuery'];
  meta: Query['meta'];
  returnType: Query['returnType'];
  result: Query['result'];
  shape: Query['shape'];
};

export const toSQL = (table: ToSQLQuery, options?: ToSQLOptions): Sql => {
  return (
    (!options?.clearCache && table.q[toSQLCacheKey]) ||
    (table.q[toSQLCacheKey] = makeSQL(table, options))
  );
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
    sql,
    values,
    aliasValue: options?.aliasValue,
  };

  if (query.with) {
    pushWithSql(ctx, query.with);
  }

  if (query.type) {
    if (query.type === 'truncate') {
      if (!table.table) throw new Error('Table is missing for truncate');

      pushTruncateSql(ctx, table.table, query);
      return { text: sql.join(' '), values };
    }

    if (query.type === 'columnInfo') {
      if (!table.table) throw new Error('Table is missing for truncate');

      pushColumnInfoSql(ctx, table, query);
      return { text: sql.join(' '), values };
    }

    if (!table.table) throw new Error(`Table is missing for ${query.type}`);

    const quotedAs = `"${query.as || table.table}"`;

    if (query.type === 'insert') {
      return {
        hookSelect: pushInsertSql(ctx, table, query, `"${table.table}"`),
        text: sql.join(' '),
        values,
      };
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

  sql.push('SELECT');

  if (query.distinct) {
    pushDistinctSql(ctx, table, query.distinct, quotedAs);
  }

  pushSelectSql(ctx, table, query, quotedAs);

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

  if (query.and || query.or) {
    pushWhereStatementSql(ctx, table, query, quotedAs);
  }

  if (query.group) {
    const group = query.group.map((item) =>
      isExpression(item)
        ? item.toSQL(ctx, quotedAs)
        : columnToSql(ctx, table.q, table.q.shape, item as string, quotedAs),
    );
    sql.push(`GROUP BY ${group.join(', ')}`);
  }

  if (query.having) pushHavingSql(ctx, query, quotedAs);

  if (query.window) {
    const window: string[] = [];
    query.window.forEach((item) => {
      for (const key in item) {
        window.push(
          `"${key}" AS ${windowToSql(ctx, query, item[key], quotedAs)}`,
        );
      }
    });
    sql.push(`WINDOW ${window.join(', ')}`);
  }

  if (query.union) {
    query.union.forEach((item) => {
      let itemSql: string;
      if (isExpression(item.arg)) {
        itemSql = item.arg.toSQL(ctx, quotedAs);
      } else {
        const argSql = makeSQL(item.arg, { values });
        itemSql = argSql.text;
      }
      sql.push(`${item.kind} ${item.wrap ? `(${itemSql})` : itemSql}`);
    });
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

  return { text: sql.join(' '), values };
};

export function pushLimitSQL(
  sql: string[],
  values: unknown[],
  q: SelectQueryData,
) {
  if (!q.returnsOne) {
    if (queryTypeWithLimitOne[q.returnType]) {
      sql.push(`LIMIT 1`);
    } else if (q.limit) {
      sql.push(`LIMIT ${addValue(values, q.limit)}`);
    }
  }
}
