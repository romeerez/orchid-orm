import { Column } from './column';
import { DomainColumn } from './column-types/custom-type';
import { EnumColumn } from './column-types/enum';

export interface DbStructureDomainsMap {
  [K: string]: Column;
}

export const setColumnDefaultParse = (
  column: Column.Pick.Data,
  parse: (input: any) => unknown, // eslint-disable-line @typescript-eslint/no-explicit-any
) => {
  column.data.parse = parse;
  (column as Column)._parse = (input: unknown) =>
    input === null ? null : parse(input);
};

export const setColumnParse = (
  column: Column.Pick.Data,
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
  column: Column.Pick.Data,
  //
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

export const setColumnDefaultEncode = (
  column: Column.Pick.Data,
  fn: (input: any) => unknown, // eslint-disable-line @typescript-eslint/no-explicit-any
) => {
  column.data.encode = fn;
};

export const setColumnEncode = (
  column: Column.Pick.Data,
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
  column: Column.Pick.Data,
  domainsMap: DbStructureDomainsMap,
  type: string,
) => {
  return column instanceof EnumColumn
    ? 'text'
    : column instanceof DomainColumn
      ? domainsMap[column.dataType]?.dataType
      : type;
};
