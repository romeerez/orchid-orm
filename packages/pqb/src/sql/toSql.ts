import { getRaw, isRaw } from '../common';
import { Query } from '../query';
import { addValue, q, qc } from './common';
import { JoinItem, QueryData, Sql } from './types';
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
import { OnQueryBuilder, WhereQueryBuilder } from '../queryMethods';

export type ToSqlCtx = {
  whereQueryBuilder: typeof WhereQueryBuilder;
  onQueryBuilder: typeof OnQueryBuilder;
  sql: string[];
  values: unknown[];
};

export const toSql = (model: Query, values: unknown[] = []): Sql => {
  const query = model.query;
  const sql: string[] = [];
  const ctx: ToSqlCtx = {
    whereQueryBuilder: model.whereQueryBuilder,
    onQueryBuilder: model.onQueryBuilder,
    sql,
    values,
  };

  if (query.with) {
    pushWithSql(ctx, query.with);
  }

  if (query.type) {
    if (query.type === 'truncate') {
      if (!model.table) throw new Error('Table is missing for truncate');

      pushTruncateSql(ctx, model.table, query);
      return { text: sql.join(' '), values };
    }

    if (query.type === 'columnInfo') {
      if (!model.table) throw new Error('Table is missing for truncate');

      pushColumnInfoSql(ctx, model.table, query);
      return { text: sql.join(' '), values };
    }

    if (!model.table) throw new Error(`Table is missing for ${query.type}`);

    const quotedAs = q(query.as || model.table);

    if (query.type === 'insert') {
      pushInsertSql(ctx, model, query, q(model.table));
      return { text: sql.join(' '), values };
    }

    if (query.type === 'update') {
      pushUpdateSql(ctx, model, query, quotedAs);
      return { text: sql.join(' '), values };
    }

    if (query.type === 'delete') {
      pushDeleteSql(ctx, model, query, q(model.table));
      return { text: sql.join(' '), values };
    }
  }

  const quotedAs = model.table && q(query.as || model.table);

  sql.push('SELECT');

  if (query.distinct) {
    pushDistinctSql(ctx, query.distinct, quotedAs);
  }

  pushSelectSql(ctx, model, query, quotedAs);

  if (model.table || query.from) {
    pushFromAndAs(ctx, model, query, quotedAs);
  }

  if (query.join) {
    pushJoinSql(
      ctx,
      model,
      query as QueryData & { join: JoinItem[] },
      quotedAs,
    );
  }

  if (query.and || query.or) {
    pushWhereStatementSql(ctx, model, query, quotedAs);
  }

  if (query.group) {
    const group = query.group.map((item) =>
      typeof item === 'object' && isRaw(item)
        ? getRaw(item, values)
        : qc(item as string, quotedAs),
    );
    sql.push(`GROUP BY ${group.join(', ')}`);
  }

  if (query.having || query.havingOr) {
    pushHavingSql(ctx, model, query, quotedAs);
  }

  if (query.window) {
    const window: string[] = [];
    query.window.forEach((item) => {
      for (const key in item) {
        window.push(`${q(key)} AS ${windowToSql(item[key], values, quotedAs)}`);
      }
    });
    sql.push(`WINDOW ${window.join(', ')}`);
  }

  if (query.union) {
    query.union.forEach((item) => {
      let itemSql: string;
      if (isRaw(item.arg)) {
        itemSql = getRaw(item.arg, values);
      } else {
        const argSql = item.arg.toSql(values);
        itemSql = argSql.text;
      }
      sql.push(`${item.kind} ${item.wrap ? `(${itemSql})` : itemSql}`);
    });
  }

  if (query.order) {
    pushOrderBySql(ctx, quotedAs, query.order);
  }

  if (query.take || query.limit !== undefined) {
    sql.push(`LIMIT ${addValue(values, query.take ? 1 : query.limit)}`);
  }

  if (query.offset) {
    sql.push(`OFFSET ${addValue(values, query.offset)}`);
  }

  if (query.for) {
    sql.push('FOR', query.for.type);
    const { tableNames } = query.for;
    if (tableNames) {
      if (isRaw(tableNames)) {
        sql.push('OF', getRaw(tableNames, values));
      } else {
        sql.push('OF', tableNames.map(q).join(', '));
      }
    }
    if (query.for.mode) sql.push(query.for.mode);
  }

  return { text: sql.join(' '), values };
};
