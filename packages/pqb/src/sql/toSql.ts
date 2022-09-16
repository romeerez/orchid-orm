import { getRaw, isRaw } from '../common';
import { Query } from '../query';
import { addValue, q, qc } from './common';
import { Sql } from './types';
import { pushDistinctSql } from './distinct';
import { pushSelectSql } from './select';
import { windowToSql } from './window';
import { pushJoinSql } from './join';
import { pushWhereSql } from './where';
import { pushHavingSql } from './having';
import { pushWithSql } from './with';
import { pushFromAndAs } from './fromAndAs';
import { pushInsertSql } from './insert';
import { pushUpdateSql } from './update';
import { pushDeleteSql } from './delete';
import { pushTruncateSql } from './truncate';
import { pushColumnInfoSql } from './columnInfo';
import { pushOrderBySql } from './orderBy';

export const toSql = (model: Query, values: unknown[] = []): Sql => {
  const query = model.query;

  const sql: string[] = [];

  if (query.with) {
    pushWithSql(sql, values, query.with);
  }

  if (query.type) {
    if (query.type === 'truncate') {
      if (!model.table) throw new Error('Table is missing for truncate');

      pushTruncateSql(sql, model.table, query);
      return { text: sql.join(' '), values };
    }

    if (query.type === 'columnInfo') {
      if (!model.table) throw new Error('Table is missing for truncate');

      pushColumnInfoSql(sql, values, model.table, query);
      return { text: sql.join(' '), values };
    }

    if (!model.table) throw new Error(`Table is missing for ${query.type}`);

    const quotedAs = q(query.as || model.table);

    if (query.type === 'insert') {
      pushInsertSql(sql, values, model, query, q(model.table));
      return { text: sql.join(' '), values };
    }

    if (query.type === 'update') {
      pushUpdateSql(sql, values, model, query, quotedAs);
      return { text: sql.join(' '), values };
    }

    if (query.type === 'delete') {
      pushDeleteSql(sql, values, model, query, q(model.table));
      return { text: sql.join(' '), values };
    }
  }

  const quotedAs = model.table && q(query.as || model.table);

  sql.push('SELECT');

  if (query.distinct) {
    pushDistinctSql(sql, values, query.distinct, quotedAs);
  }

  pushSelectSql(sql, model, query, values, quotedAs);

  pushFromAndAs(sql, model, query, values, quotedAs);

  pushJoinSql(sql, model, query, values, quotedAs);

  pushWhereSql(sql, model, query, values, quotedAs);

  if (query.group) {
    const group = query.group.map((item) =>
      typeof item === 'object' && isRaw(item)
        ? getRaw(item, values)
        : qc(item as string, quotedAs),
    );
    sql.push(`GROUP BY ${group.join(', ')}`);
  }

  pushHavingSql(sql, model, query, values, quotedAs);

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

  if (query.order) pushOrderBySql(sql, values, quotedAs, query.order);

  const limit = query.take ? 1 : query.limit;
  if (limit) {
    sql.push(`LIMIT ${addValue(values, limit)}`);
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
