import { ColumnsParsers, Query } from '../query';
import { getQueryParsers } from '../common';
import { NotFoundError } from '../errors';

export type Then<Res> = <T extends Query>(
  this: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (value: Res) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
) => Promise<Res | never>;

export const thenAll: Then<unknown[]> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then((result) => {
      const parsers = getQueryParsers(this);
      return parsers
        ? result.rows.map((row) => parseRecord(parsers, row))
        : result.rows;
    })
    .then(resolve, reject);
};

export const thenOne: Then<unknown> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then((result) => {
      const row = result.rows[0];
      if (!row) return;

      const parsers = getQueryParsers(this);
      return parsers ? parseRecord(parsers, row) : row;
    })
    .then(resolve, reject);
};

export const thenOneOrThrow: Then<unknown> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then((result) => {
      const row = result.rows[0];
      if (!row) throw new NotFoundError();

      const parsers = getQueryParsers(this);
      return parsers ? parseRecord(parsers, row) : row;
    })
    .then(resolve, reject);
};

export const thenRows: Then<unknown[][]> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => {
      const parsers = getQueryParsers(this);
      return parsers
        ? parseRows(parsers, result.fields, result.rows)
        : result.rows;
    })
    .then(resolve, reject);
};

export const thenPluck: Then<unknown[]> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => {
      const parsers = getQueryParsers(this);
      if (parsers?.pluck) {
        return result.rows.map((row) => parsers.pluck(row[0]));
      }
      return result.rows.map((row) => row[0]);
    })
    .then(resolve, reject);
};

export const thenValue: Then<unknown> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => {
      const value = result.rows[0]?.[0];
      return value !== undefined
        ? parseValue(value, result.fields, this)
        : undefined;
    })
    .then(resolve, reject);
};

export const thenValueOrThrow: Then<unknown> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => {
      const value = result.rows[0]?.[0];
      if (value === undefined) throw new NotFoundError();

      return parseValue(value, result.fields, this);
    })
    .then(resolve, reject);
};

export const thenVoid: Then<void> = function (resolve, reject) {
  return this.adapter.query(this.toSql()).then(() => resolve?.(), reject);
};

export const thenRowsCount: Then<number> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then(({ rowCount }) => resolve?.(rowCount), reject);
};

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
