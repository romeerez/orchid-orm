import { JoinedShapes, QueryData } from '../query-data';
import { ToSQLCtx } from './to-sql';
import { Column } from '../../columns/column';
import { RecordString } from '../../utils';
import { ColumnsParsers } from '../query-columns/query-column-parsers';
import { _getQueryAliasOrName } from '../basic-features/as/as';
import { Expression, SelectableOrExpression } from '../expressions/expression';
import { getSelectedColumnData, makeRowToJson } from './sql';
import { SelectItem } from '../basic-features/select/select.sql';

// Takes a column name without a dot and the optional column object.
// Handles computed column, uses column.data.name when set, prefixes regular column with `quotedAs`.
// Returns quoted key if no column is provided.
export function simpleColumnToSQL(
  ctx: ToSQLCtx,
  queryData: {
    select?: SelectItem[];
    joinedShapes?: JoinedShapes;
  },
  shape: Column.QueryColumns,
  key: string,
  column?: Column.Pick.QueryColumn,
  quotedAs?: string,
  select?: true,
  as?: string,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
  useSelectList?: true,
  skipSelectSql?: true,
): string {
  let sql: string;
  let dontAlias: boolean | undefined;

  if (useSelectList && queryData.select) {
    for (const s of queryData.select) {
      if (typeof s === 'object' && 'selectAs' in s) {
        if (key in s.selectAs) {
          dontAlias = true;
          sql = simpleColumnToSQL(ctx, queryData, shape, key, shape[key]);
          break;
        }
      }
    }
  }

  // @ts-ignore
  if (!sql) {
    if (!column) {
      dontAlias = key === as;
      sql = `${quotedAs ? `${quotedAs}.` : ''}"${key}"`;
    } else {
      if (jsonList && as) {
        jsonList[as] = column && getSelectedColumnData(column as Column);
      }

      const { data } = column as unknown as Column.Pick.Data;
      if (select && data.selectSql && !skipSelectSql) {
        sql = `(${data.selectSql.toSQL(ctx, quotedAs)})`;
      } else if (data.computed) {
        sql = `(${data.computed.toSQL(ctx, quotedAs)})`;
      } else {
        const name = data.name || key;
        dontAlias = name === as;
        sql = `${quotedAs ? `${quotedAs}.` : ''}"${name}"`;
      }
    }
  }

  if (as && !dontAlias) {
    sql = `${sql} "${as}"`;
  }

  return sql;
}

export const tableColumnToSql = (
  ctx: ToSQLCtx,
  data: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
  },
  shape: Column.QueryColumns,
  table: string,
  key: string,
  quotedAs?: string,
  select?: true,
  as?: string,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
) => {
  let sql: string;
  let dontAlias: boolean | undefined;

  if (key === '*') {
    if (jsonList && as) {
      jsonList[as] = undefined;
    }

    const shape = data.joinedShapes?.[table];
    if (shape) {
      sql = select
        ? makeRowToJson(ctx, table, shape as never, true)
        : `"${table}".*`;
    } else {
      sql = `"${table}"."${key}"`;
      dontAlias = true;
    }
  } else {
    const tableName = _getQueryAliasOrName(data, table);
    const quoted = `"${table}"`;

    const col = (quoted === quotedAs
      ? shape[key]
      : data.joinedShapes?.[tableName]?.[key]) as unknown as
      | Column.Pick.Data
      | undefined;

    if (jsonList && as) {
      jsonList[as] = col && getSelectedColumnData(col);
    }

    if (col?.data.selectSql) {
      sql = `(${col.data.selectSql.toSQL(ctx, quoted)})`;
    } else if (col?.data.name) {
      sql = `"${tableName}"."${col.data.name}"`;
    } else if (col?.data.computed) {
      sql = `(${col.data.computed.toSQL(ctx, quoted)})`;
    } else {
      sql = `"${tableName}"."${key}"`;
      dontAlias = key === as;
    }
  }

  if (as && !dontAlias) {
    sql = `${sql} "${as}"`;
  }

  return sql;
};

export const columnToSql = (
  ctx: ToSQLCtx,
  data: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
  },
  shape: Column.QueryColumns,
  column: string,
  quotedAs?: string,
  select?: true,
  as?: string,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
  useSelectList?: true,
): string => {
  let index = column.indexOf('.');
  if (index === -1 && !select) {
    const joinAs = data.valuesJoinedAs?.[column];
    if (joinAs) {
      column = joinAs + '.' + column;
      index = joinAs.length;
    }
  }

  if (index !== -1) {
    const table = column.slice(0, index);
    const key = column.slice(index + 1);
    return tableColumnToSql(
      ctx,
      data,
      shape,
      table,
      key,
      quotedAs,
      select,
      as,
      jsonList,
    );
  }

  return simpleColumnToSQL(
    ctx,
    data,
    shape,
    column,
    shape[column],
    quotedAs,
    select,
    as,
    jsonList,
    useSelectList,
  );
};

export const rawOrColumnToSql = (
  ctx: ToSQLCtx,
  data: {
    joinedShapes?: JoinedShapes;
    select?: SelectItem[];
  },
  shape: Column.QueryColumns,
  expr: SelectableOrExpression,
  quotedAs: string | undefined,
  select?: true,
): string => {
  return typeof expr === 'string'
    ? columnToSql(ctx, data, shape, expr, quotedAs, select)
    : (expr as Expression).toSQL(ctx, quotedAs);
};
