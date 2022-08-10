import { AggregateItemOptions, HavingItem, SelectQueryData } from './types';
import { EMPTY_OBJECT, getRaw, isRaw, RawExpression } from '../common';
import { Operator } from '../operators';
import { aggregateToSql } from './aggregate';
import { quote } from '../quote';
import { Query } from '../query';
import { pushOperatorSql } from './operator';
import { q } from './common';

const aggregateOptionNames: (keyof AggregateItemOptions)[] = [
  'distinct',
  'order',
  'filter',
  'filterOr',
  'withinGroup',
];

export const pushHavingSql = <T extends Query>(
  sql: string[],
  model: Pick<Query, 'shape'>,
  query: SelectQueryData<T>,
  quotedAs?: string,
) => {
  const conditions = havingToSql(model, query, quotedAs);
  if (conditions.length) sql.push('HAVING', conditions);
};

export const havingToSql = <T extends Query>(
  model: Pick<Query, 'shape'>,
  query: SelectQueryData<T>,
  quotedAs?: string,
) => {
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
      if ('prototype' in item || '__model' in item) {
        const query = item as Query;
        const sql = havingToSql(
          query,
          query.query || EMPTY_OBJECT,
          query.table && q(query.table),
        );
        if (sql.length) ands.push(`(${sql})`);
        return;
      }

      if (isRaw(item)) {
        ands.push(getRaw(item));
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
                  const operator = model.shape[column].operators[
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
                    model,
                    {
                      function: key,
                      arg: column,
                      options: valueOrOptions as AggregateItemOptions,
                    },
                    quotedAs,
                  );

                  pushOperatorSql(
                    ands,
                    '',
                    operator,
                    expression,
                    valueOrOptions as object,
                    op,
                  );
                }
              }
            } else {
              ands.push(
                `${aggregateToSql(
                  model,
                  {
                    function: key,
                    arg: column,
                    options: EMPTY_OBJECT,
                  },
                  quotedAs,
                )} = ${quote(valueOrOptions)}`,
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
