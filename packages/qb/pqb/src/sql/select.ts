import { SelectItem } from './types';
import { RawSQL } from './rawSql';
import {
  columnToSql,
  ownColumnToSqlWithAs,
  simpleColumnToSQL,
  tableColumnToSqlWithAs,
} from './common';
import { OrchidOrmInternalError, UnhandledTypeError } from '../errors';
import { makeSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import { SelectQueryData } from './data';
import { SelectableOrExpression } from '../common/utils';
import {
  addValue,
  Expression,
  HookSelect,
  isExpression,
  QueryColumns,
  RecordUnknown,
} from 'orchid-core';
import { Query } from '../query/query';
import { _queryGetOptional } from '../queryMethods/get.utils';
import { queryJson } from '../queryMethods/json.utils';
import { queryWrap } from '../queryMethods/queryMethods.utils';
import { isQueryNone } from '../queryMethods/none';
import { ColumnType, IntegerBaseColumn } from '../columns';
import { getSqlText } from './utils';

export const pushSelectSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: {
    select?: SelectQueryData['select'];
    join?: SelectQueryData['join'];
    shape: QueryColumns;
  },
  quotedAs?: string,
) => {
  ctx.sql.push(selectToSql(ctx, table, query, quotedAs));
};

export const selectToSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: {
    select?: SelectQueryData['select'];
    join?: SelectQueryData['join'];
    hookSelect?: HookSelect;
    shape: QueryColumns;
  },
  quotedAs: string | undefined,
  hookSelect = query.hookSelect,
): string => {
  let selected: RecordUnknown | undefined;

  const list: string[] = [];

  if (query.select) {
    for (const item of query.select) {
      if (typeof item === 'string') {
        let sql;
        if (item === '*') {
          if (hookSelect) {
            selected ??= {};
            for (const key in table.internal.columnsKeysForSelectAll ||
              query.shape) {
              selected[key] = quotedAs;
            }
          }
          sql = selectAllSql(table, query, quotedAs);
        } else {
          const index = item.indexOf('.');
          if (index !== -1) {
            const tableName = item.slice(0, index);
            const key = item.slice(index + 1);
            if (hookSelect?.get(key)) (selected ??= {})[key] = `"${tableName}"`;

            sql = tableColumnToSqlWithAs(
              ctx,
              table.q,
              item,
              tableName,
              key,
              quotedAs,
              true,
            );
          } else {
            if (hookSelect?.get(item)) (selected ??= {})[item] = quotedAs;
            sql = ownColumnToSqlWithAs(ctx, table.q, item, quotedAs, true);
          }
        }
        list.push(sql);
      } else if (item) {
        if ('selectAs' in item) {
          const obj = item.selectAs as {
            [K: string]: SelectableOrExpression | ToSQLQuery;
          };
          for (const as in obj) {
            if (hookSelect) (selected ??= {})[as] = true;

            const value = obj[as];
            if (typeof value === 'object') {
              if (isExpression(value)) {
                list.push(`${value.toSQL(ctx, quotedAs)} "${as}"`);
              } else {
                pushSubQuerySql(ctx, value, as, list, quotedAs);
              }
            } else if (value) {
              list.push(
                `${columnToSql(
                  ctx,
                  table.q,
                  table.q.shape,
                  value as string,
                  quotedAs,
                  true,
                )} "${as}"`,
              );
            }
          }
        } else {
          list.push(selectedObjectToSQL(ctx, quotedAs, item));
        }
      }
    }
  }

  if (hookSelect) {
    for (const column of hookSelect.keys()) {
      const item = hookSelect.get(column) as { select: string; as?: string };
      const { select } = item;
      let sql;
      let quotedTable;
      let columnName;
      let col;
      const index = select.indexOf('.');
      if (index !== -1) {
        const tableName = select.slice(0, index);
        quotedTable = `"${tableName}"`;
        columnName = select.slice(index + 1);
        col = table.q.joinedShapes?.[tableName]?.[columnName] as
          | ColumnType
          | undefined;
        sql = col?.data.computed
          ? col.data.computed.toSQL(ctx, `"${tableName}"`)
          : `"${tableName}"."${col?.data.name || columnName}"`;
      } else {
        quotedTable = quotedAs;
        columnName = select;
        col = query.shape[select] as ColumnType | undefined;
        sql = simpleColumnToSQL(ctx, select, col, quotedAs);
      }

      if (selected?.[columnName]) {
        if (selected?.[columnName] === quotedTable) {
          hookSelect.delete(column);
          continue;
        }

        let i = 2;
        let name: string;

        while (selected[(name = `${column}${i}`)]) i++;

        item.as = name;
        sql += ` "${name}"`;
      } else if (col?.data.name) {
        sql += ` "${columnName}"`;
      }

      list.push(sql);
    }
  }

  return list.length ? list.join(', ') : selectAllSql(table, query, quotedAs);
};

export function selectedObjectToSQL(
  ctx: ToSQLCtx,
  quotedAs: string | undefined,
  item: Expression,
) {
  const sql = item.toSQL(ctx, quotedAs);
  return ctx.aliasValue ? `${sql} r` : sql;
}

export const selectAllSql = (
  table: ToSQLQuery,
  query: { join?: SelectQueryData['join'] },
  quotedAs?: string,
) => {
  return query.join?.length
    ? table.internal.columnsForSelectAll
        ?.map((item) => `${quotedAs}.${item}`)
        .join(', ') || `${quotedAs}.*`
    : table.internal.columnsForSelectAll?.join(', ') || '*';
};

const pushSubQuerySql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  as: string,
  list: string[],
  quotedAs?: string,
) => {
  const { returnType = 'all' } = query.q;

  if (isQueryNone(query)) {
    let sql: string;
    switch (returnType) {
      case 'one':
      case 'oneOrThrow':
      case 'void':
        return;
      case 'value':
      case 'valueOrThrow':
        if (query.q.expr?.result.value instanceof IntegerBaseColumn) {
          sql = '0';
        } else {
          return;
        }
        break;
      case 'all':
      case 'pluck':
      case 'rows':
        sql = `'[]'::json`;
        break;
      case 'rowCount':
        sql = '0';
        break;
      default:
        throw new UnhandledTypeError(query as Query, returnType);
    }
    list.push(`${sql} "${as}"`);
    return;
  }

  if (query.q.joinedForSelect) {
    let sql;
    switch (returnType) {
      case 'one':
      case 'oneOrThrow':
        sql = `row_to_json("${query.q.joinedForSelect}".*)`;
        break;
      case 'all':
      case 'pluck':
      case 'value':
      case 'valueOrThrow':
      case 'rows':
        sql = `"${query.q.joinedForSelect}".r`;
        break;
      case 'rowCount':
      case 'void':
        return;
      default:
        throw new UnhandledTypeError(query as Query, returnType);
    }

    if (sql) list.push(`${coalesce(ctx, query, sql, quotedAs)} "${as}"`);
    return;
  }

  switch (returnType) {
    case 'all':
    case 'one':
    case 'oneOrThrow':
      query = queryJson(query) as unknown as typeof query;
      break;
    case 'pluck': {
      const { select } = query.q;
      const first = select?.[0];
      if (!first && query.q.computeds?.[as]) {
        query = queryJson(query) as unknown as typeof query;
      } else if (!first) {
        throw new OrchidOrmInternalError(
          query as Query,
          `Nothing was selected for pluck`,
        );
      } else {
        const cloned = query.clone();
        cloned.q.select = [{ selectAs: { c: first } }] as SelectItem[];
        query = queryWrap(cloned, cloned.baseQuery.clone());
        _queryGetOptional(query, new RawSQL(`COALESCE(json_agg("c"), '[]')`));
      }
      break;
    }
    case 'value':
    case 'valueOrThrow':
      if (query.q.computeds?.[as]) {
        query = queryJson(query) as unknown as typeof query;
      }
      break;
    case 'rows':
    case 'rowCount':
    case 'void':
      break;
    default:
      throw new UnhandledTypeError(query as Query, returnType);
  }

  list.push(
    `${coalesce(
      ctx,
      query,
      `(${getSqlText(makeSQL(query, ctx))})`,
      quotedAs,
    )} "${as}"`,
  );
};

const coalesce = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  sql: string,
  quotedAs?: string,
) => {
  const { coalesceValue } = query.q;
  if (coalesceValue !== undefined) {
    const value = isExpression(coalesceValue)
      ? coalesceValue.toSQL(ctx, quotedAs)
      : addValue(ctx.values, coalesceValue);
    return `COALESCE(${sql}, ${value})`;
  }

  return sql;
};
