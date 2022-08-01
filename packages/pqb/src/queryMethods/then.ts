import { ColumnsParsers, Query } from '../query';
import { getQueryParsers } from '../common';

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

export const thenValue: Then<unknown> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => {
      const value = result.rows[0]?.[0];
      const field = result.fields[0];
      if (value !== null) {
        const parsers = getQueryParsers(this);
        if (parsers?.[field.name]) {
          return parsers[field.name](value);
        }
      }
      return value;
    })
    .then(resolve, reject);
};

export const thenVoid: Then<void> = function (resolve, reject) {
  return this.adapter.query(this.toSql()).then(() => resolve?.(), reject);
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
