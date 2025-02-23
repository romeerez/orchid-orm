import { SelectItem } from './types';
import { RawSQL } from './rawSql';
import {
  columnToSqlWithAs,
  makeRowToJson,
  ownColumnToSqlWithAs,
  simpleColumnToSQL,
  tableColumnToSqlWithAs,
} from './common';
import { OrchidOrmInternalError, UnhandledTypeError } from '../errors';
import { makeSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import { CommonQueryData, QueryData, SelectQueryData } from './data';
import { SelectableOrExpression } from '../common/utils';
import {
  addValue,
  ColumnsParsers,
  ColumnsShapeBase,
  ColumnTypeBase,
  ColumnTypesBase,
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
import { makeReturningSql } from './insert';

export const pushSelectSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: {
    shape: QueryColumns;
    hookSelect?: HookSelect;
    selectCache?: QueryData['selectCache'];
  },
  quotedAs?: string,
  aliases?: string[],
) => {
  if (query.selectCache) {
    ctx.sql.push(query.selectCache.sql);
    if (aliases) aliases.push(...query.selectCache.aliases);
  } else {
    const sql = selectToSql(
      ctx,
      table,
      query,
      quotedAs,
      query.hookSelect,
      aliases,
    );
    if (sql) ctx.sql.push(sql);
  }
};

export const selectToSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: {
    inCTE?: SelectQueryData['inCTE'];
    select?: SelectQueryData['select'];
    selectAllColumns?: string[];
    selectAllKeys?: RecordUnknown;
    join?: SelectQueryData['join'];
    hookSelect?: HookSelect;
    shape: QueryColumns;
    parsers?: ColumnsParsers;
    joinedShapes?: CommonQueryData['joinedShapes'];
  },
  quotedAs: string | undefined,
  hookSelect: HookSelect | undefined = query.hookSelect,
  aliases?: string[],
  skipCTE?: boolean,
  jsonList?: { [K: string]: ColumnTypeBase | undefined },
): string => {
  if (query.inCTE && !skipCTE) {
    const { select } = makeReturningSql(
      ctx,
      table,
      query as never,
      quotedAs as never,
    );

    return query.inCTE.selectNum || !select
      ? select
        ? '0, ' + select
        : '0'
      : select;
  }

  let selected: RecordUnknown | undefined;

  const list: string[] = [];

  if (query.select) {
    for (const item of query.select) {
      if (typeof item === 'string') {
        let sql;
        if (item === '*') {
          if (hookSelect) {
            selected ??= {};
            for (const key in query.selectAllKeys || query.shape) {
              selected[key] = quotedAs;
            }
          }

          sql = selectAllSql(query, quotedAs, jsonList);
        } else {
          const index = item.indexOf('.');
          if (index !== -1) {
            const tableName = item.slice(0, index);
            const key = item.slice(index + 1);

            if (hookSelect?.get(key)) {
              (selected ??= {})[key] = `"${tableName}"`;
            }

            sql = tableColumnToSqlWithAs(
              ctx,
              table.q,
              item,
              tableName,
              key,
              key === '*' ? tableName : key,
              quotedAs,
              true,
              jsonList,
            );
          } else {
            if (hookSelect?.get(item)) (selected ??= {})[item] = quotedAs;

            sql = ownColumnToSqlWithAs(
              ctx,
              table.q,
              item,
              item,
              quotedAs,
              true,
              jsonList,
            );
          }
        }

        list.push(sql);
        aliases?.push('');
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
                if (jsonList) {
                  jsonList[as] = value.result.value as ColumnTypeBase;
                }
                aliases?.push(as);
              } else {
                pushSubQuerySql(ctx, query, value, as, list, quotedAs, aliases);
                if (jsonList) {
                  jsonList[as] =
                    value.q.returnType === 'value' ||
                    value.q.returnType === 'valueOrThrow'
                      ? ((value.q.expr?.result.value ||
                          value.result?.value) as ColumnTypeBase)
                      : undefined;
                }
              }
            } else if (value) {
              list.push(
                columnToSqlWithAs(
                  ctx,
                  table.q,
                  value as string,
                  as,
                  quotedAs,
                  true,
                  jsonList,
                ),
              );
              aliases?.push(as);
            }
          }
        } else {
          list.push(selectedObjectToSQL(ctx, quotedAs, item));
          aliases?.push('');
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
        sql = simpleColumnToSQL(ctx, query, select, col, quotedAs);
      }

      let name = columnName;
      if (selected?.[columnName]) {
        if (selected?.[columnName] === quotedTable) {
          hookSelect.delete(column);
          continue;
        }

        let i = 2;

        while (selected[(name = `${column}${i}`)]) i++;

        item.as = name;
        sql += ` "${name}"`;
      } else if (col?.data.name) {
        sql += ` "${columnName}"`;
      }

      if (jsonList) jsonList[name] = col;
      list.push(sql);
    }
  }

  return list.length
    ? list.join(', ')
    : query.select
    ? ''
    : selectAllSql(query, quotedAs, jsonList);
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
  query: {
    join?: SelectQueryData['join'];
    selectAllColumns?: string[];
    selectAllKeys?: RecordUnknown;
    shape?: QueryColumns;
  },
  quotedAs?: string,
  jsonList?: { [K: string]: ColumnTypeBase | undefined },
) => {
  if (jsonList) {
    Object.assign(
      jsonList,
      (query.selectAllKeys || query.shape) as ColumnTypesBase,
    );
  }

  return query.join?.length
    ? query.selectAllColumns?.map((item) => `${quotedAs}.${item}`).join(', ') ||
        `${quotedAs}.*`
    : query.selectAllColumns?.join(', ') || '*';
};

const pushSubQuerySql = (
  ctx: ToSQLCtx,
  mainQuery: {
    joinedShapes?: CommonQueryData['joinedShapes'];
  },
  query: ToSQLQuery,
  as: string,
  list: string[],
  quotedAs?: string,
  aliases?: string[],
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
        if (
          query.q.returning ||
          query.q.expr?.result.value instanceof IntegerBaseColumn
        ) {
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
      default:
        throw new UnhandledTypeError(query as Query, returnType);
    }
    list.push(`${sql} "${as}"`);
    aliases?.push(as);
    return;
  }

  if (query.q.joinedForSelect) {
    let sql;
    switch (returnType) {
      case 'one':
      case 'oneOrThrow': {
        const table = query.q.joinedForSelect;
        const shape = mainQuery.joinedShapes?.[as] as ColumnsShapeBase;
        sql = makeRowToJson(table, shape, false);
        break;
      }
      case 'all':
      case 'pluck':
      case 'value':
      case 'rows':
        sql = `"${query.q.joinedForSelect}".r`;
        break;
      case 'valueOrThrow':
        if (query.q.returning) return;
        sql = `"${query.q.joinedForSelect}".r`;
        break;
      case 'void':
        return;
      default:
        throw new UnhandledTypeError(query as Query, returnType);
    }

    if (sql) {
      list.push(`${coalesce(ctx, query, sql, quotedAs)} "${as}"`);
      aliases?.push(as);
    }
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
      if (!query.q.returning && query.q.computeds?.[as]) {
        query = queryJson(query) as unknown as typeof query;
      }
      break;
    case 'rows':
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
