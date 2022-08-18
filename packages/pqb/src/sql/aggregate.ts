import { AggregateItem } from './types';
import { addValue, expressionToSql, q } from './common';
import { EMPTY_OBJECT, Expression, getRaw, isRaw } from '../common';
import { windowToSql } from './window';
import { pushOrderBySql } from './orderBy';
import { whereToSql } from './where';
import { Query } from '../query';

export const aggregateToSql = (
  model: Pick<Query, 'shape'>,
  values: unknown[],
  item: AggregateItem,
  quotedAs?: string,
) => {
  const sql: string[] = [`${item.function}(`];

  const options = item.options || EMPTY_OBJECT;

  if (options.distinct && !options.withinGroup) sql.push('DISTINCT ');

  if (typeof item.arg === 'object') {
    if (Array.isArray(item.arg)) {
      sql.push(
        `${expressionToSql(item.arg[0], values, quotedAs)}, ${addValue(
          values,
          item.arg[1],
        )}`,
      );
    } else if (isRaw(item.arg)) {
      sql.push(getRaw(item.arg, values));
    } else {
      const args: string[] = [];
      for (const key in item.arg) {
        args.push(
          // ::text is needed to bypass "could not determine data type of parameter" postgres error
          `${addValue(values, key)}::text, ${expressionToSql(
            item.arg[key as keyof typeof item.arg] as unknown as Expression,
            values,
            quotedAs,
          )}`,
        );
      }
      sql.push(args.join(', '));
    }
  } else if (item.arg) {
    sql.push(expressionToSql(item.arg, values, quotedAs));
  }

  if (options.withinGroup) sql.push(') WITHIN GROUP (');
  else if (options.order) sql.push(' ');

  if (options.order) pushOrderBySql(sql, values, quotedAs, options.order);

  sql.push(')');

  if (options.filter || options.filterOr) {
    const whereSql = whereToSql(
      model,
      {
        and: options.filter ? [{ item: options.filter }] : undefined,
        or: options.filterOr?.map((item) => [{ item }]),
      },
      values,
      quotedAs,
    );

    sql.push(` FILTER (WHERE ${whereSql})`);
  }

  if (options.over) {
    sql.push(` OVER ${windowToSql(options.over, values, quotedAs)}`);
  }

  if (options.as) sql.push(` AS ${q(options.as)}`);

  return sql.join('');
};
