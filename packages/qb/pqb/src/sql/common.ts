import { SelectableOrExpression } from '../utils';
import { QueryData } from './data';
import { ToSqlCtx } from './toSql';

export type ColumnNamesShape = Record<string, { data: { name?: string } }>;

export const q = (sql: string) => `"${sql}"`;

// quote column with table or as
export const qc = (column: string, quotedAs?: string) =>
  quotedAs ? `${quotedAs}."${column}"` : column;

const getJoinedColumnName = (
  data: Pick<QueryData, 'joinedShapes'>,
  shape: ColumnNamesShape,
  table: string,
  key: string,
  isOwnColumn: boolean,
) =>
  ((isOwnColumn ? shape[key] : undefined) || data.joinedShapes?.[table]?.[key])
    ?.data.name;

export const columnToSql = (
  data: Pick<QueryData, 'joinedShapes' | 'joinOverrides'>,
  shape: ColumnNamesShape,
  column: string,
  quotedAs?: string,
  select?: true,
) => {
  const index = column.indexOf('.');
  if (index !== -1) {
    const table = column.slice(0, index);
    const key = column.slice(index + 1);
    if (key === '*') {
      if (data.joinedShapes?.[table]) {
        return select ? `row_to_json("${table}".*)` : `"${table}".r`;
      }
      return column;
    }

    const tableName = data.joinOverrides?.[table] || table;
    return `"${tableName}"."${
      getJoinedColumnName(
        data,
        shape,
        tableName,
        key,
        `"${table}"` === quotedAs,
      ) || key
    }"`;
  } else if (!select && data.joinedShapes?.[column]) {
    return select ? `row_to_json("${column}".*)` : `"${column}".r`;
  } else if (quotedAs && shape[column]) {
    return `${quotedAs}."${shape[column].data.name || column}"`;
  } else {
    return `"${shape[column]?.data.name || column}"`;
  }
};

export const columnToSqlWithAs = (
  data: QueryData,
  column: string,
  quotedAs?: string,
  select?: true,
) => {
  const index = column.indexOf('.');
  if (index !== -1) {
    const table = column.slice(0, index);
    const key = column.slice(index + 1);
    if (key === '*') {
      if (data.joinedShapes?.[table]) {
        return select
          ? `row_to_json("${table}".*) "${table}"`
          : `"${table}".r "${table}"`;
      }
      return column;
    }

    const tableName = data.joinOverrides?.[table] || table;
    const name = getJoinedColumnName(
      data,
      data.shape,
      table,
      key,
      `"${table}"` === quotedAs,
    );
    return `"${tableName}"."${name || key}"${
      name && name !== key ? ` AS "${key}"` : ''
    }`;
  }

  if (!select && data.joinedShapes?.[column]) {
    return select
      ? `row_to_json("${column}".*) "${column}"`
      : `"${column}".r "${column}"`;
  }

  return ownColumnToSql(data, column, quotedAs);
};

export const ownColumnToSql = (
  data: QueryData,
  column: string,
  quotedAs?: string,
) => {
  const name = data.shape[column]?.data.name;
  return `${quotedAs ? `${quotedAs}.` : ''}"${name || column}"${
    name && name !== column ? ` AS "${column}"` : ''
  }`;
};

export const rawOrColumnToSql = (
  ctx: ToSqlCtx,
  data: Pick<QueryData, 'shape' | 'joinedShapes'>,
  expr: SelectableOrExpression,
  quotedAs: string | undefined,
  shape: ColumnNamesShape = data.shape,
  select?: true,
) => {
  return typeof expr === 'string'
    ? columnToSql(data, shape, expr, quotedAs, select)
    : expr.toSQL(ctx, quotedAs);
};

export const quoteSchemaAndTable = (
  schema: string | undefined,
  table: string,
) => {
  return schema ? `"${schema}"."${table}"` : `"${table}"`;
};

export const addValue = (values: unknown[], value: unknown) => {
  values.push(value);
  return `$${values.length}`;
};
