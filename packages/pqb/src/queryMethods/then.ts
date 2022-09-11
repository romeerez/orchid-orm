import { ColumnsParsers, Query, QueryReturnType } from '../query';
import { getQueryParsers } from '../common';
import { NotFoundError } from '../errors';
import { QueryArraysResult } from '../adapter';
import { CommonQueryData } from '../sql';

export type ThenResult<Res> = <T extends Query>(
  this: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (value: Res) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
) => Promise<Res | never>;

const queryMethod: Record<QueryReturnType, 'query' | 'arrays'> = {
  all: 'query',
  one: 'query',
  oneOrThrow: 'query',
  rows: 'arrays',
  pluck: 'arrays',
  value: 'arrays',
  valueOrThrow: 'arrays',
  rowCount: 'arrays',
  void: 'arrays',
};

export class Then {
  async then(
    this: Query,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve?: (result: any) => any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject?: (error: any) => any,
  ) {
    let beforeCallbacks: CommonQueryData['beforeQuery'];
    let afterCallbacks: CommonQueryData['afterQuery'];
    if (this.query) {
      if (this.query.type === 'insert') {
        beforeCallbacks = this.query.beforeInsert;
        afterCallbacks = this.query.afterInsert;
      }

      if (beforeCallbacks) {
        await Promise.all(beforeCallbacks.map((cb) => cb(this)));
      }

      if (this.query.beforeQuery) {
        await Promise.all(this.query.beforeQuery.map((cb) => cb(this)));
      }
    }

    const { returnType } = this;
    return this.adapter[queryMethod[returnType] as 'query'](this.toSql())
      .then((result) => {
        switch (returnType) {
          case 'all': {
            const parsers = getQueryParsers(this);
            return parsers
              ? result.rows.map((row) => parseRecord(parsers, row))
              : result.rows;
          }
          case 'one': {
            const row = result.rows[0];
            if (!row) return;

            const parsers = getQueryParsers(this);
            return parsers ? parseRecord(parsers, row) : row;
          }
          case 'oneOrThrow': {
            const row = result.rows[0];
            if (!row) throw new NotFoundError();

            const parsers = getQueryParsers(this);
            return parsers ? parseRecord(parsers, row) : row;
          }
          case 'rows': {
            const parsers = getQueryParsers(this);
            return parsers
              ? parseRows(
                  parsers,
                  (result as unknown as QueryArraysResult).fields,
                  result.rows,
                )
              : result.rows;
          }
          case 'pluck': {
            const parsers = getQueryParsers(this);
            if (parsers?.pluck) {
              return result.rows.map((row) => parsers.pluck(row[0]));
            }
            return result.rows.map((row) => row[0]);
          }
          case 'value': {
            const value = result.rows[0]?.[0];
            return value !== undefined
              ? parseValue(
                  value,
                  (result as unknown as QueryArraysResult).fields,
                  this,
                )
              : undefined;
          }
          case 'valueOrThrow': {
            const value = result.rows[0]?.[0];
            if (value === undefined) throw new NotFoundError();

            return parseValue(
              value,
              (result as unknown as QueryArraysResult).fields,
              this,
            );
          }
          case 'rowCount': {
            return result.rowCount;
          }
          case 'void': {
            return;
          }
        }
      })
      .then(
        afterCallbacks?.length || this.query?.afterQuery?.length
          ? async (result) => {
              if (this.query?.afterQuery?.length) {
                await Promise.all(
                  this.query?.afterQuery.map((query) => query(this, result)),
                );
              }

              if (afterCallbacks?.length) {
                await Promise.all(
                  afterCallbacks.map((query) => query(this, result)),
                );
              }

              resolve?.(result);
            }
          : resolve,
        reject,
      );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseRecord = (parsers: ColumnsParsers, row: any) => {
  for (const key in parsers) {
    if (row[key] !== null && row[key] !== undefined) {
      row[key] = parsers[key](row[key]);
    }
  }
  return row;
};

const parseRows = (
  parsers: ColumnsParsers,
  fields: { name: string }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
) => {
  fields.forEach((field, i) => {
    const parser = parsers[field.name];
    if (parser) {
      rows.forEach((row) => {
        row[i] = parser(row[i]);
      });
    }
  });
  return rows;
};

const parseValue = (
  value: unknown,
  fields: { name: string }[],
  query: Query,
) => {
  const field = fields[0];
  if (value !== null) {
    const parsers = getQueryParsers(query);
    const parser = parsers?.[field.name];
    if (parser) {
      return parser(value);
    }
  }
  return value;
};
