import {
  GetQueryResult,
  PickQueryQ,
  Query,
  QueryMetaHasSelect,
  QueryReturnsAll,
  WithDataBase,
} from '../query/query';
import {
  ColumnsShapeToNullableObject,
  ColumnsShapeToObject,
  ColumnsShapeToObjectArray,
  ColumnsShapeToPluck,
} from '../columns';
import { JSONTextColumn } from '../columns/json';
import { pushQueryArray, pushQueryValue } from '../query/queryUtils';
import { SelectItem, SelectQueryData, ToSQLQuery } from '../sql';
import { QueryResult } from '../adapter';
import {
  applyTransforms,
  ColumnTypeBase,
  emptyArray,
  Expression,
  getValueKey,
  isExpression,
  MaybeArray,
  PickQueryMeta,
  QueryColumn,
  QueryColumns,
  QueryMetaBase,
  QueryReturnType,
  QueryThen,
  RecordUnknown,
  setColumnData,
  setParserToQuery,
} from 'orchid-core';
import { QueryBase } from '../query/queryBase';
import { _joinLateral } from './join/_join';
import {
  resolveSubQueryCallback,
  SelectableOrExpression,
} from '../common/utils';
import { RawSQL } from '../sql/rawSql';
import { defaultSchemaConfig } from '../columns/defaultSchemaConfig';
import { RelationsBase } from '../relations';
import { parseRecord } from './then';
import { _queryNone, isQueryNone } from './none';
import { NotFoundError } from '../errors';

interface SelectSelf {
  shape: QueryColumns;
  relations: RelationsBase;
  result: QueryColumns;
  meta: QueryMetaBase;
  returnType: QueryReturnType;
  withData: WithDataBase;
}

// .select method argument.
export type SelectArg<T extends SelectSelf> =
  | '*'
  | keyof T['meta']['selectable'];

// .select method object argument.
// Key is alias for selected item,
// value can be a column, raw, or a function returning query or raw.
interface SelectAsArg<T extends SelectSelf> {
  [K: string]: SelectAsValue<T>;
}

// .select method object argument value.
// Can be column, raw, or a function returning query or raw.
type SelectAsValue<T extends SelectSelf> =
  | keyof T['meta']['selectable']
  | Expression
  | ((q: SelectSubQueryArg<T>) => QueryBase | Expression);

type SelectSubQueryArg<T extends SelectSelf> = {
  [K in keyof T]: K extends keyof T['relations']
    ? T['relations'][K]['relationConfig']['methodQuery']
    : T[K];
};

// Result type of select without the ending object argument.
type SelectResult<T extends SelectSelf, Columns extends PropertyKey[]> = {
  [K in keyof T]: K extends 'result'
    ? ('*' extends Columns[number]
        ? {
            [K in
              | Columns[number]
              | keyof T['shape'] as T['meta']['selectable'][K]['as']]: T['meta']['selectable'][K]['column'];
          }
        : {
            [K in Columns[number] as T['meta']['selectable'][K]['as']]: T['meta']['selectable'][K]['column'];
          }) &
        (T['meta']['hasSelect'] extends true
          ? Omit<T['result'], Columns[number]> // Omit is optimal
          : unknown)
    : K extends 'then'
    ? QueryThen<
        GetQueryResult<
          T,
          // result is copy-pasted to save on TS instantiations
          ('*' extends Columns[number]
            ? {
                [K in
                  | Columns[number]
                  | keyof T['shape'] as T['meta']['selectable'][K]['as']]: T['meta']['selectable'][K]['column'];
              }
            : {
                [K in Columns[number] as T['meta']['selectable'][K]['as']]: T['meta']['selectable'][K]['column'];
              }) &
            (T['meta']['hasSelect'] extends true
              ? Omit<T['result'], Columns[number]>
              : unknown)
        >
      >
    : T[K];
} & QueryMetaHasSelect;

type SelectResultObj<T extends SelectSelf, Obj> = {
  [K in keyof T]: K extends 'meta'
    ? T['meta'] & {
        selectable: SelectAsSelectable<Obj>;
      }
    : K extends 'result'
    ? // Combine previously selected items, all columns if * was provided,
      // and the selected by string and object arguments.
      {
        [K in
          | keyof Obj
          | (T['meta']['hasSelect'] extends true
              ? keyof T['result']
              : never)]: K extends keyof Obj
          ? SelectAsValueResult<T, Obj[K]>
          : K extends keyof T['result']
          ? T['result'][K]
          : never;
      }
    : K extends 'then'
    ? QueryThen<
        GetQueryResult<
          T,
          // result is copy-pasted to save on TS instantiations
          {
            [K in
              | keyof Obj
              | (T['meta']['hasSelect'] extends true
                  ? keyof T['result']
                  : never)]: K extends keyof Obj
              ? SelectAsValueResult<T, Obj[K]>
              : K extends keyof T['result']
              ? T['result'][K]
              : never;
          }
        >
      >
    : T[K];
} & QueryMetaHasSelect;

// Result type of select with the ending object argument.
type SelectResultColumnsAndObj<
  T extends SelectSelf,
  Columns extends PropertyKey[],
  Obj,
> = {
  [K in keyof T]: K extends 'meta'
    ? T['meta'] & {
        selectable: SelectAsSelectable<Obj>;
      }
    : K extends 'result'
    ? // Combine previously selected items, all columns if * was provided,
      // and the selected by string and object arguments.
      {
        [K in
          | ('*' extends Columns[number]
              ? Exclude<Columns[number], '*'> | keyof T['shape']
              : Columns[number])
          | keyof Obj as K extends keyof T['meta']['selectable']
          ? T['meta']['selectable'][K]['as']
          : K]: K extends keyof T['meta']['selectable']
          ? T['meta']['selectable'][K]['column']
          : K extends keyof Obj
          ? SelectAsValueResult<T, Obj[K]>
          : never;
      } & (T['meta']['hasSelect'] extends true
        ? Omit<T['result'], Columns[number]>
        : unknown)
    : K extends 'then'
    ? QueryThen<
        GetQueryResult<
          T,
          // result is copy-pasted to save on TS instantiations
          {
            [K in
              | ('*' extends Columns[number]
                  ? Exclude<Columns[number], '*'> | keyof T['shape']
                  : Columns[number])
              | keyof Obj as K extends keyof T['meta']['selectable']
              ? T['meta']['selectable'][K]['as']
              : K]: K extends keyof T['meta']['selectable']
              ? T['meta']['selectable'][K]['column']
              : K extends keyof Obj
              ? SelectAsValueResult<T, Obj[K]>
              : never;
          } & (T['meta']['hasSelect'] extends true
            ? Omit<T['result'], Columns[number]>
            : unknown)
        >
      >
    : T[K];
} & QueryMetaHasSelect;

// Add new 'selectable' types based on the select object argument.
type SelectAsSelectable<Arg> = {
  [K in keyof Arg]: Arg[K] extends (q: never) => {
    returnType: 'value' | 'valueOrThrow';
    result: QueryColumns;
  }
    ? {
        [P in K]: {
          as: K;
          column: ReturnType<Arg[K]>['result']['value'];
        };
      }
    : Arg[K] extends (q: never) => {
        result: QueryColumns;
      }
    ? {
        [C in keyof ReturnType<Arg[K]>['result'] & string as `${K &
          string}.${C}`]: {
          as: C;
          column: ReturnType<Arg[K]>['result'][C];
        };
      }
    : never;
}[keyof Arg];

// map a single value of select object arg into a column
type SelectAsValueResult<
  T extends SelectSelf,
  Arg,
> = Arg extends keyof T['meta']['selectable']
  ? T['meta']['selectable'][Arg]['column']
  : Arg extends Expression
  ? Arg['result']['value']
  : Arg extends (q: never) => QueryBase
  ? SelectSubQueryResult<ReturnType<Arg>>
  : Arg extends (q: never) => Expression
  ? ReturnType<Arg>['result']['value']
  : Arg extends (q: never) => QueryBase | Expression
  ?
      | SelectSubQueryResult<Exclude<ReturnType<Arg>, Expression>>
      | Exclude<ReturnType<Arg>, QueryBase>['result']['value']
  : never;

// map a sub query result into a column
// query that returns many becomes an array column
// query that returns a single value becomes a column of that value
// query that returns 'pluck' becomes a column with array type of specific value type
// query that returns a single record becomes an object column, possibly nullable
export type SelectSubQueryResult<Arg extends SelectSelf> = QueryReturnsAll<
  Arg['returnType']
> extends true
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
  const type = raw.result.value as unknown as ColumnTypeBase;
  if (type?.parseFn) setParserToQuery(q.q, key, type.parseFn);
};

// these are used as a wrapper to pass sub query result to `parseRecord`
const subQueryResult: QueryResult = {
  // sub query can't return a rowCount, use -1 as for impossible case
  rowCount: -1,
  rows: emptyArray,
  fields: emptyArray,
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
};

// add parser for a single key-value pair of selected object
export const addParserForSelectItem = <T extends PickQueryMeta>(
  q: T,
  as: string | getValueKey | undefined,
  key: string,
  arg: SelectableOrExpression<T> | Query,
): string | Expression | Query => {
  if (typeof arg === 'object' || typeof arg === 'function') {
    if (isExpression(arg)) {
      addParserForRawExpression(q as never, key, arg);
    } else {
      const { q: query } = arg;
      if (query.parsers || query.transform) {
        setParserToQuery((q as unknown as Query).q, key, (item) => {
          const t = query.returnType || 'all';

          subQueryResult.rows =
            t === 'value' || t === 'valueOrThrow'
              ? [[item]]
              : t === 'one' || t === 'oneOrThrow'
              ? [item]
              : (item as unknown[]);

          return applyTransforms(
            query.transform,
            query.handleResult(arg, t, subQueryResult, true),
          );
        });
      }

      if (
        query.returnType === 'valueOrThrow' ||
        query.returnType === 'oneOrThrow'
      ) {
        pushQueryValue(
          q as unknown as PickQueryQ,
          'transform',
          (data: MaybeArray<RecordUnknown>) => {
            if (Array.isArray(data)) {
              for (const item of data) {
                if (item[key as string] === undefined) {
                  throw new NotFoundError(q as unknown as Query);
                }
              }
            } else {
              if (data[key as string] === undefined) {
                throw new NotFoundError(q as unknown as Query);
              }
            }
            return data;
          },
        );
      }
    }
    return arg;
  }

  return setParserForSelectedString(q as never, arg as string, as, key);
};

// reuse SQL for empty array for JSON agg expressions
const emptyArrSQL = new RawSQL("'[]'");

// process select argument: add parsers, join relations when needed
export const processSelectArg = <T extends SelectSelf>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem | undefined => {
  if (typeof arg === 'string') {
    return setParserForSelectedString(q as unknown as Query, arg, as, columnAs);
  }

  const selectAs: { [K: string]: string | Query | Expression } = {};

  for (const key in arg as unknown as SelectAsArg<T>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value = (arg as unknown as SelectAsArg<T>)[key] as any;

    if (typeof value === 'function') {
      value = resolveSubQueryCallback(q as unknown as ToSQLQuery, value);

      if (isQueryNone(value)) {
        if (value.q.innerJoinLateral) {
          return;
        }
      } else if (!isExpression(value) && value.joinQuery) {
        value = value.joinQuery(value, q);

        let query;
        const returnType = value.q.returnType;
        if (!returnType || returnType === 'all') {
          query = value.json(false);
          value.q.coalesceValue = emptyArrSQL;
        } else if (returnType === 'pluck') {
          query = value
            .wrap(value.baseQuery.clone())
            .jsonAgg(value.q.select[0]);

          value.q.coalesceValue = emptyArrSQL;
        } else {
          if (
            (returnType === 'value' || returnType === 'valueOrThrow') &&
            value.q.select
          ) {
            // todo: investigate what is this for
            if (typeof value.q.select[0] === 'string') {
              value.q.select[0] = {
                selectAs: { r: value.q.select[0] },
              };
            }
          }

          query = value;
        }

        let asOverride = key;

        if (value.q.joinedShapes?.[key]) {
          let suffix = 2;
          const joinOverrides = ((q as unknown as Query).q.joinOverrides ??=
            {});
          while (joinOverrides[(asOverride = `${key}${suffix}`)]) {
            suffix++;
          }
          // aliases points to a table in a query
          joinOverrides[asOverride] = asOverride;
          // table name points to an alias
          joinOverrides[key] = asOverride;
        }

        value.q.joinedForSelect = asOverride;

        _joinLateral(
          q,
          value.q.innerJoinLateral ? 'JOIN' : 'LEFT JOIN',
          query,
          (q) => q,
          key,
        );
      } else if (value.q?.isSubQuery && value.q.expr) {
        value = value.q.expr;
      }
    }

    selectAs[key] = addParserForSelectItem(
      q as unknown as Query,
      as,
      key,
      value,
    );
  }

  return { selectAs };
};

// process string select arg
// adds a column parser for a column
// when table.* string is provided, sets a parser for a joined table
export const setParserForSelectedString = (
  q: PickQueryQ,
  arg: string,
  as: string | getValueKey | undefined,
  columnAs?: string | getValueKey,
): string => {
  const index = arg.indexOf('.');
  if (index !== -1) {
    const table = arg.slice(0, index);
    const column = arg.slice(index + 1);

    // 'table.*' is selecting a full joined record
    if (column === '*') {
      addParsersForSelectJoined(q, table, columnAs);
      return table === as ? column : arg;
    } else {
      if (table === as) {
        const parser = q.q.parsers?.[column];
        if (parser) setParserToQuery(q.q, columnAs || column, parser);
        return column;
      } else {
        const parser = q.q.joinedParsers?.[table]?.[column];
        if (parser) setParserToQuery(q.q, columnAs || column, parser);
        return arg;
      }
    }
  } else {
    const parser = q.q.parsers?.[arg];
    if (parser) setParserToQuery(q.q, columnAs || arg, parser);
    return arg;
  }
};

// is mapping result of a query into a columns shape
// in this way, result of a sub query becomes available outside of it for using in WHERE and other methods
//
// when isSubQuery is true, it will remove data.name of columns,
// so that outside of the sub-query the columns are named with app-side names,
// while db column names are encapsulated inside the sub-query
export const getShapeFromSelect = (q: QueryBase, isSubQuery?: boolean) => {
  const query = q.q as SelectQueryData;
  const { select, shape } = query;
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
      } else if ('selectAs' in item) {
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
          } else {
            const { returnType } = it.q;
            if (returnType === 'value' || returnType === 'valueOrThrow') {
              const type = (it.q as SelectQueryData)[getValueKey];
              if (type) result[key] = type;
            } else {
              result[key] = new JSONTextColumn(defaultSchemaConfig);
            }
          }
        }
      } else if (isExpression(item)) {
        result.value = item.result.value;
      }
    }
  }

  return result;
};

// converts selected items into a shape of columns
// when `isSubQuery` is true, it un-names named columns
const addColumnToShapeFromSelect = (
  q: QueryBase,
  arg: string,
  shape: QueryColumns,
  query: SelectQueryData,
  result: QueryColumns,
  isSubQuery?: boolean,
  key?: string,
) => {
  const index = arg.indexOf('.');
  if (index !== -1) {
    const table = arg.slice(0, index);
    const column = arg.slice(index + 1);
    if (table === (q.q.as || q.table)) {
      result[key || column] = shape[column];
    } else {
      const it = query.joinedShapes?.[table]?.[column];
      if (it) result[key || column] = maybeUnNameColumn(it, isSubQuery);
    }
  } else if (arg === '*') {
    for (const key in shape) {
      result[key] = maybeUnNameColumn(shape[key], isSubQuery);
    }
  } else {
    result[key || arg] = maybeUnNameColumn(shape[arg], isSubQuery);
  }
};

// un-name a column if `isSubQuery` is true
const maybeUnNameColumn = (column: QueryColumn, isSubQuery?: boolean) => {
  // `?` is needed for case when wrong column is passed to subquery (see issue #236)
  return isSubQuery && (column as ColumnTypeBase)?.data.name
    ? setColumnData(column as ColumnTypeBase, 'name', undefined)
    : column;
};

export function _querySelect<
  T extends SelectSelf,
  Columns extends SelectArg<T>[],
>(q: T, columns: Columns): SelectResult<T, Columns>;
export function _querySelect<T extends SelectSelf, Obj extends SelectAsArg<T>>(
  q: T,
  obj: Obj,
): SelectResultObj<T, Obj>;
export function _querySelect<
  T extends SelectSelf,
  Columns extends SelectArg<T>[],
  Obj extends SelectAsArg<T>,
>(
  q: T,
  args: [...columns: Columns, obj: Obj],
): SelectResultColumnsAndObj<T, Columns, Obj>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _querySelect(q: Query, args: any[]): any {
  const len = args.length;
  if (!len) {
    return q;
  }

  const as = q.q.as || q.table;
  const selectArgs = new Array(len) as (SelectItem | undefined)[];
  for (let i = 0; i < len; i++) {
    selectArgs[i] = processSelectArg(q, as, args[i]);
    if (!selectArgs[i]) {
      return _queryNone(q);
    }
  }

  return pushQueryArray(q, 'select', selectArgs);
}

export class Select {
  /**
   * Takes a list of columns to be selected, and by default, the query builder will select all columns of the table.
   *
   * The last argument can be an object. Keys of the object are column aliases, value can be a column name, sub-query, or raw SQL expression.
   *
   * ```ts
   * // select columns of the table:
   * db.table.select('id', 'name', { idAlias: 'id' });
   *
   * // accepts columns with table names:
   * db.table.select('user.id', 'user.name', { nameAlias: 'user.name' });
   *
   * // table name may refer to the current table or a joined table:
   * db.table
   *   .join(Message, 'authorId', 'id')
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
   * // same raw SQL query as above, but raw value is returned from a callback
   * db.table.select({
   *   raw: (q) => q.sql`1 + 2`.type((t) => t.integer()),
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
  select<T extends SelectSelf, Columns extends SelectArg<T>[]>(
    this: T,
    ...args: Columns
  ): SelectResult<T, Columns>;
  select<T extends SelectSelf, Obj extends SelectAsArg<T>>(
    this: T,
    obj: Obj,
  ): SelectResultObj<T, Obj>;
  select<
    T extends SelectSelf,
    Columns extends SelectArg<T>[],
    Obj extends SelectAsArg<T>,
  >(
    this: T,
    ...args: [...columns: Columns, obj: Obj]
  ): SelectResultColumnsAndObj<T, Columns, Obj>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select(this: SelectSelf, ...args: any[]): any {
    return _querySelect((this as Query).clone(), args);
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
    const q = (this as unknown as Query).clone();
    q.q.select = ['*'];
    return q as never;
  }
}
