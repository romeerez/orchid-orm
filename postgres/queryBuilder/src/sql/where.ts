import { Query } from '../query';
import { QueryData } from './types';
import { EMPTY_OBJECT, q, qc, quoteFullColumn } from './common';
import { getRaw, isRaw } from '../common';
import { quote } from '../quote';

export const whereToSql = (
  model: Query,
  query: QueryData,
  quotedAs: string,
  otherTableQuotedAs: string = quotedAs,
): string => {
  const or =
    query.and && query.or
      ? [query.and, ...query.or]
      : query.and
      ? [query.and]
      : query.or;
  if (!or?.length) return '';

  const ors: string[] = [];
  or.forEach((and) => {
    const ands: string[] = [];
    and.forEach((item) => {
      if ('prototype' in item || '__model' in item) {
        const query = item as Query;
        const sql = whereToSql(
          query,
          query.query || EMPTY_OBJECT,
          q(query.table),
        );
        if (sql.length) ands.push(`(${sql})`);
        return;
      }

      if (isRaw(item)) {
        ands.push(`(${getRaw(item)})`);
        return;
      }

      if (Array.isArray(item)) {
        const leftColumn = quoteFullColumn(quotedAs, item[0]);
        const rightColumn = quoteFullColumn(otherTableQuotedAs, item[2]);
        const op = item[1];
        ands.push(`${leftColumn} ${op} ${rightColumn}`);
        return;
      }

      for (const key in item) {
        const value = (item as Record<string, object>)[key];
        if (
          typeof value === 'object' &&
          value !== null &&
          value !== undefined
        ) {
          if (isRaw(value)) {
            ands.push(`${qc(quotedAs, key)} = ${getRaw(value)}`);
          } else {
            const column = model.shape[key];
            if (!column) {
              // TODO: custom error classes
              throw new Error(`Unknown column ${key} provided to condition`);
            }

            for (const op in value) {
              const operator = column.operators[op];
              if (!operator) {
                // TODO: custom error classes
                throw new Error(`Unknown operator ${op} provided to condition`);
              }

              ands.push(
                operator(qc(quotedAs, key), value[op as keyof typeof value]),
              );
            }
          }
        } else {
          ands.push(
            `${qc(quotedAs, key)} ${value === null ? 'IS' : '='} ${quote(
              value,
            )}`,
          );
        }
      }
    });
    ors.push(ands.join(' AND '));
  });

  return ors.join(' OR ');
};
