import { RawSql } from '../../expressions/raw-sql';
import {
  columnToSqlWithAs,
  ownColumnToSqlWithAs,
  simpleColumnToSQL,
  tableColumnToSqlWithAs,
} from '../../sql/column-to-sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { _queryGetOptional } from '../get/get.utils';
import { queryJson } from '../json/json.utils';
import { queryWrap } from '../wrap/wrap';
import { isQueryNone } from '../../extra-features/none/none';
import { anyShape } from '../../../columns/any-shape';
import { Column } from '../../../columns/column';
import { IntegerBaseColumn } from '../../../columns/column-types/number';
import { moveMutativeQueryToCte } from '../cte/cte.sql';
import { SelectItemExpression } from '../../expressions/select-item-expression';
import { HookSelect, HookSelectValue } from './hook-select';
import {
  addValue,
  getFreeAlias,
  isObjectEmpty,
  RecordString,
  RecordUnknown,
} from '../../../utils';
import { ColumnsParsers } from '../../query-columns/query-column-parsers';
import {
  DelayedRelationSelect,
  setDelayedRelation,
} from './delayed-relational-select';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import {
  Expression,
  isExpression,
  SelectableOrExpression,
} from '../../expressions/expression';
import { isRelationQuery } from '../../relations';
import { OrchidOrmInternalError, UnhandledTypeError } from '../../errors';
import { Query } from '../../query';
import { makeRowToJson } from '../../sql/sql';

export type SelectItem = string | SelectAs | Expression | undefined;

export interface SelectAs {
  selectAs: SelectAsValue;
}

export interface SelectAsValue {
  [K: string]: string | Query | Expression | undefined;
}

export const setSqlCtxSelectList = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: {
    shape: Column.QueryColumns;
    hookSelect?: HookSelect;
    selectCache?: QueryData['selectCache'];
    returnType?: QueryData['returnType'];
  },
  quotedAs?: string,
  isSubSql?: boolean,
  aliases?: string[],
): void => {
  if (query.selectCache) {
    if (aliases) aliases.push(...query.selectCache.aliases);
    ctx.selectList = [query.selectCache.sql];
  } else {
    ctx.selectList = selectToSqlList(
      ctx,
      table,
      query,
      quotedAs,
      query.hookSelect,
      isSubSql,
      aliases,
      undefined,
      undefined,
    );

    if (!isSubSql && ctx.topCtx.cteHooks?.hasSelect) {
      ctx.selectList.push('NULL');
    }
  }
};

export const selectToSqlList = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: {
    select?: QueryData['select'];
    selectAllColumns?: string[];
    selectAllShape?: RecordUnknown;
    join?: QueryData['join'];
    hookSelect?: HookSelect;
    shape: Column.QueryColumns;
    parsers?: ColumnsParsers;
    joinedShapes?: QueryData['joinedShapes'];
    returnType?: QueryData['returnType'];
  },
  quotedAs: string | undefined,
  hookSelect: HookSelect | undefined = query.hookSelect,
  isSubSql?: boolean,
  aliases?: string[],
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
  delayedRelationSelect?: DelayedRelationSelect,
): string[] => {
  let selected: RecordUnknown | undefined;
  let selectedAs: RecordString | undefined;

  let list: string[] = [];

  ctx.selectedCount = 0;

  if (query.select) {
    for (const item of query.select) {
      if (typeof item === 'string') {
        let sql;
        if (item === '*') {
          if (hookSelect) {
            selected ??= {};
            selectedAs ??= {};
            for (const key in query.selectAllShape) {
              selected[key] = quotedAs;
              selectedAs[key] = key;
            }
          }

          sql = internalSelectAllSql(ctx, query, quotedAs, jsonList).join(', ');
        } else {
          ctx.selectedCount++;

          const index = item.indexOf('.');
          if (index !== -1) {
            const tableName = item.slice(0, index);
            const key = item.slice(index + 1);

            if (hookSelect?.get(key)) {
              (selected ??= {})[key] = `"${tableName}"`;
              (selectedAs ??= {})[key] = key;
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
            if (hookSelect?.get(item)) {
              (selected ??= {})[item] = quotedAs;
              (selectedAs ??= {})[item] = item;
            }

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
            [K: string]: SelectableOrExpression | SubQueryForSql;
          };
          for (const as in obj) {
            ctx.selectedCount++;

            if (hookSelect) {
              (selected ??= {})[as] = true;
            }

            const value = obj[as];
            if (typeof value === 'object') {
              if (isExpression(value)) {
                list.push(`${value.toSQL(ctx, quotedAs)} "${as}"`);
                if (jsonList) {
                  jsonList[as] = value.result
                    .value as unknown as Column.Pick.Data;
                }
                aliases?.push(as);
              } else if (delayedRelationSelect && isRelationQuery(value)) {
                setDelayedRelation(delayedRelationSelect, as, value);
              } else {
                pushSubQuerySql(ctx, query, value, as, list, quotedAs, aliases);
                if (jsonList) {
                  jsonList[as] =
                    value.q.returnType === 'value' ||
                    value.q.returnType === 'valueOrThrow'
                      ? ((value.q.expr?.result.value ||
                          value.result?.value) as unknown as Column.Pick.Data)
                      : undefined;
                }
              }
            } else if (value) {
              if (hookSelect) {
                (selectedAs ??= {})[value as string] = as;
              }

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
          // selecting a single value from expression
          ctx.selectedCount++;
          const sql = item.toSQL(ctx, quotedAs);

          // `get` column
          if (
            hookSelect &&
            item instanceof SelectItemExpression &&
            typeof item.item === 'string' &&
            item.item !== '*'
          ) {
            const i = item.item.indexOf('.');
            let key: string | undefined;
            if (i !== -1) {
              if (item.item.slice(0, i) === table.table) {
                key = item.item.slice(i + 1);
              }
            } else {
              key = item.item;
            }

            if (key) {
              const column = (item.q as QueryData).shape[key];
              (selectedAs ??= {})[key] = column?.data.name || key;
            }
          }

          list.push(ctx.aliasValue ? `${sql} ${quotedAs}` : sql);
          aliases?.push('');
        }
      }
    }
  }

  if (hookSelect) {
    for (const column of hookSelect.keys()) {
      const item = hookSelect.get(column) as HookSelectValue;
      const { select } = item;
      let sql;
      let quotedTable;
      let columnName;
      let col;

      if (typeof select === 'string') {
        const index = select.indexOf('.');
        if (index !== -1) {
          const tableName = select.slice(0, index);
          quotedTable = `"${tableName}"`;
          columnName = select.slice(index + 1);
          col = table.q.joinedShapes?.[tableName]?.[columnName] as
            | Column
            | undefined;
          sql = col?.data.computed
            ? col.data.computed.toSQL(ctx, `"${tableName}"`)
            : `"${tableName}"."${col?.data.name || columnName}"`;
        } else {
          quotedTable = quotedAs;
          columnName = select;
          col = query.shape[select] as Column | undefined;
          sql = simpleColumnToSQL(ctx, select, col, quotedAs);
        }
      } else {
        columnName = column;
        sql = select.sql;
      }

      let name = columnName;
      if (selected?.[columnName]) {
        if (selected?.[columnName] === quotedTable) {
          if (!isSubSql) {
            hookSelect.delete(column);
          }
          item.onAs?.forEach((fn) => fn(columnName));
          continue;
        }

        name = getFreeAlias(selected, column);

        item.as = name;
        item.temp = name;
        sql += ` "${name}"`;
        item.onAs?.forEach((fn) => fn(name));
      } else if (selectedAs?.[columnName]) {
        const as = selectedAs[columnName];
        item.as = as;
        item.temp = columnName;
        item.onAs?.forEach((fn) => fn(as));
        continue;
      } else {
        if (col?.data.name || typeof select === 'object') {
          sql += ` "${columnName}"`;
        }
        item.temp = columnName;
        item.onAs?.forEach((fn) => fn(column));
      }

      if (jsonList) jsonList[name] = col;

      ctx.selectedCount++;
      list.push(sql);
    }
  }

  if (!list.length && !query.select && query.returnType !== 'void') {
    list = internalSelectAllSql(ctx, query, quotedAs, jsonList);
  }

  return list;
};

export const selectToSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: {
    select?: QueryData['select'];
    selectAllColumns?: string[];
    selectAllShape?: RecordUnknown;
    join?: QueryData['join'];
    hookSelect?: HookSelect;
    shape: Column.QueryColumns;
    parsers?: ColumnsParsers;
    joinedShapes?: QueryData['joinedShapes'];
    returnType?: QueryData['returnType'];
  },
  quotedAs: string | undefined,
  hookSelect: HookSelect | undefined = query.hookSelect,
  isSubSql?: boolean,
  aliases?: string[],
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
  delayedRelationSelect?: DelayedRelationSelect,
): string => {
  const list = selectToSqlList(
    ctx,
    table,
    query,
    quotedAs,
    hookSelect,
    isSubSql,
    aliases,
    jsonList,
    delayedRelationSelect,
  );

  return list.join(', ');
};

const internalSelectAllSql = (
  ctx: ToSQLCtx,
  query: {
    updateFrom?: unknown;
    join?: QueryData['join'];
    selectAllColumns?: string[];
    selectAllShape?: RecordUnknown;
    shape: Column.QueryColumns;
  },
  quotedAs?: string,
  jsonList?: { [K: string]: Column.Pick.Data | undefined },
): string[] => {
  if (jsonList) {
    Object.assign(jsonList, query.selectAllShape);
  }

  let columnsCount: number | undefined;
  if (query.shape !== anyShape) {
    let columnsCount = 0;
    for (const key in query.shape) {
      if (!(query.shape[key] as Column).data.explicitSelect) {
        columnsCount++;
      }
    }
    ctx.selectedCount += columnsCount;
  }

  return selectAllSql(query, quotedAs, columnsCount);
};

export const selectAllSql = (
  q: {
    updateFrom?: unknown;
    join?: QueryData['join'];
    selectAllColumns?: string[];
    selectAllShape?: RecordUnknown;
    shape: Column.QueryColumns;
  },
  quotedAs?: string,
  columnsCount?: number,
): string[] => {
  return q.join?.length || q.updateFrom
    ? q.selectAllColumns?.map((item) => `${quotedAs}.${item}`) ||
        (isEmptySelect(q.shape, columnsCount) ? [] : [`${quotedAs}.*`])
    : q.selectAllColumns
    ? [...q.selectAllColumns]
    : isEmptySelect(q.shape, columnsCount)
    ? []
    : ['*'];
};

const isEmptySelect = (shape: Column.QueryColumns, columnsCount?: number) =>
  columnsCount === undefined
    ? shape === anyShape
      ? false
      : isObjectEmpty(shape)
    : !columnsCount;

const pushSubQuerySql = (
  ctx: ToSQLCtx,
  mainQuery: {
    joinedShapes?: QueryData['joinedShapes'];
  },
  query: SubQueryForSql,
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
        throw new UnhandledTypeError(query, returnType);
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
        const shape = mainQuery.joinedShapes?.[
          as
        ] as unknown as Column.Shape.Data;
        sql = makeRowToJson(table, shape, false);
        break;
      }
      case 'all':
      case 'value':
      case 'pluck':
      case 'rows':
        sql = `"${query.q.joinedForSelect}"."${as}"`;
        break;
      case 'valueOrThrow':
        if (query.q.returning) return;
        sql = `"${query.q.joinedForSelect}"."${as}"`;
        break;
      case 'void':
        return;
      default:
        throw new UnhandledTypeError(query, returnType);
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
      if (!first && query.q.runtimeComputeds?.[as]) {
        query = queryJson(query) as unknown as typeof query;
      } else if (!first) {
        throw new OrchidOrmInternalError(
          query,
          `Nothing was selected for pluck`,
        );
      } else {
        const cloned = query.clone();
        cloned.q.select = [{ selectAs: { c: first } }] as SelectItem[];
        query = queryWrap(
          cloned,
          cloned.baseQuery.clone(),
        ) as unknown as SubQueryForSql;
        _queryGetOptional(
          query as never,
          new RawSql(`COALESCE(json_agg("c"), '[]')`),
        );
      }
      break;
    }
    case 'value':
    case 'valueOrThrow':
      if (!query.q.returning && query.q.runtimeComputeds?.[as]) {
        query = queryJson(query) as unknown as typeof query;
      }
      break;
    case 'rows':
    case 'void':
      break;
    default:
      throw new UnhandledTypeError(query, returnType);
  }

  list.push(
    `${coalesce(
      ctx,
      query,
      `(${moveMutativeQueryToCte(ctx, query)})`,
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
