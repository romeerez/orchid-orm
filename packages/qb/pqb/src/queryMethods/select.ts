import {
  PickQueryQ,
  PickQueryQAndInternal,
  Query,
  QueryMetaHasSelect,
} from '../query/query';
import {
  addColumnParserToQuery,
  ColumnsShapeToNullableObject,
  ColumnsShapeToObject,
  ColumnsShapeToObjectArray,
  ColumnsShapeToPluck,
} from '../columns';
import { JSONTextColumn } from '../columns/json';
import {
  _clone,
  getFullColumnTable,
  pushQueryArrayImmutable,
  pushQueryValueImmutable,
} from '../query/queryUtils';
import {
  QueryData,
  SelectAsValue,
  SelectItem,
  SelectQueryData,
  ToSQLQuery,
} from '../sql';
import {
  BatchParser,
  ColumnTypeBase,
  EmptyObject,
  Expression,
  getValueKey,
  HookSelect,
  isExpression,
  IsQuery,
  PickQueryMeta,
  PickQueryReturnType,
  QueryColumns,
  QueryMetaBase,
  QueryMetaIsSubQuery,
  QueryReturnType,
  QueryThenByReturnType,
  RecordString,
  RecordUnknown,
  setColumnData,
  setObjectValueImmutable,
  setParserToQuery,
  UnionToIntersection,
} from 'orchid-core';
import { _joinLateral } from './join/_join';
import {
  resolveSubQueryCallbackV2,
  SelectableOrExpression,
} from '../common/utils';
import { RawSQL } from '../sql/rawSql';
import { defaultSchemaConfig } from '../columns/defaultSchemaConfig';
import { RelationsBase } from '../relations';
import { parseRecord } from './then';
import { _queryNone, isQueryNone } from './none';
import { NotFoundError } from '../errors';

import { ComputedColumns, processComputedBatches } from '../modules/computed';
import {
  applyBatchTransforms,
  finalizeNestedHookSelect,
} from '../common/queryResultProcessing';
import { cloneQueryBaseUnscoped } from './queryMethods.utils';

interface SelectSelf {
  shape: QueryColumns;
  relations: RelationsBase;
  result: QueryColumns;
  meta: QueryMetaBase;
  returnType: QueryReturnType;
  withData: EmptyObject;
}

// .select method argument.
export type SelectArg<T extends SelectSelf> =
  | '*'
  | keyof T['meta']['selectable'];

export type SelectArgs<T extends SelectSelf> = (
  | '*'
  | keyof T['meta']['selectable']
)[];

interface SubQueryAddition<T extends SelectSelf> extends QueryMetaIsSubQuery {
  withData: T['withData']; // to refer to the outside `.with` from a relation query
}

// .select method object argument.
// Key is alias for selected item,
// value can be a column, raw, or a function returning query or raw.
interface SelectAsArg<T extends SelectSelf> {
  [K: string]:
    | keyof T['meta']['selectable']
    | Expression
    | ((
        q: EmptyObject extends T['relations']
          ? T
          : {
              [K in
                | keyof T['relations']
                | keyof T]: K extends keyof T['relations']
                ? T['relations'][K]['relationConfig']['maybeSingle'] &
                    SubQueryAddition<T>
                : K extends keyof T
                ? T[K]
                : never;
            },
      ) => unknown);
}

type SelectAsFnReturnType =
  | { result: QueryColumns; returnType: Exclude<QueryReturnType, 'rows'> }
  | Expression;

interface SelectAsCheckReturnTypes {
  [K: string]: PropertyKey | Expression | ((q: never) => SelectAsFnReturnType);
}

type SelectReturnType<T extends PickQueryReturnType> =
  T['returnType'] extends 'valueOrThrow'
    ? 'oneOrThrow'
    : T extends 'value'
    ? 'one'
    : T['returnType'] extends 'pluck'
    ? 'all'
    : T['returnType'];

// Result type of select without the ending object argument.
type SelectResult<T extends SelectSelf, Columns extends PropertyKey[]> = {
  [K in keyof T]: K extends 'result'
    ? {
        [K in '*' extends Columns[number]
          ? Exclude<Columns[number], '*'> | T['meta']['defaultSelect']
          : Columns[number] as T['meta']['selectable'][K]['as']]: T['meta']['selectable'][K]['column'];
      } & (T['meta']['hasSelect'] extends (
        T['returnType'] extends 'value' | 'valueOrThrow' ? never : true
      )
        ? Omit<T['result'], Columns[number]> // Omit is optimal
        : unknown)
    : K extends 'returnType'
    ? SelectReturnType<T>
    : K extends 'then'
    ? QueryThenByReturnType<
        SelectReturnType<T>,
        // the result is copy-pasted to save on TS instantiations
        {
          [K in '*' extends Columns[number]
            ? Exclude<Columns[number], '*'> | T['meta']['defaultSelect']
            : Columns[number] as T['meta']['selectable'][K]['as']]: T['meta']['selectable'][K]['column'];
        } & (T['meta']['hasSelect'] extends (
          T['returnType'] extends 'value' | 'valueOrThrow' ? never : true
        )
          ? Omit<T['result'], Columns[number]>
          : unknown)
      >
    : T[K];
} & QueryMetaHasSelect;

type SelectResultObj<
  T extends SelectSelf,
  Obj,
> = Obj extends SelectAsCheckReturnTypes
  ? {
      [K in keyof T]: K extends 'meta'
        ? T['meta'] & SelectAsMeta<Obj>
        : K extends 'result'
        ? // Combine previously selected items, all columns if * was provided,
          // and the selected by string and object arguments.
          {
            [K in T['meta']['hasSelect'] extends (
              T['returnType'] extends 'value' | 'valueOrThrow' ? never : true
            )
              ? keyof Obj | keyof T['result']
              : keyof Obj]: K extends keyof Obj
              ? SelectAsValueResult<T, Obj[K]>
              : K extends keyof T['result']
              ? T['result'][K]
              : never;
          }
        : K extends 'returnType'
        ? SelectReturnType<T>
        : K extends 'then'
        ? QueryThenByReturnType<
            SelectReturnType<T>,
            // result is copy-pasted to save on TS instantiations
            {
              [K in T['meta']['hasSelect'] extends (
                T['returnType'] extends 'value' | 'valueOrThrow' ? never : true
              )
                ? keyof Obj | keyof T['result']
                : keyof Obj]: K extends keyof Obj
                ? SelectAsValueResult<T, Obj[K]>
                : K extends keyof T['result']
                ? T['result'][K]
                : never;
            }
          >
        : T[K];
    }
  : `Invalid return type of ${{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [K in keyof Obj]: Obj[K] extends (...args: any[]) => any
        ? ReturnType<Obj[K]> extends SelectAsFnReturnType
          ? never
          : K
        : never;
    }[keyof Obj] &
      string}`;

// Result type of select with the ending object argument.
type SelectResultColumnsAndObj<
  T extends SelectSelf,
  Columns extends PropertyKey[],
  Obj,
> = {
  [K in keyof T]: K extends 'meta'
    ? T['meta'] & SelectAsMeta<Obj>
    : K extends 'result'
    ? // Combine previously selected items, all columns if * was provided,
      // and the selected by string and object arguments.
      {
        [K in
          | ('*' extends Columns[number]
              ? Exclude<Columns[number], '*'> | T['meta']['defaultSelect']
              : Columns[number])
          | keyof Obj as K extends Columns[number]
          ? T['meta']['selectable'][K]['as']
          : K]: K extends keyof Obj
          ? SelectAsValueResult<T, Obj[K]>
          : T['meta']['selectable'][K]['column'];
      } & (T['meta']['hasSelect'] extends (
        T['returnType'] extends 'value' | 'valueOrThrow' ? never : true
      )
        ? Omit<T['result'], Columns[number]>
        : unknown)
    : K extends 'returnType'
    ? SelectReturnType<T>
    : K extends 'then'
    ? QueryThenByReturnType<
        SelectReturnType<T>,
        // result is copy-pasted to save on TS instantiations
        {
          [K in
            | ('*' extends Columns[number]
                ? Exclude<Columns[number], '*'> | T['meta']['defaultSelect']
                : Columns[number])
            | keyof Obj as K extends Columns[number]
            ? T['meta']['selectable'][K]['as']
            : K]: K extends keyof Obj
            ? SelectAsValueResult<T, Obj[K]>
            : T['meta']['selectable'][K]['column'];
        } & (T['meta']['hasSelect'] extends (
          T['returnType'] extends 'value' | 'valueOrThrow' ? never : true
        )
          ? Omit<T['result'], Columns[number]>
          : unknown)
      >
    : T[K];
};

// Add new 'selectable' types based on the select object argument.
type SelectAsMeta<Obj> = {
  // type is better than interface here

  hasSelect: true;
  selectable: UnionToIntersection<
    {
      [K in keyof Obj]: Obj[K] extends (q: never) => {
        result: QueryColumns;
        returnType: infer R;
      }
        ? {
            [C in R extends 'value' | 'valueOrThrow'
              ? K
              : keyof ReturnType<Obj[K]>['result'] as R extends
              | 'value'
              | 'valueOrThrow'
              ? K
              : `${K & string}.${C & string}`]: {
              as: C;
              column: R extends 'value' | 'valueOrThrow'
                ? ReturnType<Obj[K]>['result']['value']
                : ReturnType<Obj[K]>['result'][C];
            };
          }
        : Obj[K] extends Expression
        ? {
            [P in K]: {
              as: K;
              column: Obj[K]['result']['value'];
            };
          }
        : never;
    }[keyof Obj]
  >;
};

// map a single value of select object arg into a column
type SelectAsValueResult<
  T extends SelectSelf,
  Arg,
> = Arg extends keyof T['meta']['selectable']
  ? T['meta']['selectable'][Arg]['column']
  : Arg extends Expression
  ? Arg['result']['value']
  : Arg extends (q: never) => IsQuery
  ? SelectSubQueryResult<ReturnType<Arg>>
  : Arg extends (q: never) => Expression
  ? ReturnType<Arg>['result']['value']
  : Arg extends (q: never) => IsQuery | Expression
  ?
      | SelectSubQueryResult<Exclude<ReturnType<Arg>, Expression>>
      | Exclude<ReturnType<Arg>, IsQuery>['result']['value']
  : never;

// map a sub query result into a column
// query that returns many becomes an array column
// query that returns a single value becomes a column of that value
// query that returns 'pluck' becomes a column with array type of specific value type
// query that returns a single record becomes an object column, possibly nullable
export type SelectSubQueryResult<Arg extends SelectSelf> =
  Arg['returnType'] extends undefined | 'all'
    ? ColumnsShapeToObjectArray<Arg['result']>
    : Arg['returnType'] extends 'value' | 'valueOrThrow'
    ? Arg['result']['value']
    : Arg['returnType'] extends 'pluck'
    ? ColumnsShapeToPluck<Arg['result']>
    : Arg['returnType'] extends 'one'
    ? ColumnsShapeToNullableObject<Arg['result']>
    : ColumnsShapeToObject<Arg['result']>;

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
export const addParserForSelectItem = <T extends PickQueryMeta>(
  q: T,
  as: string | getValueKey | undefined,
  key: string,
  arg: SelectableOrExpression<T> | Query,
  joinQuery?: boolean,
): string | Expression | Query | undefined => {
  if (typeof arg === 'object' || typeof arg === 'function') {
    const { q: query } = arg as Query;

    if (query.batchParsers) {
      pushQueryArrayImmutable(
        q as unknown as Query,
        'batchParsers',
        query.batchParsers.map((bp) => ({
          path: [key, ...bp.path],
          fn: bp.fn,
        })),
      );
    }

    if (query.hookSelect || query.parsers || query.transform) {
      pushQueryValueImmutable(q as unknown as Query, 'batchParsers', {
        path: [key],
        fn: (path, queryResult) => {
          const { rows } = queryResult;
          const originalReturnType = query.returnType || 'all';
          let returnType = originalReturnType;
          const { hookSelect } = query;
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
              const { parsers } = query;
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
              const { parsers } = query;
              if (parsers) {
                if (returnType === 'one') {
                  for (const batch of batches) {
                    if (batch.data) parseRecord(parsers, batch.data);
                    else batch.data = undefined; // null to undefined
                  }
                } else {
                  for (const { data } of batches) {
                    if (!data) throw new NotFoundError(arg as Query);
                    parseRecord(parsers, data);
                  }
                }
              } else if (returnType === 'one') {
                for (const batch of batches) {
                  if (!batch.data) batch.data = undefined; // null to undefined
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
              const parse = query.parsers?.pluck;
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
              const parse = query.parsers?.[getValueKey];
              if (parse) {
                if (returnType === 'value') {
                  for (const item of batches) {
                    item.parent[item.key] = item.data =
                      item.data === undefined
                        ? query.notFoundDefault
                        : parse(item.data);
                  }
                } else {
                  for (const item of batches) {
                    if (item.data === undefined)
                      throw new NotFoundError(arg as Query);

                    item.parent[item.key] = item.data = parse(item.data);
                  }
                }
              } else if (returnType !== 'value') {
                for (const { data } of batches) {
                  if (data === undefined) throw new NotFoundError(arg as Query);
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
              const as = hookSelect!.get(column)!.as;
              if (as) (renames ??= {})[column] = as;

              (tempColumns ??= new Set())?.add(as || column);
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

            if (query.selectedComputeds) {
              const maybePromise = processComputedBatches(
                query,
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

          applyBatchTransforms(query, batches);
          return;
        },
      } as BatchParser);
    }

    if (!joinQuery && (arg as Query).q?.subQuery && arg.q.expr) {
      arg = arg.q.expr;
    }

    if (isExpression(arg)) {
      addParserForRawExpression(q as never, key, arg);
      return arg;
    }

    return arg;
  }

  return setParserForSelectedString(q as never, arg as string, as, key);
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
const emptyArrSQL = new RawSQL("'[]'");

// process select argument: add parsers, join relations when needed
export const processSelectArg = <T extends SelectSelf>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem | undefined | false => {
  if (typeof arg === 'string') {
    return setParserForSelectedString(q as unknown as Query, arg, as, columnAs);
  }

  const selectAs: SelectAsValue = {};
  let aliases: RecordString | undefined;

  for (const key in arg as unknown as SelectAsArg<T>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value = (arg as unknown as SelectAsArg<T>)[key] as any;
    let joinQuery: boolean | undefined;

    if (typeof value === 'function') {
      value = resolveSubQueryCallbackV2(q as unknown as ToSQLQuery, value);

      if (isQueryNone(value)) {
        if (value.q.innerJoinLateral) {
          return false;
        }
      }

      if (!isExpression(value) && value.joinQuery) {
        joinQuery = true;

        value = value.joinQuery(value, q);

        let query;
        const returnType = value.q.returnType;
        if (!returnType || returnType === 'all') {
          query = value.json(false);
          value.q.coalesceValue = emptyArrSQL;
        } else if (returnType === 'pluck') {
          // no select in case of plucking a computed
          query = value.q.select
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

              query = value;
            } else {
              query = value.json(false);
            }
          } else {
            query = value;
          }
        }

        const asOverride = value.q.aliases[key] ?? key;

        value.q.joinedForSelect = asOverride;

        if (asOverride !== key) {
          aliases = { ...(q as unknown as Query).q.aliases, [key]: asOverride };
        }

        _joinLateral(
          q,
          value.q.innerJoinLateral ? 'JOIN' : 'LEFT JOIN',
          query,
          key,
        );
      }
    }

    if (aliases) (q as unknown as Query).q.aliases = aliases;

    selectAs[key] = addParserForSelectItem(
      q as unknown as Query,
      as,
      key,
      value,
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
): string | undefined => {
  const { q } = query;
  const index = arg.indexOf('.');
  if (index === -1) return selectColumn(query, q, arg, columnAs);

  const table = getFullColumnTable(query as unknown as IsQuery, arg, index, as);
  const column = arg.slice(index + 1);

  // 'table.*' is selecting a full joined record (without computeds)
  if (column === '*') {
    addParsersForSelectJoined(query, table, columnAs);
    return table === as ? column : arg;
  }

  if (table === as) {
    return selectColumn(query, q, column, columnAs);
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
    const map: HookSelect = (q.hookSelect = new Map(q.hookSelect));
    for (const column of computed.deps) {
      map.set(column, { select: `${table}.${column}` });
    }

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
) => {
  if (columnAs && q.parsers) {
    const parser = q.parsers[key];
    if (parser) setObjectValueImmutable(q, 'parsers', columnAs, parser);
  }

  return handleComputed(query, q.computeds, key);
};

const handleComputed = (
  q: PickQueryQAndInternal,
  computeds: ComputedColumns | undefined,
  column: string,
) => {
  if (computeds?.[column]) {
    const computed = computeds[column];
    const map: HookSelect = (q.q.hookSelect = new Map(q.q.hookSelect));
    for (const column of computed.deps) {
      map.set(column, { select: column });
    }

    q.q.selectedComputeds = { ...q.q.selectedComputeds, [column]: computed };
    return;
  }

  return column;
};

// is mapping the result of a query into a columns shape
// in this way, the result of a sub query becomes available outside of it for using in WHERE and other methods
//
// when isSubQuery is true, it will remove data.name of columns,
// so that outside of the sub-query the columns are named with app-side names,
// while db column names are encapsulated inside the sub-query
export const getShapeFromSelect = (q: IsQuery, isSubQuery?: boolean) => {
  const query = (q as Query).q as SelectQueryData;
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

  let result: QueryColumns;
  if (!select) {
    // when no select, and it is a sub-query, return the table shape with unnamed columns
    if (isSubQuery) {
      result = {};
      for (const key in shape) {
        const column = shape[key];
        result[key] = column.data.name
          ? setColumnData(column, 'name', undefined)
          : column;
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
            result[key] = it.result.value as unknown as ColumnTypeBase;
          } else if (it) {
            const { returnType } = it.q;
            if (returnType === 'value' || returnType === 'valueOrThrow') {
              const type = it.q.getColumn;
              if (type) result[key] = type;
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
  shape: QueryColumns,
  query: SelectQueryData,
  result: QueryColumns,
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
          it as ColumnTypeBase,
          isSubQuery,
        );
    }
  } else if (arg === '*') {
    for (const key in shape) {
      result[key] = mapSubSelectColumn(
        shape[key] as ColumnTypeBase,
        isSubQuery,
      );
    }
  } else {
    result[key || arg] = mapSubSelectColumn(
      shape[arg] as ColumnTypeBase,
      isSubQuery,
    );
  }
};

// un-name a column if `isSubQuery` is true
const mapSubSelectColumn = (column: ColumnTypeBase, isSubQuery?: boolean) => {
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

export function _querySelect<
  T extends SelectSelf,
  Columns extends SelectArgs<T>,
>(q: T, columns: Columns): SelectResult<T, Columns>;
export function _querySelect<T extends SelectSelf, Obj extends SelectAsArg<T>>(
  q: T,
  obj: Obj,
): SelectResultObj<T, Obj>;
export function _querySelect<
  T extends SelectSelf,
  Columns extends SelectArgs<T>,
  Obj extends SelectAsArg<T>,
>(
  q: T,
  args: [...columns: Columns, obj: Obj],
): SelectResultColumnsAndObj<T, Columns, Obj>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _querySelect(q: Query, args: any[]): any {
  if (q.q.returning) {
    q.q.select = q.q.returning = undefined;
  }

  const { returnType } = q.q;
  if (returnType === 'valueOrThrow') {
    q.q.returnType = q.q.returningMany ? 'all' : 'oneOrThrow';
  } else if (returnType === 'value') {
    q.q.returnType = q.q.returningMany ? 'all' : 'one';
  }

  const len = args.length;
  if (!len) {
    q.q.select ??= [];
    return q;
  }

  const as = q.q.as || q.table;
  const selectArgs: SelectItem[] = [];
  for (const arg of args) {
    const item = processSelectArg(q, as, arg);
    if (item) selectArgs.push(item);
    else if (item === false) return _queryNone(q);
  }

  return pushQueryArrayImmutable(q, 'select', selectArgs);
}

export class Select {
  /**
   * Takes a list of columns to be selected, and by default, the query builder will select all columns of the table.
   *
   * The last argument can be an object. Keys of the object are column aliases, value can be a column name, sub-query, or raw SQL expression.
   *
   * ```ts
   * import { sql } from './baseTable'
   *
   * // select columns of the table:
   * db.table.select('id', 'name', { idAlias: 'id' });
   *
   * // accepts columns with table names:
   * db.table.select('user.id', 'user.name', { nameAlias: 'user.name' });
   *
   * // table name may refer to the current table or a joined table:
   * db.table
   *   .join(Message, 'authorId', 'user.id')
   *   .select('user.name', 'message.text', { textAlias: 'message.text' });
   *
   * // select value from the sub-query,
   * // this sub-query should return a single record and a single column:
   * db.table.select({
   *   subQueryResult: Otherdb.table.select('column').take(),
   * });
   *
   * // select raw SQL value, specify the returning type via <generic> syntax:
   * db.table.select({
   *   raw: sql<number>`1 + 2`,
   * });
   *
   * // select raw SQL value, the resulting type can be set by providing a column type in such way:
   * db.table.select({
   *   raw: sql`1 + 2`.type((t) => t.integer()),
   * });
   *
   * // same raw SQL query as above, but the sql is returned from a callback
   * db.table.select({
   *   raw: () => sql`1 + 2`.type((t) => t.integer()),
   * });
   * ```
   *
   * When you use the ORM and defined relations, `select` can also accept callbacks with related table queries:
   *
   * ```ts
   * await db.author.select({
   *   allBooks: (q) => q.books,
   *   firstBook: (q) => q.books.order({ createdAt: 'ASC' }).take(),
   *   booksCount: (q) => q.books.count(),
   * });
   * ```
   *
   * When you're selecting a relation that's connected via `belongsTo` or `hasOne`, it becomes available to use in `order` or in `where`:
   *
   * ```ts
   * // select books with their authors included, order by author name and filter by author column:
   * await db.books
   *   .select({
   *     author: (q) => q.author,
   *   })
   *   .order('author.name')
   *   .where({ 'author.isPopular': true });
   * ```
   */
  select<T extends SelectSelf, Columns extends SelectArgs<T>>(
    this: T,
    ...args: Columns
  ): SelectResult<T, Columns>;
  select<T extends SelectSelf, Obj extends SelectAsArg<T>>(
    this: T,
    obj: Obj,
  ): SelectResultObj<T, Obj>;
  select<
    T extends SelectSelf,
    Columns extends SelectArgs<T>,
    Obj extends SelectAsArg<T>,
  >(
    this: T,
    ...args: [...columns: Columns, obj: Obj]
  ): SelectResultColumnsAndObj<T, Columns, Obj>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select(this: SelectSelf, ...args: any[]): any {
    return _querySelect(_clone(this), args);
  }

  /**
   * When querying the table or creating records, all columns are selected by default,
   * but updating and deleting queries are returning affected row counts by default.
   *
   * Use `selectAll` to select all columns. If the `.select` method was applied before it will be discarded.
   *
   * ```ts
   * const selectFull = await db.table
   *   .select('id', 'name') // discarded by `selectAll`
   *   .selectAll();
   *
   * const updatedFull = await db.table.selectAll().where(conditions).update(data);
   *
   * const deletedFull = await db.table.selectAll().where(conditions).delete();
   * ```
   */
  selectAll<T extends SelectSelf>(this: T): SelectResult<T, ['*']> {
    const q = _clone(this);
    q.q.select = ['*'];
    if (q.q.returning) {
      q.q.returnType = q.q.returningMany ? 'all' : 'oneOrThrow';
      q.q.returning = undefined;
    }
    return q as never;
  }
}
