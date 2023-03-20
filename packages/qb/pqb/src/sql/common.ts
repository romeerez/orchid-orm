import { getRaw } from '../raw';
import { Expression } from '../utils';
import { QueryData } from './data';

export type ColumnNamesShape = Record<string, { data: { name?: string } }>;

export const q = (sql: string) => `"${sql}"`;

// quote column with table or as
export const qc = (column: string, quotedAs?: string) =>
  quotedAs ? `${quotedAs}.${q(column)}` : column;

const getJoinedColumnName = (
  data: Pick<QueryData, 'joinedShapes'>,
  shape: ColumnNamesShape,
  table: string,
  key: string,
  isOwnColumn: boolean,
) =>
  ((isOwnColumn ? shape[key] : undefined) || data.joinedShapes?.[table]?.[key])
    ?.data.name;

export const revealColumnToSql = (
  data: Pick<QueryData, 'joinedShapes'>,
  shape: ColumnNamesShape,
  column: string,
  quotedAs?: string,
) => {
  const index = column.indexOf('.');
  if (index !== -1) {
    const table = column.slice(0, index);
    const key = column.slice(index + 1);
    const quoted = q(table);
    return `${quoted}.${q(
      getJoinedColumnName(data, shape, table, key, quoted === quotedAs) || key,
    )}`;
  } else if (quotedAs) {
    return `${quotedAs}.${q(shape[column]?.data.name || column)}`;
  } else {
    return q(shape[column]?.data.name || column);
  }
};

export const revealColumnToSqlWithAs = (
  data: QueryData,
  column: string,
  quotedAs?: string,
) => {
  const index = column.indexOf('.');
  if (index !== -1) {
    const table = column.slice(0, index);
    const key = column.slice(index + 1);
    const quoted = q(table);
    const name = getJoinedColumnName(
      data,
      data.shape,
      table,
      key,
      quoted === quotedAs,
    );
    return `${quoted}.${q(name || key)}${
      name && name !== key ? ` AS ${q(key)}` : ''
    }`;
  } else {
    const name = data.shape[column]?.data.name;
    return `${quotedAs ? `${quotedAs}.` : ''}${q(name || column)}${
      name && name !== column ? ` AS ${q(column)}` : ''
    }`;
  }
};

export const rawOrRevealColumnToSql = (
  data: Pick<QueryData, 'shape' | 'joinedShapes'>,
  expr: Expression,
  values: unknown[],
  quotedAs: string | undefined,
  shape: ColumnNamesShape = data.shape,
) => {
  return typeof expr === 'string'
    ? revealColumnToSql(data, shape, expr, quotedAs)
    : getRaw(expr, values);
};

export const quoteSchemaAndTable = (
  schema: string | undefined,
  table: string,
) => {
  return schema ? `${q(schema)}.${q(table)}` : q(table);
};

export const addValue = (values: unknown[], value: unknown) => {
  values.push(value);
  return `$${values.length}`;
};
