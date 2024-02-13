import { SelectableOrExpression } from '../common/utils';
import { QueryData } from './data';
import { ToSQLCtx } from './toSQL';
import {
  ColumnTypeBase,
  Expression,
  QueryColumn,
  QueryColumns,
} from 'orchid-core';

/**
 * Acts as {@link simpleExistingColumnToSQL} except that the column is optional and will return quoted key if no column.
 */
export function simpleColumnToSQL(
  ctx: ToSQLCtx,
  key: string,
  column?: QueryColumn,
  quotedAs?: string,
): string {
  if (!column) return `"${key}"`;

  const { data } = column as ColumnTypeBase;
  return data.computed
    ? data.computed.toSQL(ctx, quotedAs)
    : `${quotedAs ? `${quotedAs}.` : ''}"${data.name || key}"`;
}

// Takes a column name without dot, and the optional column object.
// Handles computed column, uses column.data.name when set, prefixes regular column with `quotedAs`.
export function simpleExistingColumnToSQL(
  ctx: ToSQLCtx,
  key: string,
  column: QueryColumn,
  quotedAs?: string,
): string {
  const { data } = column as ColumnTypeBase;
  return data.computed
    ? data.computed.toSQL(ctx, quotedAs)
    : `${quotedAs ? `${quotedAs}.` : ''}"${data.name || key}"`;
}

export const columnToSql = (
  ctx: ToSQLCtx,
  data: Pick<QueryData, 'joinedShapes' | 'joinOverrides'>,
  shape: QueryColumns,
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
    const quoted = `"${table}"`;

    const col = (
      quoted === quotedAs ? shape[key] : data.joinedShapes?.[tableName]?.[key]
    ) as ColumnTypeBase | undefined;

    if (col) {
      if (col.data.name) {
        return `"${tableName}"."${col.data.name}"`;
      }

      if (col.data.computed) {
        return `${col.data.computed.toSQL(ctx, quoted)}`;
      }

      return `"${tableName}"."${key}"`;
    }

    return `"${tableName}"."${key}"`;
  }

  if (!select && data.joinedShapes?.[column]) {
    return `"${column}".r`;
  }

  return simpleColumnToSQL(ctx, column, shape[column], quotedAs);
};

export const columnToSqlWithAs = (
  ctx: ToSQLCtx,
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
    const quoted = `"${table}"`;

    const col =
      quoted === quotedAs
        ? data.shape[key]
        : data.joinedShapes?.[tableName][key];
    if (col) {
      if (col.data.name && col.data.name !== key) {
        return `"${tableName}"."${col.data.name}" "${key}"`;
      }

      if (col.data.computed) {
        return `${col.data.computed.toSQL(ctx, quoted)} "${key}"`;
      }
    }

    return `"${tableName}"."${key}"`;
  }

  if (!select && data.joinedShapes?.[column]) {
    return select
      ? `row_to_json("${column}".*) "${column}"`
      : `"${column}".r "${column}"`;
  }

  const col = data.shape[column];
  if (col) {
    if (col.data.name && col.data.name !== column) {
      return `${quotedAs ? `${quotedAs}.` : ''}"${col.data.name}" "${column}"`;
    }

    if (col.data.computed) {
      return `${col.data.computed.toSQL(ctx, quotedAs)} "${column}"`;
    }
  }

  return `${quotedAs ? `${quotedAs}.` : ''}"${column}"`;
};

export const ownColumnToSql = (
  data: QueryData,
  column: string,
  quotedAs?: string,
) => {
  const name = data.shape[column]?.data.name;
  return `${quotedAs ? `${quotedAs}.` : ''}"${name || column}"${
    name && name !== column ? ` "${column}"` : ''
  }`;
};

export const rawOrColumnToSql = (
  ctx: ToSQLCtx,
  data: Pick<QueryData, 'shape' | 'joinedShapes'>,
  expr: SelectableOrExpression,
  quotedAs: string | undefined,
  shape: QueryColumns = data.shape,
  select?: true,
) => {
  return typeof expr === 'string'
    ? columnToSql(ctx, data, shape, expr, quotedAs, select)
    : (expr as Expression).toSQL(ctx, quotedAs);
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
