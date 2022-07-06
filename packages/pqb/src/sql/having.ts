import { AggregateOptions, HavingArg, QueryData } from './types';
import { EMPTY_OBJECT, getRaw, isRaw, RawExpression } from '../common';
import { Operator } from '../operators';
import { aggregateToSql } from './aggregate';
import { quote } from '../quote';
import { Query } from '../query';

const aggregateOptionNames: (keyof AggregateOptions)[] = [
  'distinct',
  'order',
  'filter',
  'withinGroup',
];

export const pushHavingSql = <T extends Query>(
  sql: string[],
  model: T,
  having: Exclude<QueryData<T>['having'], undefined>,
  quotedAs?: string,
) => {
  const list: string[] = [];
  having.forEach((item) => {
    if (isRaw(item)) {
      list.push(getRaw(item));
      return;
    }
    for (const key in item) {
      const columns = item[key as keyof Exclude<HavingArg<T>, RawExpression>];
      for (const column in columns) {
        const valueOrOptions = columns[column as keyof typeof columns];
        if (
          typeof valueOrOptions === 'object' &&
          valueOrOptions !== null &&
          valueOrOptions !== undefined
        ) {
          for (const op in valueOrOptions) {
            if (
              !aggregateOptionNames.includes(op as keyof AggregateOptions<T>)
            ) {
              const operator = model.shape[column].operators[
                op
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ] as Operator<any>;
              if (!operator) {
                // TODO: custom error classes
                throw new Error(`Unknown operator ${op} provided to condition`);
              }
              list.push(
                operator(
                  aggregateToSql(
                    {
                      function: key,
                      arg: column,
                      options: valueOrOptions as AggregateOptions<T>,
                    },
                    quotedAs,
                  ),
                  valueOrOptions[op],
                ),
              );
            }
          }
        } else {
          list.push(
            `${aggregateToSql(
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
    }
  });
  sql.push(`HAVING ${list.join(' AND ')}`);
};
