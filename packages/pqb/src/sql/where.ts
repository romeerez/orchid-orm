import { Query } from '../query';
import { QueryData } from './types';
import { q, qc, quoteFullColumn } from './common';
import { EMPTY_OBJECT, getRaw, isRaw, RawExpression } from '../common';
import { quote } from '../quote';

export const pushWhereSql = (
  sql: string[],
  model: Pick<Query, 'shape'>,
  query: QueryData,
  quotedAs?: string,
  otherTableQuotedAs?: string,
) => {
  const whereConditions = whereToSql(
    model,
    query,
    quotedAs,
    otherTableQuotedAs,
  );
  if (whereConditions.length) sql.push('WHERE', whereConditions);
};

export const whereToSql = (
  model: Pick<Query, 'shape'>,
  query: QueryData,
  quotedAs?: string,
  otherTableQuotedAs?: string,
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
    and.forEach(({ item, not }) => {
      const prefix = not ? 'NOT ' : '';

      if ('prototype' in item || '__model' in item) {
        const query = item as Query;
        const sql = whereToSql(
          query,
          query.query || EMPTY_OBJECT,
          query.table && q(query.table),
        );
        if (sql.length) ands.push(`${prefix}(${sql})`);
        return;
      }

      if (isRaw(item)) {
        ands.push(`${prefix}(${getRaw(item)})`);
        return;
      }

      if ('on' in item && Array.isArray(item.on)) {
        const leftColumn = quoteFullColumn(item.on[0], quotedAs);
        const rightColumn = quoteFullColumn(item.on[2], otherTableQuotedAs);
        const op = item.on[1];
        ands.push(`${prefix}${leftColumn} ${op} ${rightColumn}`);
        return;
      }

      if ('in' in item && typeof item.in === 'object') {
        const arg = item.in as {
          columns: string[];
          values: unknown[][] | Query | RawExpression;
        };
        ands.push(
          `${prefix}(${arg.columns
            .map((column) => quoteFullColumn(column, quotedAs))
            .join(', ')}) IN ${
            Array.isArray(arg.values)
              ? `(${arg.values
                  .map((arr) => `(${arr.map(quote).join(', ')})`)
                  .join(', ')})`
              : isRaw(arg.values)
              ? getRaw(arg.values)
              : `(${arg.values.toSql()})`
          }`,
        );
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
            ands.push(`${prefix}${qc(key, quotedAs)} = ${getRaw(value)}`);
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
                `${prefix}${operator(
                  qc(key, quotedAs),
                  processOperatorArg(
                    value[op as keyof typeof value] as unknown,
                  ),
                )}`,
              );
            }
          }
        } else {
          ands.push(
            `${prefix}${qc(key, quotedAs)} ${
              value === null ? 'IS' : '='
            } ${quote(value)}`,
          );
        }
      }
    });
    ors.push(ands.join(' AND '));
  });

  return ors.join(' OR ');
};

const processOperatorArg = (arg: unknown): string => {
  if (arg && typeof arg === 'object') {
    if (Array.isArray(arg)) {
      return `(${arg.map(quote).join(', ')})`;
    }

    if ('toSql' in arg) {
      return `(${(arg as Query).toSql()})`;
    }

    if (isRaw(arg)) {
      return getRaw(arg);
    }
  }

  return quote(arg);
};
