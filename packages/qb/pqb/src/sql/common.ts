import { SelectableOrExpression } from '../common/utils';
import { PickQueryDataShapeAndJoinedShapes, QueryData } from './data';
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
  data: {
    joinedShapes?: QueryData['joinedShapes'];
    joinOverrides?: QueryData['joinOverrides'];
  },
  shape: QueryColumns,
  column: string,
  quotedAs?: string,
  select?: true,
) => {
  const index = column.indexOf('.');
  if (index !== -1) {
    return columnWithDotToSql(
      ctx,
      data,
      shape,
      column,
      index,
      quotedAs,
      select,
    );
  }

  if (!select && data.joinedShapes?.[column]) {
    return `"${column}".r`;
  }

  return simpleColumnToSQL(ctx, column, shape[column], quotedAs);
};

/**
 * in a case when ordering or grouping by a column which was selected as expression:
 * ```ts
 * table.select({ x: (q) => q.sum('x') }).group('x').order('x')
 * ```
 * the column must not be prefixed with a table name.
 */
export const maybeSelectedColumnToSql = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  quotedAs?: string,
) => {
  const index = column.indexOf('.');
  if (index !== -1) {
    return columnWithDotToSql(ctx, data, data.shape, column, index, quotedAs);
  } else {
    if (data.joinedShapes?.[column]) {
      return `"${column}".r`;
    }

    if (data.select) {
      for (const s of data.select) {
        if (typeof s === 'object' && 'selectAs' in s) {
          if (column in s.selectAs) {
            return simpleColumnToSQL(ctx, column, data.shape[column]);
          }
        }
      }
    }

    return simpleColumnToSQL(ctx, column, data.shape[column], quotedAs);
  }
};

const columnWithDotToSql = (
  ctx: ToSQLCtx,
  data: {
    joinedShapes?: QueryData['joinedShapes'];
    joinOverrides?: QueryData['joinOverrides'];
  },
  shape: QueryColumns,
  column: string,
  index: number,
  quotedAs?: string,
  select?: true,
) => {
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
};

export const columnToSqlWithAs = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  quotedAs?: string,
  select?: true,
) => {
  const index = column.indexOf('.');
  return index !== -1
    ? tableColumnToSqlWithAs(
        ctx,
        data,
        column,
        column.slice(0, index),
        column.slice(index + 1),
        quotedAs,
        select,
      )
    : ownColumnToSqlWithAs(ctx, data, column, quotedAs, select);
};

export const tableColumnToSqlWithAs = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  table: string,
  key: string,
  quotedAs?: string,
  select?: true,
) => {
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
    quoted === quotedAs ? data.shape[key] : data.joinedShapes?.[tableName][key];
  if (col) {
    if (col.data.name && col.data.name !== key) {
      return `"${tableName}"."${col.data.name}" "${key}"`;
    }

    if (col.data.computed) {
      return `${col.data.computed.toSQL(ctx, quoted)} "${key}"`;
    }
  }

  return `"${tableName}"."${key}"`;
};

export const ownColumnToSqlWithAs = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  quotedAs?: string,
  select?: true,
) => {
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
  data: PickQueryDataShapeAndJoinedShapes,
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
