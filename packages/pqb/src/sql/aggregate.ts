import { AggregateItem } from './types';
import { expressionToSql, q } from './common';
import { quote } from '../quote';
import { EMPTY_OBJECT, Expression, isRaw } from '../common';
import { windowToSql } from './window';
import { pushOrderBySql } from './orderBy';
import { whereToSql } from './where';
import { Query } from '../query';

export const aggregateToSql = (
  model: Pick<Query, 'shape'>,
  item: AggregateItem,
  quotedAs?: string,
) => {
  const sql: string[] = [`${item.function}(`];

  const options = item.options || EMPTY_OBJECT;

  if (options.distinct && !options.withinGroup) sql.push('DISTINCT ');

  if (typeof item.arg === 'object') {
    if (Array.isArray(item.arg)) {
      sql.push(
        `${expressionToSql(item.arg[0], quotedAs)}, ${quote(item.arg[1])}`,
      );
    } else if (isRaw(item.arg)) {
      sql.push(expressionToSql(item.arg, quotedAs));
    } else {
      const args: string[] = [];
      for (const key in item.arg) {
        args.push(
          `${quote(key)}, ${expressionToSql(
            item.arg[key as keyof typeof item.arg] as unknown as Expression,
            quotedAs,
          )}`,
        );
      }
      sql.push(args.join(', '));
    }
  } else if (item.arg) {
    sql.push(expressionToSql(item.arg, quotedAs));
  }

  if (options.withinGroup) sql.push(') WITHIN GROUP (');
  else if (options.order) sql.push(' ');

  if (options.order) pushOrderBySql(sql, quotedAs, options.order);

  sql.push(')');

  if (options.filter || options.filterOr) {
    sql.push(
      ` FILTER (WHERE ${whereToSql(
        model,
        {
          and: options.filter ? [{ item: options.filter }] : undefined,
          or: options.filterOr?.map((item) => [{ item }]),
        },
        quotedAs,
      )})`,
    );
  }

  if (options.over) {
    sql.push(` OVER ${windowToSql(options.over, quotedAs)}`);
  }

  if (options.as) sql.push(` AS ${q(options.as)}`);

  return sql.join('');
};
