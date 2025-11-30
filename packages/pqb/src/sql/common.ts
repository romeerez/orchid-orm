import { SelectableOrExpression } from '../common/utils';
import { PickQueryDataShapeAndJoinedShapes, QueryData } from './data';
import { ToSQLCtx } from './to-sql';
import {
  _getQueryAliasOrName,
  ColumnsParsers,
  Expression,
  RecordString,
} from '../core';
import { Column } from '../columns/column';

/**
 * Acts as {@link simpleExistingColumnToSQL} except that the column is optional and will return quoted key if no column.
 */
export function simpleColumnToSQL(
  ctx: ToSQLCtx,
  key: string,
  column?: Column.Pick.QueryColumn,
  quotedAs?: string,
): string {
  if (!column) return `"${key}"`;

  const { data } = column as unknown as Column.Pick.Data;
  return data.computed
    ? data.computed.toSQL(ctx, quotedAs)
    : `${quotedAs ? `${quotedAs}.` : ''}"${data.name || key}"`;
}

// Takes a column name without a dot and the optional column object.
// Handles computed column, uses column.data.name when set, prefixes regular column with `quotedAs`.
export function simpleExistingColumnToSQL(
  ctx: ToSQLCtx,
  key: string,
  column: Column.Pick.QueryColumn,
  quotedAs?: string,
): string {
  const { data } = column as unknown as Column.Pick.Data;
  return data.computed
    ? data.computed.toSQL(ctx, quotedAs)
    : `${quotedAs ? `${quotedAs}.` : ''}"${data.name || key}"`;
}

export const columnToSql = (
  ctx: ToSQLCtx,
  data: {
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
  },
  shape: Column.QueryColumns,
  column: string,
  quotedAs?: string,
  select?: true,
): string => {
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
    return `"${column}"."${column}"`;
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
): string => {
  const index = column.indexOf('.');
  if (index !== -1) {
    return columnWithDotToSql(ctx, data, data.shape, column, index, quotedAs);
  } else {
    if (data.joinedShapes?.[column]) {
      return `"${column}"."${column}"`;
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
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
  },
  shape: Column.QueryColumns,
  column: string,
  index: number,
  quotedAs?: string,
  select?: true,
): string => {
  const table = column.slice(0, index);
  const key = column.slice(index + 1);
  if (key === '*') {
    const shape = data.joinedShapes?.[table];
    return shape
      ? select
        ? makeRowToJson(table, shape as never, true)
        : `"${table}".*`
      : column;
  }

  const tableName = _getQueryAliasOrName(data, table);
  const quoted = `"${table}"`;

  const col = (quoted === quotedAs
    ? shape[key]
    : data.joinedShapes?.[tableName]?.[key]) as unknown as
    | Column.Pick.Data
    | undefined;

  if (col) {
    if (col.data.name) {
      return `"${tableName}"."${col.data.name}"`;
    }

    if (col.data.computed) {
      return col.data.computed.toSQL(ctx, quoted);
    }

    return `"${tableName}"."${key}"`;
  }

  return `"${tableName}"."${key}"`;
};

export const columnToSqlWithAs = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  as: string,
  quotedAs?: string,
  select?: true,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
): string => {
  const index = column.indexOf('.');
  return index !== -1
    ? tableColumnToSqlWithAs(
        ctx,
        data,
        column,
        column.slice(0, index),
        column.slice(index + 1),
        as,
        quotedAs,
        select,
        jsonList,
      )
    : ownColumnToSqlWithAs(ctx, data, column, as, quotedAs, select, jsonList);
};

export const tableColumnToSqlWithAs = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  table: string,
  key: string,
  as: string,
  quotedAs?: string,
  select?: true,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
): string => {
  if (key === '*') {
    if (jsonList) jsonList[as] = undefined;

    const shape = data.joinedShapes?.[table];
    if (shape) {
      if (select) {
        return makeRowToJson(table, shape as never, true) + ` "${as}"`;
      }

      return `"${table}"."${table}" "${as}"`;
    }

    return column;
  }

  const tableName = _getQueryAliasOrName(data, table);
  const quoted = `"${table}"`;

  const col = (quoted === quotedAs
    ? data.shape[key]
    : data.joinedShapes?.[tableName][key]) as unknown as Column.Pick.Data;

  if (jsonList) jsonList[as] = col as never;

  if (col) {
    if (col.data.name && col.data.name !== key) {
      return `"${tableName}"."${col.data.name}" "${as}"`;
    }

    if (col.data.computed) {
      return `${col.data.computed.toSQL(ctx, quoted)} "${as}"`;
    }
  }

  return `"${tableName}"."${key}"${key === as ? '' : ` "${as}"`}`;
};

export const ownColumnToSqlWithAs = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  as: string,
  quotedAs?: string,
  select?: true,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
): string => {
  if (!select && data.joinedShapes?.[column]) {
    if (jsonList) jsonList[as] = undefined;

    return `"${column}"."${column}" "${as}"`;
  }

  const col = data.shape[column];

  if (jsonList) jsonList[as] = col;

  if (col) {
    if (col.data.name && col.data.name !== column) {
      return `${quotedAs ? `${quotedAs}.` : ''}"${col.data.name}"${
        col.data.name === as ? '' : ` "${as}"`
      }`;
    }

    if (col.data.computed) {
      return `${col.data.computed.toSQL(ctx, quotedAs)} "${as}"`;
    }
  }

  return `${quotedAs ? `${quotedAs}.` : ''}"${column}"${
    column === as ? '' : ` "${as}"`
  }`;
};

export const ownColumnToSql = (
  data: QueryData,
  column: string,
  quotedAs?: string,
): string => {
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
  shape: Column.QueryColumns = data.shape,
  select?: true,
): string => {
  return typeof expr === 'string'
    ? columnToSql(ctx, data, shape, expr, quotedAs, select)
    : (expr as Expression).toSQL(ctx, quotedAs);
};

export const quoteSchemaAndTable = (
  schema: string | undefined,
  table: string,
): string => {
  return schema ? `"${schema}"."${table}"` : `"${table}"`;
};

export const makeRowToJson = (
  table: string,
  shape: Column.Shape.Data,
  aliasName: boolean,
  includingExplicitSelect?: boolean,
): string => {
  let isSimple = true;
  const list: string[] = [];

  for (const key in shape) {
    const column = shape[key];
    if (!includingExplicitSelect && column.data.explicitSelect) {
      continue;
    }

    if ((aliasName && column.data.name) || column.data.jsonCast) {
      isSimple = false;
    }

    list.push(
      `'${key}', "${table}"."${(aliasName && column.data.name) || key}"${
        column.data.jsonCast ? `::${column.data.jsonCast}` : ''
      }`,
    );
  }

  return isSimple
    ? `row_to_json("${table}".*)`
    : `CASE WHEN "${table}".* IS NULL THEN NULL ELSE json_build_object(` +
        list.join(', ') +
        ') END';
};
