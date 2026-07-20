import { JoinedShapes, QueryData } from '../query-data';
import { ToSQLCtx } from './to-sql';
import { Column } from '../../columns/column';
import { RecordString } from '../../utils';
import { ColumnsParsers } from '../query-columns/query-column-parsers';
import { _getQueryAliasOrName } from '../basic-features/as/as';
import { Expression, SelectableOrExpression } from '../expressions/expression';
import { getSelectedColumnData, makeRowToJson } from './sql';
import { SelectItem } from '../basic-features/select/select.sql';

interface ColumnShapesData {
  shape?: Column.QueryColumns;
  selectShape?: Column.QueryColumns;
}

const getColumnFromShape = (
  data: ColumnShapesData,
  shape: Column.QueryColumns,
  key: string,
  select?: true,
) =>
  !select && shape === data.selectShape
    ? data.shape?.[key] || shape[key]
    : shape[key];

// Takes a column name without a dot and the optional column object.
// Handles computed column, uses column.data.name when set, prefixes regular column with `quotedAs`.
// Returns quoted key if no column is provided.
export function simpleColumnToSQL(
  ctx: ToSQLCtx,
  queryData: {
    valuesJoinedAs?: RecordString;
    select?: SelectItem[];
    joinedShapes?: JoinedShapes;
    getColumn?: Column;
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
  skipValueToArray?: true,
): string {
  let sql: string;
  let dontAlias: boolean | undefined;

  if (useSelectList && queryData.select) {
    for (const s of queryData.select) {
      if (typeof s === 'object' && 'selectAs' in s) {
        if (key in s.selectAs) {
          dontAlias = true;
          sql = simpleColumnToSQL(
            ctx,
            queryData,
            shape,
            key,
            shape[key],
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true,
          );
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

        if (!select) {
          const joinAs = !select && queryData.valuesJoinedAs?.[key];
          if (joinAs) {
            quotedAs = `"${joinAs}"`;
          }
        }

        sql = `${quotedAs ? `${quotedAs}.` : ''}"${name}"`;
      }
    }
  }

  if (
    !select &&
    !useSelectList &&
    (column as Column)?.data.valueToArray &&
    !(column as Column).data.skipValueToArray
  ) {
    sql += '[1]';
  } else if (queryData.getColumn?.data.valueToArray && !skipValueToArray) {
    sql = `array[${sql}]`;
  }

  if (as && !dontAlias) {
    sql = `${sql} "${as}"`;
  }

  return sql;
}

export const tableColumnToSql = (
  ctx: ToSQLCtx,
  queryData: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
    getColumn?: Column;
    shape?: Column.QueryColumns;
    selectShape?: Column.QueryColumns;
  },
  shape: Column.QueryColumns,
  table: string,
  key: string,
  quotedAs?: string,
  select?: true,
  as?: string,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
  skipValueToArray?: true,
) => {
  let sql: string;
  let dontAlias: boolean | undefined;

  if (key === '*') {
    if (jsonList && as) {
      jsonList[as] = undefined;
    }

    const shape = queryData.joinedShapes?.[table];
    if (shape) {
      sql = select
        ? makeRowToJson(ctx, table, shape as never, true)
        : `"${table}".*`;
    } else {
      sql = `"${table}"."${key}"`;
      dontAlias = true;
    }
  } else {
    const tableName = _getQueryAliasOrName(queryData, table);
    const quoted = `"${table}"`;

    const col = (quoted === quotedAs
      ? getColumnFromShape(queryData, shape, key, select)
      : queryData.joinedShapes?.[tableName]?.[key]) as unknown as
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

    if (
      !select &&
      (col as Column)?.data.valueToArray &&
      !(col as Column).data.skipValueToArray
    ) {
      sql += '[1]';
    } else if (queryData.getColumn?.data.valueToArray && !skipValueToArray) {
      sql = `array[${sql}]`;
    }
  }

  if (as && !dontAlias) {
    sql = `${sql} "${as}"`;
  }

  return sql;
};

export const columnToSqlNotSelect = (
  ctx: ToSQLCtx,
  data: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
    shape?: Column.QueryColumns;
    selectShape?: Column.QueryColumns;
  },
  shape: Column.QueryColumns,
  column: string,
  quotedAs?: string,
  useSelectList?: true,
): string =>
  columnToSql(
    ctx,
    data,
    shape,
    column,
    quotedAs,
    undefined,
    undefined,
    undefined,
    useSelectList,
    true,
  );

export const columnToSql = (
  ctx: ToSQLCtx,
  data: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
    shape?: Column.QueryColumns;
    selectShape?: Column.QueryColumns;
  },
  shape: Column.QueryColumns,
  column: string,
  quotedAs?: string,
  select?: true,
  as?: string,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
  useSelectList?: true,
  skipValueToArray?: true,
): string => {
  let index = column.indexOf('.');
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
      skipValueToArray,
    );
  }

  const selectedColumn = getColumnFromShape(data, shape, column, select);

  return simpleColumnToSQL(
    ctx,
    data,
    shape,
    column,
    selectedColumn,
    quotedAs,
    select,
    as,
    jsonList,
    useSelectList,
    undefined,
    skipValueToArray,
  );
};

export const rawOrColumnToSql = (
  ctx: ToSQLCtx,
  data: {
    joinedShapes?: JoinedShapes;
    select?: SelectItem[];
    shape?: Column.QueryColumns;
    selectShape?: Column.QueryColumns;
  },
  shape: Column.QueryColumns,
  expr: SelectableOrExpression,
  quotedAs: string | undefined,
  select?: true,
  skipValueToArray?: true,
): string => {
  return typeof expr === 'string'
    ? columnToSql(
        ctx,
        data,
        shape,
        expr,
        quotedAs,
        select,
        undefined,
        undefined,
        undefined,
        skipValueToArray,
      )
    : (expr as Expression).toSQL(ctx, quotedAs);
};
