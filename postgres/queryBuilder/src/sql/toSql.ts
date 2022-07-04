import { getRaw, isRaw } from '../common';
import { Query } from '../query';
import { EMPTY_OBJECT, q, qc } from './common';
import { QueryData } from './types';
import { pushDistinctSql } from './distinct';
import { pushSelectSql } from './select';
import { windowToSql } from './window';
import { orderByToSql } from './orderBy';
import { pushJoinSql } from './join';
import { whereToSql } from './where';
import { pushHavingSql } from './having';
import { pushWithSql } from './with';

export const toSql = (model: Query): string => {
  const query = (model.query || EMPTY_OBJECT) as QueryData;

  const sql: string[] = [];

  if (query.with) {
    pushWithSql(sql, query.with);
  }

  sql.push('SELECT');

  const quotedAs = q(query.as || model.table);

  if (query.distinct) {
    pushDistinctSql(sql, quotedAs, query.distinct);
  }

  pushSelectSql(sql, quotedAs, query.select);

  const from = query.from
    ? typeof query.from === 'object'
      ? isRaw(query.from)
        ? getRaw(query.from)
        : query.from.query
        ? `(${query.from.toSql()})`
        : q(query.from.table)
      : q(query.from)
    : q(model.table);

  sql.push('FROM');
  if (query.fromOnly) sql.push('ONLY');
  sql.push(from);

  if (query.as && quotedAs !== from) {
    sql.push('AS', quotedAs);
  }

  if (query.join) {
    pushJoinSql(sql, model, quotedAs, query.join);
  }

  const whereConditions = whereToSql(model, query, quotedAs);
  if (whereConditions.length) sql.push('WHERE', whereConditions);

  if (query.group) {
    const group = query.group.map((item) =>
      typeof item === 'object' && isRaw(item)
        ? getRaw(item)
        : qc(quotedAs, item as string),
    );
    sql.push(`GROUP BY ${group.join(', ')}`);
  }

  if (query.having) {
    pushHavingSql(sql, model, quotedAs, query.having);
  }

  if (query.window) {
    const window: string[] = [];
    query.window.forEach((item) => {
      for (const key in item) {
        window.push(`${q(key)} AS ${windowToSql(quotedAs, item[key])}`);
      }
    });
    sql.push(`WINDOW ${window.join(', ')}`);
  }

  if (query.union) {
    query.union.forEach((item) => {
      sql.push(
        `${item.kind} ${isRaw(item.arg) ? getRaw(item.arg) : item.arg.toSql()}`,
      );
    });
  }

  if (query.order) {
    sql.push(
      `ORDER BY ${query.order
        .map((item) => orderByToSql(quotedAs, item))
        .join(', ')}`,
    );
  }

  const limit = query.take ? 1 : query.limit;
  if (limit) {
    sql.push(`LIMIT ${limit}`);
  }

  if (query.offset) {
    sql.push(`OFFSET ${query.offset}`);
  }

  if (query.for) {
    sql.push(`FOR ${query.for.map(getRaw).join(', ')}`);
  }

  return sql.join(' ');
};
