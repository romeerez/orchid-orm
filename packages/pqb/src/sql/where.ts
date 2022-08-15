import { Query } from '../query';
import { QueryData, SelectQueryData } from './types';
import { addValue, q, qc, quoteFullColumn } from './common';
import { EMPTY_OBJECT, getRaw, isRaw, raw, RawExpression } from '../common';

export const pushWhereSql = (
  sql: string[],
  model: Pick<Query, 'shape'>,
  query: Pick<QueryData, 'and' | 'or'>,
  values: unknown[],
  quotedAs?: string,
  otherTableQuotedAs?: string,
) => {
  const whereConditions = whereToSql(
    model,
    query,
    values,
    quotedAs,
    otherTableQuotedAs,
  );
  if (whereConditions) {
    sql.push('WHERE', whereConditions);
  }
};

export const whereToSql = (
  model: Pick<Query, 'shape'>,
  query: Pick<QueryData, 'and' | 'or'>,
  values: unknown[],
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
            values,
            query.table && q(query.table),
          );
          if (sql[0]) {
            ands.push(`${prefix}(${sql})`);
          }
          return;
        }

        if (isRaw(data)) {
          ands.push(`${prefix}(${getRaw(data, values)})`);
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
              ands.push(
                `${prefix}${qc(key, quotedAs)} = ${getRaw(value, values)}`,
              );
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

                ands.push(
                  `${prefix}${operator(
                    qc(key, quotedAs),
                    value[op as keyof typeof value],
                    values,
                  )}`,
                );
              }
            }
          } else {
            ands.push(
              `${prefix}${qc(key, quotedAs)} ${
                value === null ? 'IS NULL' : `= ${addValue(values, value)}`
              }`,
            );
          }
        }
        return;
      }

      if (item.type === 'on') {
        const leftColumn = quoteFullColumn(item.on[0], quotedAs);
        const [op, rightColumn] =
          item.on.length === 2
            ? ['=', quoteFullColumn(item.on[1], otherTableQuotedAs)]
            : [item.on[1], quoteFullColumn(item.on[2], otherTableQuotedAs)];
        ands.push(`${prefix}${leftColumn} ${op} ${rightColumn}`);
        return;
      }

      if (item.type === 'in') {
        pushIn(ands, prefix, quotedAs, values, item, 'IN');
        return;
      }

      if (item.type === 'notIn') {
        pushIn(ands, prefix, quotedAs, values, item, 'NOT IN');
        return;
      }

      if (item.type === 'exists') {
        let querySql: string;
        if (isRaw(item.query)) {
          querySql = getRaw(item.query, values);
        } else {
          const q = item.query.clone();
          const query = q.query as SelectQueryData;
          query.select = [raw('1')];
          query.limit = 1;
          const sql = q.toSql(values);
          querySql = sql.text;
        }

        ands.push(`${prefix}EXISTS (${querySql})`);
      }

      if (item.type === 'onJsonPathEquals') {
        const leftColumn = quoteFullColumn(item.data[0], quotedAs);
        const leftPath = item.data[1];
        const rightColumn = quoteFullColumn(item.data[2], otherTableQuotedAs);
        const rightPath = item.data[3];

        ands.push(
          `${prefix}jsonb_path_query_first(${leftColumn}, ${addValue(
            values,
            leftPath,
          )}) = jsonb_path_query_first(${rightColumn}, ${addValue(
            values,
            rightPath,
          )})`,
        );
        return;
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
  values: unknown[],
  arg: {
    columns: string[];
    values: unknown[][] | Query | RawExpression;
  },
  op: 'IN' | 'NOT IN',
) => {
  let value: string;

  if (Array.isArray(arg.values)) {
    value = `(${arg.values
      .map(
        (arr) => `(${arr.map((value) => addValue(values, value)).join(', ')})`,
      )
      .join(', ')})`;
  } else if (isRaw(arg.values)) {
    value = getRaw(arg.values, values);
  } else {
    const sql = arg.values.toSql(values);
    value = `(${sql.text})`;
  }

  ands.push(
    `${prefix}(${arg.columns
      .map((column) => quoteFullColumn(column, quotedAs))
      .join(', ')}) ${op} ${value}`,
  );
};
