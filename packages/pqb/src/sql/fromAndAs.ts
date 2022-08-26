import { getRaw, isRaw } from '../common';
import { quoteSchemaAndTable } from './common';
import { Query } from '../query';
import { SelectQueryData } from './types';

export const pushFromAndAs = (
  sql: string[],
  model: Query,
  query: SelectQueryData,
  values: unknown[],
  quotedAs?: string,
) => {
  if (!query.from && !model.table) return;

  sql.push('FROM');
  if (query.fromOnly) sql.push('ONLY');

  const from = getFrom(model, query, values);
  sql.push(from);

  if (query.as && quotedAs && quotedAs !== from) {
    sql.push('AS', quotedAs as string);
  }
};

const getFrom = (model: Query, query: SelectQueryData, values: unknown[]) => {
  if (query.from) {
    if (typeof query.from === 'object') {
      if (isRaw(query.from)) {
        return getRaw(query.from, values);
      }

      if (!query.from.table) {
        const sql = query.from.toSql(values);
        return `(${sql.text})`;
      }

      const keys = query.from.query && Object.keys(query.from.query);
      // if query is present, and it contains more than just schema return (SELECT ...)
      if (keys && (keys.length !== 1 || keys[0] !== 'schema')) {
        const sql = query.from.toSql(values);
        return `(${sql.text})`;
      }

      return quoteSchemaAndTable(query.from.query?.schema, query.from.table);
    }

    return quoteSchemaAndTable(query.schema, query.from);
  }

  return quoteSchemaAndTable(query.schema, model.table as string);
};
