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
    pushWithSql(model, sql, query.with);
  }

  sql.push('SELECT');

  const quotedAs = model.table && q(query.as || model.table);

  if (query.distinct) {
    pushDistinctSql(sql, query.distinct, quotedAs);
  }

  pushSelectSql(sql, query.select, quotedAs);

  if (query.from || model.table) {
    let from: string;
    if (query.from) {
      if (typeof query.from === 'object') {
        if (isRaw(query.from)) {
          from = getRaw(query.from);
        } else if (query.from.query || !query.from.table) {
          from = `(${query.from.toSql()})`;
        } else {
          from = q(query.from.table);
        }
      } else {
        from = q(query.from);
      }
    } else {
      from = q(model.table as string);
    }

    sql.push('FROM');
    if (query.fromOnly) sql.push('ONLY');
    sql.push(from);

    if (query.as && quotedAs !== from) {
      sql.push('AS', quotedAs as string);
    }
  }

  if (query.join) {
    pushJoinSql(sql, model, query.join, quotedAs);
  }

  const whereConditions = whereToSql(model, query, quotedAs);
  if (whereConditions.length) sql.push('WHERE', whereConditions);

  if (query.group) {
    const group = query.group.map((item) =>
      typeof item === 'object' && isRaw(item)
        ? getRaw(item)
        : qc(item as string, quotedAs),
    );
    sql.push(`GROUP BY ${group.join(', ')}`);
  }

  if (query.having) {
    pushHavingSql(sql, model, query.having, quotedAs);
  }

  if (query.window) {
    const window: string[] = [];
    query.window.forEach((item) => {
      for (const key in item) {
        window.push(`${q(key)} AS ${windowToSql(item[key], quotedAs)}`);
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
        .map((item) => orderByToSql(item, quotedAs))
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
