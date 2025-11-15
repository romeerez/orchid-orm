import {
  ColumnsParsers,
  ColumnTypeBase,
  getValueKey,
  QueryColumn,
  setObjectValueImmutable,
} from '../core';
import { ColumnType } from './columnType';
import { DomainColumn } from './customType';
import { EnumColumn } from './column-types/enum';

export interface DbStructureDomainsMap {
  [K: string]: ColumnType;
}

export const addColumnParserToQuery = (
  q: { parsers?: ColumnsParsers },
  key: string | getValueKey,
  column: QueryColumn,
) => {
  if ((column as ColumnTypeBase)._parse) {
    setObjectValueImmutable(
      q,
      'parsers',
      key,
      (column as ColumnTypeBase)._parse,
    );
  }
};

export const setColumnDefaultParse = (
  column: ColumnTypeBase,
  parse: (input: any) => unknown, // eslint-disable-line @typescript-eslint/no-explicit-any
) => {
  column.data.parse = parse;
  column._parse = (input: unknown) => (input === null ? null : parse(input));
};

export const setColumnParse = (
  column: ColumnTypeBase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (input: any) => unknown,
  outputSchema?: unknown,
) => {
  const c = Object.create(column);
  c.outputSchema = outputSchema;
  c.data = { ...column.data, parse: fn };

  const { parseNull } = column.data;
  c._parse = parseNull
    ? (input: unknown) => (input === null ? parseNull() : fn(input))
    : (input: unknown) => (input === null ? null : fn(input));

  return c;
};

export const setColumnParseNull = (
  column: ColumnTypeBase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: () => unknown,
  nullSchema?: unknown,
) => {
  const c = Object.create(column);
  c.nullSchema = nullSchema;
  c.data = { ...column.data, parseNull: fn };

  const { parse } = column.data;
  c._parse = parse
    ? (input: unknown) => (input === null ? fn() : parse(input))
    : (input: unknown) => (input === null ? fn() : input);

  return c;
};

export const setColumnEncode = (
  column: ColumnTypeBase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (input: any) => unknown,
  inputSchema?: unknown,
) => {
  const c = Object.create(column);
  c.inputSchema = inputSchema;
  c.data = { ...column.data, encode: fn };
  return c;
};

export const getColumnBaseType = (
  column: ColumnTypeBase,
  domainsMap: DbStructureDomainsMap,
  type: string,
) => {
  return column instanceof EnumColumn
    ? 'text'
    : column instanceof DomainColumn
    ? domainsMap[column.dataType]?.dataType
    : type;
};
