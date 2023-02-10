import { AggregateItemOptions, HavingItem } from './types';
import { getRaw, isRaw, RawExpression } from '../raw';
import { Operator } from '../columns/operators';
import { aggregateToSql } from './aggregate';
import { QueryBase } from '../query';
import { addValue, q } from './common';
import { ToSqlCtx } from './toSql';
import { SelectQueryData } from './data';
import { EMPTY_OBJECT } from '../utils';

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
      if ('prototype' in item || '__table' in item) {
        const query = item as QueryBase;
        const sql = havingToSql(
          ctx,
          query,
          query.query as SelectQueryData,
          query.table && q(query.table),
        );
        if (sql.length) ands.push(`(${sql})`);
        return;
      }

      if (isRaw(item)) {
        ands.push(getRaw(item, ctx.values));
        return;
      }

      for (const key in item) {
        const columns = item[key as keyof Exclude<HavingItem, RawExpression>];
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
                  const operator = table.shape[column].operators[
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
                    options: EMPTY_OBJECT,
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
