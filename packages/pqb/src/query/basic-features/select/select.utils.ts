import { getValueKey } from '../get/get-value-key';
import {
  BatchParser,
  getQueryParsers,
  setParserToQuery,
} from '../../query-columns/query-column-parsers';
import { parseRecord } from '../../then/then';
import {
  RecordString,
  RecordUnknown,
  setObjectValueImmutable,
  spreadObjectValues,
} from '../../../utils';
import {
  addColumnParserToQuery,
  Column,
  defaultSchemaConfig,
  JSONTextColumn,
  setColumnData,
  UnknownColumn,
} from '../../../columns';
import { processComputedBatches } from '../../extra-features/computed/computed';
import { isQueryNone } from '../../extra-features/none/none';
import { cloneQueryBaseUnscoped } from '../wrap/wrap';
import { prepareSubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { RawSql } from '../../expressions/raw-sql';
import { SelectArg, SelectAsArg, SelectSelf } from './select';
import { _joinLateral } from '../join/join';
import {
  PickQueryQ,
  PickQueryQAndInternal,
  PickQuerySelectable,
} from '../../pick-query-types';
import {
  Expression,
  isExpression,
  SelectableOrExpression,
} from '../../expressions/expression';
import { getFullColumnTable, pushQueryArrayImmutable } from '../../query.utils';
import { IsQuery, Query, QueryBase } from '../../query';
import { NotFoundError } from '../../errors';
import { finalizeNestedHookSelect } from '../../extra-features/hooks/hooks';
import { applyBatchTransforms } from '../../extra-features/data-transform/transform';
import { resolveSubQueryCallback } from '../../sub-query/sub-query';
import { isRelationQuery } from '../../relations';
import { _copyQueryAliasToQuery } from '../as/as';
import { _addToHookSelect, _addToHookSelectWithTable } from './hook-select';
import { SelectAsValue, SelectItem } from './select.sql';
import { pushQueryValueImmutable, QueryData } from '../../query-data';
import { ToSQLQuery } from '../../sql/to-sql';

// add a parser for a raw expression column
// is used by .select and .get methods
export const addParserForRawExpression = (
  q: PickQueryQ,
  key: string | getValueKey,
  raw: Expression,
) => {
  if (raw.result.value) addColumnParserToQuery(q.q, key, raw.result.value);
};

// add parsers when selecting a full joined table by name or alias
const addParsersForSelectJoined = (
  q: PickQueryQ,
  arg: string,
  as: string | getValueKey = arg,
) => {
  const parsers = q.q.joinedParsers?.[arg];
  if (parsers) {
    setParserToQuery(q.q, as, (row) => parseRecord(parsers, row));
  }

  const batchParsers = q.q.joinedBatchParsers?.[arg];
  if (batchParsers) {
    pushQueryArrayImmutable(
      q,
      'batchParsers',
      batchParsers.map((x) => ({
        path: [as as string, ...x.path],
        fn: x.fn,
      })),
    );
  }
};

export interface QueryBatchResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parent: any;
  key: PropertyKey;
}

// add parser for a single key-value pair of selected object
export const addParserForSelectItem = <T extends PickQuerySelectable>(
  query: T,
  as: string | getValueKey | undefined,
  key: string,
  arg: SelectableOrExpression<T> | Query,
  columnAlias?: string,
  joinQuery?: boolean,
): string | Expression | Query | undefined => {
  if (typeof arg === 'object') {
    const { q: q } = arg as Query;

    if (q.batchParsers) {
      pushQueryArrayImmutable(
        query as unknown as Query,
        'batchParsers',
        q.batchParsers.map((bp) => ({
          path: [key, ...bp.path],
          fn: bp.fn,
        })),
      );
    }

    const parsers = isExpression(arg)
      ? undefined
      : getQueryParsers(arg as Query);

    if (
      parsers ||
      q.hookSelect ||
      q.transform ||
      q.returnType === 'oneOrThrow' ||
      q.returnType === 'valueOrThrow' ||
      q.returnType === 'one' ||
      q.returnType === 'value'
    ) {
      pushQueryValueImmutable(query as unknown as Query, 'batchParsers', {
        path: [key],
        fn: (path, queryResult) => {
          const { rows } = queryResult;
          const originalReturnType = q.returnType || 'all';
          let returnType = originalReturnType;
          const { hookSelect } = q;
          const batches: QueryBatchResult[] = [];

          const last = path.length;
          if (returnType === 'value' || returnType === 'valueOrThrow') {
            if (hookSelect) {
              batches.push = (item) => {
                // if the item has no key, it means value return was implicitly turned into 'one' return,
                // happens when getting a computed column
                if (!(key in item)) {
                  returnType = returnType === 'value' ? 'one' : 'oneOrThrow';
                }
                batches.push = Array.prototype.push;
                return batches.push(item);
              };
            }
          }

          collectNestedSelectBatches(batches, rows, path, last);

          switch (returnType) {
            case 'all': {
              if (parsers) {
                for (const { data } of batches) {
                  for (const one of data) {
                    parseRecord(parsers, one);
                  }
                }
              }
              break;
            }
            case 'one':
            case 'oneOrThrow': {
              if (parsers) {
                if (returnType === 'one') {
                  for (const batch of batches) {
                    if (batch.data) parseRecord(parsers, batch.data);
                    else batch.parent[batch.key] = batch.data = undefined; // null to undefined
                  }
                } else {
                  for (const { data } of batches) {
                    if (!data) throw new NotFoundError(arg as Query);
                    parseRecord(parsers, data);
                  }
                }
              } else if (returnType === 'one') {
                for (const batch of batches) {
                  if (!batch.data)
                    batch.parent[batch.key] = batch.data = undefined; // null to undefined
                }
              } else {
                for (const { data } of batches) {
                  if (!data) throw new NotFoundError(arg as Query);
                }
              }

              if (hookSelect) {
                for (const batch of batches) {
                  batch.data = [batch.data];
                }
              }

              break;
            }
            case 'pluck': {
              const parse = parsers?.pluck;
              if (parse) {
                for (const { data } of batches) {
                  for (let i = 0; i < data.length; i++) {
                    (data as unknown as RecordUnknown)[i] = parse(data[i]);
                  }
                }
              }

              // not transforming data for hookSelect because it's set to load 'all' elsewhere for this case

              break;
            }
            case 'value':
            case 'valueOrThrow': {
              const notNullable = !(q.getColumn as Column.Pick.Data | undefined)
                ?.data.isNullable;

              const parse = parsers?.[getValueKey];
              if (parse) {
                if (returnType === 'value') {
                  for (const item of batches) {
                    item.parent[item.key] = item.data =
                      item.data === null ? q.notFoundDefault : parse(item.data);
                  }
                } else {
                  for (const item of batches) {
                    if (notNullable && item.data === null) {
                      throw new NotFoundError(arg as Query);
                    }

                    item.parent[item.key] = item.data = parse(item.data);
                  }
                }
              } else if (returnType === 'value') {
                for (const item of batches) {
                  if (item.data === null) {
                    item.parent[item.key] = item.data = q.notFoundDefault;
                  }
                }
              } else if (notNullable) {
                for (const { data } of batches) {
                  if (data === null) throw new NotFoundError(arg as Query);
                }
              }

              if (hookSelect) {
                for (const batch of batches) {
                  batch.data = [batch.data];
                }
              }

              break;
            }
          }

          if (hookSelect) {
            let tempColumns: Set<string> | undefined;
            let renames: RecordString | undefined;
            for (const column of hookSelect.keys()) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const select = hookSelect!.get(column)!;

              if (select.as) (renames ??= {})[column] = select.as;

              if (select.temp) {
                (tempColumns ??= new Set())?.add(select.as || column);
              }
            }

            if (renames) {
              for (const { data } of batches) {
                for (const record of data) {
                  if (record) {
                    for (const a in renames) {
                      const value = record[renames[a]];
                      record[renames[a]] = record[a];
                      record[a] = value;
                    }
                  }
                }
              }
            }

            if (q.selectedComputeds) {
              const maybePromise = processComputedBatches(
                q,
                batches,
                originalReturnType,
                returnType,
                tempColumns,
                renames,
                key,
              );
              if (maybePromise) return maybePromise;
            }

            finalizeNestedHookSelect(
              batches,
              originalReturnType,
              tempColumns,
              renames,
              key,
            );
          }

          applyBatchTransforms(q, batches);
          return;
        },
      } as BatchParser);
    }

    if (!joinQuery && (arg as Query).q?.subQuery && arg.q.expr) {
      arg = arg.q.expr;
    }

    if (isExpression(arg)) {
      addParserForRawExpression(query as never, key, arg);
      return arg;
    }

    return arg;
  }

  return setParserForSelectedString(
    query as never,
    arg as string,
    as,
    key,
    columnAlias,
  );
};

const collectNestedSelectBatches = (
  batches: QueryBatchResult[],
  rows: unknown[],
  path: string[],
  last: number,
) => {
  const stack: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parent: any;
    key: PropertyKey;
    i: number;
  }[] = rows.map(
    (row) =>
      ({
        data: row,
        parent: row,
        i: 0,
        key: path[0],
      } as never),
  );

  while (stack.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const item = stack.pop()!;
    const { i } = item;
    if (i === last) {
      batches.push(item);
      continue;
    }

    const { data } = item;
    const key = path[i];
    if (Array.isArray(data)) {
      for (let key = 0; key < data.length; key++) {
        stack.push({ data: data[key], parent: data, key, i });
      }
    } else if (data && typeof data === 'object') {
      stack.push({ data: data[key], parent: data, key, i: i + 1 });
    }
  }
};

// reuse SQL for empty array for JSON agg expressions
const emptyArrSQL = new RawSql("'[]'");

// process select argument: add parsers, join relations when needed
export const processSelectArg = <T extends SelectSelf>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem | undefined | false => {
  const query = q as unknown as Query;

  if (typeof arg === 'string') {
    return setParserForSelectedString(q as unknown as Query, arg, as, columnAs);
  }

  const selectAs: SelectAsValue = {};

  for (const key in arg as unknown as SelectAsArg<T>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value = (arg as unknown as SelectAsArg<T>)[key] as any;
    let joinQuery: boolean | undefined;

    if (typeof value === 'function') {
      value = resolveSubQueryCallback(q as unknown as ToSQLQuery, value);

      if (isQueryNone(value)) {
        if (value.q.innerJoinLateral) {
          return false;
        }
      }

      if (!isExpression(value)) {
        if (
          isRelationQuery(value) &&
          // `subQuery = 1` case is when callback returns the same query as it gets,
          // for example `q => q.get('name')`.
          (value as unknown as Query).q.subQuery !== 1
        ) {
          query.q.selectRelation = joinQuery = true;

          value = value.joinQuery(value, q as unknown as IsQuery);

          let subQuery;
          const { returnType, innerJoinLateral } = value.q;
          if (!returnType || returnType === 'all') {
            subQuery = value.json(false);

            // no need to coalesce in case of inner lateral join.
            if (!innerJoinLateral) {
              value.q.coalesceValue = emptyArrSQL;
            }
          } else if (returnType === 'pluck') {
            // no select in case of plucking a computed
            subQuery = value.q.select
              ? value
                  .wrap(cloneQueryBaseUnscoped(value))
                  .jsonAgg(value.q.select[0])
              : value.json(false);

            value.q.coalesceValue = emptyArrSQL;
          } else {
            if (returnType === 'value' || returnType === 'valueOrThrow') {
              if (value.q.select) {
                // todo: investigate what is this for
                if (typeof value.q.select[0] === 'string') {
                  value.q.select[0] = {
                    selectAs: { r: value.q.select[0] },
                  };
                }

                subQuery = value;
              } else {
                subQuery = value.json(false);
              }
            } else {
              subQuery = value;
            }
          }

          const as = _joinLateral(
            q,
            innerJoinLateral ? 'JOIN' : 'LEFT JOIN',
            subQuery,
            key,
            // no need for `ON p.r IS NOT NULL` check when joining a single record,
            // `JOIN` will handle it on itself.
            innerJoinLateral &&
              returnType !== 'one' &&
              returnType !== 'oneOrThrow',
          );

          if (as) {
            value.q.joinedForSelect = _copyQueryAliasToQuery(
              value,
              q as unknown as QueryBase,
              as,
            );
          }
        }

        value = prepareSubQueryForSql(q as never, value);
      }
    }

    selectAs[key] = addParserForSelectItem(
      q as unknown as Query,
      as,
      key,
      value,
      key,
      joinQuery,
    );
  }

  return { selectAs };
};

// process string select arg
// adds a column parser for a column
// when table.* string is provided, sets a parser for a joined table
export const setParserForSelectedString = (
  query: PickQueryQAndInternal,
  arg: string,
  as: string | getValueKey | undefined,
  columnAs?: string | getValueKey,
  columnAlias?: string,
): string | undefined => {
  const { q } = query;
  const index = arg.indexOf('.');
  if (index === -1) {
    return selectColumn(query, q, arg, columnAs, columnAlias);
  }

  const table = getFullColumnTable(query as unknown as IsQuery, arg, index, as);
  const column = arg.slice(index + 1);

  // 'table.*' is selecting a full joined record (without computeds)
  if (column === '*') {
    addParsersForSelectJoined(query, table, columnAs);
    return table === as ? column : arg;
  }

  if (table === as) {
    return selectColumn(query, q, column, columnAs, columnAlias);
  }

  const parser = q.joinedParsers?.[table]?.[column];
  if (parser) setParserToQuery(q, columnAs || column, parser);

  const batchParsers = q.joinedBatchParsers?.[table];
  if (batchParsers) {
    let cloned = false;
    for (const bp of batchParsers) {
      if (bp.path[0] === column) {
        if (!cloned) {
          q.batchParsers = [...(q.batchParsers || [])];
          cloned = true;
        }
        q.batchParsers!.push(bp);
      }
    }
  }

  const computeds = q.joinedComputeds?.[table];
  if (computeds?.[column]) {
    const computed = computeds[column];
    _addToHookSelectWithTable(query, computed.deps, table);

    setObjectValueImmutable(q, 'selectedComputeds', column, computed);
    return;
  }

  return arg;
};

const selectColumn = (
  query: PickQueryQAndInternal,
  q: QueryData,
  key: string,
  columnAs?: string | getValueKey,
  columnAlias?: string,
) => {
  if (key === '*') {
    const { defaultParsers } = query.q;
    if (defaultParsers) {
      spreadObjectValues(query.q, 'parsers', defaultParsers);
    }
  } else {
    const parser = query.q.defaultParsers?.[key];
    if (parser) setObjectValueImmutable(q, 'parsers', columnAs || key, parser);

    if (q.runtimeComputeds?.[key]) {
      const computed = q.runtimeComputeds[key];
      _addToHookSelect(query, computed.deps);

      query.q.selectedComputeds = {
        ...query.q.selectedComputeds,
        [columnAlias || key]: computed,
      };
      return;
    }
  }

  return key;
};

// is mapping the result of a query into a columns shape
// in this way, the result of a sub query becomes available outside of it for using in WHERE and other methods
//
// when isSubQuery is true, it will remove data.name of columns,
// so that outside of the sub-query the columns are named with app-side names,
// while db column names are encapsulated inside the sub-query
export const getShapeFromSelect = (
  q: IsQuery,
  isSubQuery?: boolean,
): Column.QueryColumns => {
  const query = (q as Query).q;
  const { shape } = query;
  let select: SelectItem[] | undefined;

  if (query.selectedComputeds) {
    select = query.select ? [...query.select] : [];
    for (const key in query.selectedComputeds) {
      select.push(...query.selectedComputeds[key].deps);
    }
  } else {
    select = query.select;
  }

  let result: Column.QueryColumns;
  if (!select) {
    if (query.type) {
      // mutative queries with no select are returning nothing
      result = {};
    } else if (isSubQuery) {
      // when no select, and it is a sub-query, return the table shape with unnamed columns
      result = {};
      for (const key in shape) {
        const column = shape[key];
        if (!column.data.explicitSelect) {
          result[key] = column.data.name
            ? setColumnData(column, 'name', undefined)
            : column;
        }
      }
    } else {
      result = shape;
    }
  } else {
    result = {};
    for (const item of select) {
      if (typeof item === 'string') {
        addColumnToShapeFromSelect(q, item, shape, query, result, isSubQuery);
      } else if (isExpression(item)) {
        result.value = item.result.value;
      } else if (item && 'selectAs' in item) {
        for (const key in item.selectAs) {
          const it = item.selectAs[key];
          if (typeof it === 'string') {
            addColumnToShapeFromSelect(
              q,
              it,
              shape,
              query,
              result,
              isSubQuery,
              key,
            );
          } else if (isExpression(it)) {
            result[key] = it.result.value || UnknownColumn.instance;
          } else if (it) {
            const { returnType } = it.q;
            if (returnType === 'value' || returnType === 'valueOrThrow') {
              const type = it.q.getColumn;
              result[key] = type
                ? mapSubSelectColumn(
                    type as unknown as Column.Pick.Data,
                    isSubQuery,
                  )
                : UnknownColumn.instance;
            } else {
              result[key] = new JSONTextColumn(defaultSchemaConfig);
            }
          }
        }
      }
    }
  }

  return result;
};

// converts selected items into a shape of columns
// when `isSubQuery` is true, it un-names named columns
const addColumnToShapeFromSelect = (
  q: IsQuery,
  arg: string,
  shape: Column.QueryColumns,
  query: QueryData,
  result: Column.QueryColumns,
  isSubQuery?: boolean,
  key?: string,
) => {
  const index = arg.indexOf('.');
  if (index !== -1) {
    const as = (q as Query).q.as || (q as Query).table;
    const table = getFullColumnTable(q, arg, index, as);
    const column = arg.slice(index + 1);
    if (table === as) {
      result[key || column] = shape[column];
    } else {
      const it = query.joinedShapes?.[table]?.[column];
      if (it)
        result[key || column] = mapSubSelectColumn(
          it as unknown as Column.Pick.Data,
          isSubQuery,
        );
    }
  } else if (arg === '*') {
    for (const key in shape) {
      if (!(shape[key] as unknown as Column.Pick.Data).data.explicitSelect) {
        result[key] = mapSubSelectColumn(
          shape[key] as unknown as Column.Pick.Data,
          isSubQuery,
        );
      }
    }
  } else {
    result[key || arg] = mapSubSelectColumn(
      shape[arg] as unknown as Column.Pick.Data,
      isSubQuery,
    );
  }
};

// un-name a column if `isSubQuery` is true
const mapSubSelectColumn = (column: Column.Pick.Data, isSubQuery?: boolean) => {
  // `!column` is needed for case when wrong column is passed to subquery (see issue #236)
  if (
    !isSubQuery ||
    !column ||
    (!column.data.name && !column.data.explicitSelect)
  ) {
    return column;
  }

  const cloned = Object.create(column);
  cloned.data = { ...column.data, name: undefined, explicitSelect: undefined };
  return cloned;
};
