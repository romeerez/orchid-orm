import { getRaw, isRaw } from '../common';
import { quoteSchemaAndTable } from './common';
import { Query } from '../query';
import { SelectQueryData } from './types';

export const pushFromAndAs = (
  sql: string[],
  model: Query,
  query: SelectQueryData,
  quotedAs?: string,
) => {
  if (!query.from && !model.table) return;

  sql.push('FROM');
  if (query.fromOnly) sql.push('ONLY');

  const from = getFrom(model, query);
  sql.push(from);

  if (query.as && quotedAs !== from) {
    sql.push('AS', quotedAs as string);
  }
};

const getFrom = (model: Query, query: SelectQueryData) => {
  if (query.from) {
    if (typeof query.from === 'object') {
      if (isRaw(query.from)) {
        return getRaw(query.from);
      }

      if (!query.from.table) {
        return `(${query.from.toSql()})`;
      }

      const keys = query.from.query && Object.keys(query.from.query);
      // if query is present, and it contains more than just schema return (SELECT ...)
      if (keys && (keys.length !== 1 || keys[0] !== 'schema')) {
        return `(${query.from.toSql()})`;
      }

      return quoteSchemaAndTable(query.from.query?.schema, query.from.table);
    }

    return quoteSchemaAndTable(query.schema, query.from);
  }

  return quoteSchemaAndTable(query.schema, model.table as string);
};
