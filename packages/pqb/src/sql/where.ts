import { Query } from '../query';
import { QueryData, SelectQueryData } from './types';
import { q, qc, quoteFullColumn } from './common';
import { EMPTY_OBJECT, getRaw, isRaw, raw, RawExpression } from '../common';
import { quote } from '../quote';
import { pushOperatorSql } from './operator';

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

      if (item.type === 'object') {
        const { data } = item;

        if ('prototype' in data || '__model' in data) {
          const query = data as Query;
          const sql = whereToSql(
            query,
            query.query || EMPTY_OBJECT,
            query.table && q(query.table),
          );
          if (sql.length) ands.push(`${prefix}(${sql})`);
          return;
        }

        if (isRaw(data)) {
          ands.push(`${prefix}(${getRaw(data)})`);
          return;
        }

        for (const key in data) {
          const value = (data as Record<string, object>)[key];
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
                  throw new Error(
                    `Unknown operator ${op} provided to condition`,
                  );
                }

                pushOperatorSql(
                  ands,
                  prefix,
                  operator,
                  qc(key, quotedAs),
                  value,
                  op,
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
        return;
      }

      if (item.type === 'on') {
        const leftColumn = quoteFullColumn(item.on[0], quotedAs);
        const rightColumn = quoteFullColumn(item.on[2], otherTableQuotedAs);
        const op = item.on[1];
        ands.push(`${prefix}${leftColumn} ${op} ${rightColumn}`);
        return;
      }

      if (item.type === 'in') {
        pushIn(ands, prefix, quotedAs, item, 'IN');
        return;
      }

      if (item.type === 'notIn') {
        pushIn(ands, prefix, quotedAs, item, 'NOT IN');
        return;
      }

      if (item.type === 'exists') {
        let querySql: string;
        if (isRaw(item.query)) {
          querySql = getRaw(item.query);
        } else {
          if (!item.query.query) item.query.query = {};
          const query = item.query.query as SelectQueryData;
          query.select = [raw('1')];
          query.limit = 1;
          querySql = item.query.toSql();
        }

        ands.push(`${prefix}EXISTS (${querySql})`);
      }
    });
    ors.push(ands.join(' AND '));
  });

  return ors.join(' OR ');
};

const pushIn = (
  ands: string[],
  prefix: string,
  quotedAs: string | undefined,
  arg: {
    columns: string[];
    values: unknown[][] | Query | RawExpression;
  },
  op: 'IN' | 'NOT IN',
) => {
  ands.push(
    `${prefix}(${arg.columns
      .map((column) => quoteFullColumn(column, quotedAs))
      .join(', ')}) ${op} ${
      Array.isArray(arg.values)
        ? `(${arg.values
            .map((arr) => `(${arr.map(quote).join(', ')})`)
            .join(', ')})`
        : isRaw(arg.values)
        ? getRaw(arg.values)
        : `(${arg.values.toSql()})`
    }`,
  );
};
