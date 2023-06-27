import { AggregateItemOptions, HavingItem } from './types';
import { aggregateToSql } from './aggregate';
import { addValue, q } from './common';
import { ToSqlCtx } from './toSql';
import { SelectQueryData } from './data';
import { Operator, emptyObject, isExpression, Expression } from 'orchid-core';
import { QueryBase } from '../queryBase';

const aggregateOptionNames: (keyof AggregateItemOptions)[] = [
  'distinct',
  'order',
  'filter',
  'filterOr',
  'withinGroup',
];

export const pushHavingSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: SelectQueryData,
  quotedAs?: string,
) => {
  const conditions = havingToSql(ctx, table, query, quotedAs);
  if (conditions.length) ctx.sql.push('HAVING', conditions);
};

export const havingToSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: SelectQueryData,
  quotedAs?: string,
): string => {
  const or =
    query.having && query.havingOr
      ? [query.having, ...query.havingOr]
      : query.having
      ? [query.having]
      : query.havingOr;
  if (!or?.length) return '';

  const ors: string[] = [];
  or.forEach((and) => {
    const ands: string[] = [];
    and.forEach((item) => {
      if ('prototype' in item || 'baseQuery' in item) {
        const query = item as QueryBase;
        const sql = havingToSql(
          ctx,
          query,
          query.q as SelectQueryData,
          query.table && q(query.table),
        );
        if (sql.length) ands.push(`(${sql})`);
        return;
      }

      if (isExpression(item)) {
        ands.push(item.toSQL(ctx.values));
        return;
      }

      for (const key in item) {
        const columns = item[key as keyof Exclude<HavingItem, Expression>];
        if (typeof columns === 'object') {
          for (const column in columns) {
            const valueOrOptions = columns[column as keyof typeof columns];
            if (
              typeof valueOrOptions === 'object' &&
              valueOrOptions !== null &&
              valueOrOptions !== undefined
            ) {
              for (const op in valueOrOptions) {
                if (
                  !aggregateOptionNames.includes(
                    op as keyof AggregateItemOptions,
                  )
                ) {
                  const operator = table.q.shape[column].operators[
                    op
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ] as Operator<any>;
                  if (!operator) {
                    // TODO: custom error classes
                    throw new Error(
                      `Unknown operator ${op} provided to condition`,
                    );
                  }

                  const expression = aggregateToSql(
                    ctx,
                    table,
                    {
                      function: key,
                      arg: column,
                      options: valueOrOptions as AggregateItemOptions,
                    },
                    quotedAs,
                  );

                  ands.push(
                    operator(
                      expression,
                      valueOrOptions[op as keyof typeof valueOrOptions],
                      ctx.values,
                    ),
                  );
                }
              }
            } else {
              ands.push(
                `${aggregateToSql(
                  ctx,
                  table,
                  {
                    function: key,
                    arg: column,
                    options: emptyObject,
                  },
                  quotedAs,
                )} = ${addValue(ctx.values, valueOrOptions)}`,
              );
            }
          }
        } else {
          ands.push(`${key}(*) = ${columns}`);
        }
      }
    });

    ors.push(ands.join(' AND '));
  });

  return ors.join(' OR ');
};
