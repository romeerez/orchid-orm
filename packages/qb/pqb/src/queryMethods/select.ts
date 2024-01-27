import { GetQueryResult, Query, QueryReturnsAll } from '../query/query';
import {
  ColumnsShapeToNullableObject,
  ColumnsShapeToObject,
  ColumnsShapeToObjectArray,
  ColumnsShapeToPluck,
} from '../columns';
import { JSONTextColumn } from '../columns/json';
import { pushQueryArray } from '../query/queryUtils';
import { SelectItem, SelectQueryData } from '../sql';
import { QueryResult } from '../adapter';
import {
  applyTransforms,
  ColumnTypeBase,
  emptyArray,
  emptyObject,
  Expression,
  getValueKey,
  isExpression,
  QueryCatch,
  QueryColumn,
  QueryColumns,
  QueryThen,
  setColumnData,
  setParserToQuery,
  StringKey,
} from 'orchid-core';
import { QueryBase } from '../query/queryBase';
import { _joinLateral } from './join/_join';
import {
  resolveSubQueryCallback,
  SelectableOrExpression,
} from '../common/utils';
import { RawSQL } from '../sql/rawSql';
import { defaultSchemaConfig } from '../columns/defaultSchemaConfig';

// .select method argument.
export type SelectArg<T extends Query> = '*' | keyof T['selectable'];

// .select method object argument.
// Key is alias for selected item,
// value can be a column, raw, or a function returning query or raw.
type SelectAsArg<T extends Query> = Record<string, SelectAsValue<T>>;

// .select method object argument value.
// Can be column, raw, or a function returning query or raw.
type SelectAsValue<T extends Query> =
  | StringKey<keyof T['selectable']>
  | Expression
  | ((q: SelectSubQueryArg<T>) => QueryBase | Expression);

type SelectSubQueryArg<T extends Query> = {
  [K in keyof T]: K extends keyof T['relations']
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      T[K] extends (...args: any) => any
      ? ReturnType<T[K]>
      : T[K]
    : T[K];
};

// Result type of select without the ending object argument.
type SelectResult<
  T extends Query,
  Columns extends SelectArg<T>[],
  Result extends QueryColumns = {
    [K in
      | ('*' extends Columns[number]
          ? Exclude<Columns[number], '*'> | keyof T['shape']
          : Columns[number])
      | PrevResultKeys<T> as K extends keyof T['selectable']
      ? T['selectable'][K]['as']
      : K]: K extends keyof T['selectable']
      ? T['selectable'][K]['column']
      : K extends keyof T['result']
      ? T['result'][K]
      : never;
  },
  Data = GetQueryResult<T['returnType'], Result>,
> = {
  [K in keyof T]: K extends 'meta'
    ? SetMetaHasSelect<T>
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

// Result type of select with the ending object argument.
type SelectResultWithObj<
  T extends Query,
  Columns extends SelectArg<T>[],
  Obj extends SelectAsArg<T>,
  // Combine previously selected items, all columns if * was provided,
  // and the selected by string and object arguments.
  Result extends QueryColumns = {
    [K in
      | ('*' extends Columns[number]
          ? Exclude<Columns[number], '*'> | keyof T['shape']
          : Columns[number])
      | keyof Obj
      | PrevResultKeys<T> as K extends keyof T['selectable']
      ? T['selectable'][K]['as']
      : K]: K extends keyof T['selectable']
      ? T['selectable'][K]['column']
      : K extends keyof Obj
      ? SelectAsValueResult<T, Obj[K]>
      : K extends keyof T['result']
      ? T['result'][K]
      : never;
  },
  Data = GetQueryResult<T['returnType'], Result>,
> = {
  [K in keyof T]: K extends 'meta'
    ? SetMetaHasSelect<T>
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : K extends 'selectable'
    ? SelectAsSelectable<T, Obj>
    : T[K];
};

// Previous result keys to preserve, if the query has select.
type PrevResultKeys<T extends Query> = T['meta']['hasSelect'] extends true
  ? keyof T['result']
  : never;

// Merge { hasSelect: true } into 'meta' if it's not true yet.
type SetMetaHasSelect<T extends Query> = T['meta']['hasSelect'] extends true
  ? T['meta']
  : {
      [K in keyof T['meta'] | 'hasSelect']: K extends 'hasSelect'
        ? true
        : T['meta'][K];
    };

// Add new 'selectable' types based on the select object argument.
type SelectAsSelectable<T extends Query, Arg extends SelectAsArg<T>> = {
  [K in keyof Arg]: Arg[K] extends ((q: never) => infer R extends QueryBase)
    ? // turn union of objects into intersection
      // https://stackoverflow.com/questions/66445084/intersection-of-an-objects-value-types-in-typescript
      (x: {
        [C in keyof R['result'] as `${StringKey<K>}.${StringKey<C>}`]: {
          as: C;
          column: R['result'][C];
        };
      }) => void
    : never;
}[keyof Arg] extends (x: infer I) => void
  ? {
      [K in keyof T['selectable'] | keyof I]: K extends keyof I
        ? I[K]
        : T['selectable'][K];
    }
  : never;

// map a single value of select object arg into a column
type SelectAsValueResult<
  T extends Query,
  Arg extends SelectAsValue<T>,
> = Arg extends keyof T['selectable']
  ? T['selectable'][Arg]['column']
  : Arg extends Expression
  ? Arg['_type']
  : Arg extends (q: never) => infer R
  ? R extends QueryBase
    ? SelectSubQueryResult<R>
    : R extends Expression
    ? R['_type']
    : R extends QueryBase | Expression
    ?
        | SelectSubQueryResult<Exclude<R, Expression>>
        | Exclude<R, QueryBase>['_type']
    : never
  : never;

// map a sub query result into a column
// query that returns many becomes an array column
// query that returns a single value becomes a column of that value
// query that returns 'pluck' becomes a column with array type of specific value type
// query that returns a single record becomes an object column, possibly nullable
export type SelectSubQueryResult<Arg extends QueryBase> = QueryReturnsAll<
  Arg['returnType']
> extends true
  ? ColumnsShapeToObjectArray<Arg['result']>
  : Arg['returnType'] extends 'valueOrThrow'
  ? Arg['result']['value']
  : Arg['returnType'] extends 'pluck'
  ? ColumnsShapeToPluck<Arg['result']>
  : Arg extends { relationConfig: { required: true } }
  ? ColumnsShapeToObject<Arg['result']>
  : ColumnsShapeToNullableObject<Arg['result']>;

// add a parser for a raw expression column
// is used by .select and .get methods
export const addParserForRawExpression = (
  q: Pick<Query, 'q'>,
  key: string | getValueKey,
  raw: Expression,
) => {
  const type = raw._type as unknown as ColumnTypeBase;
  if (type.parseFn) setParserToQuery(q.q, key, type.parseFn);
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
  q: Pick<Query, 'q'>,
  arg: string,
  as: string | getValueKey = arg,
) => {
  const parsers = q.q.joinedParsers?.[arg];
  if (parsers) {
    setParserToQuery(q.q, as, (item) => {
      subQueryResult.rows = [item];
      return q.q.handleResult(q as Query, 'one', subQueryResult, true);
    });
  }
};

// add parser for a single key-value pair of selected object
export const addParserForSelectItem = <T extends Query>(
  q: T,
  as: string | getValueKey | undefined,
  key: string,
  arg: SelectableOrExpression<T> | Query,
): string | Expression | Query => {
  if (typeof arg === 'object' || typeof arg === 'function') {
    if (isExpression(arg)) {
      addParserForRawExpression(q, key, arg);
    } else {
      const { q: query } = arg;
      if (query.parsers || query.transform) {
        setParserToQuery(q.q, key, (item) => {
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
    }
  } else {
    setParserForSelectedString(q, arg, as, key);
  }

  return arg;
};

// reuse SQL for empty array for JSON agg expressions
const emptyArrSQL = new RawSQL("'[]'");

// process select argument: add parsers, join relations when needed
export const processSelectArg = <T extends Query>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem => {
  if (typeof arg === 'string') {
    setParserForSelectedString(q, arg, as, columnAs);
    return arg;
  }

  const selectAs: Record<string, string | Query | Expression> = {};

  for (const key in arg as unknown as SelectAsArg<T>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value = (arg as unknown as SelectAsArg<T>)[key] as any;

    if (typeof value === 'function') {
      value = resolveSubQueryCallback(q, value);

      if (!isExpression(value) && value.joinQuery) {
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
          const joinOverrides = (q.q.joinOverrides ??= {});
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

    selectAs[key] = addParserForSelectItem(q, as, key, value);
  }

  return { selectAs };
};

// process string select arg
// adds a column parser for a column
// when table.* string is provided, sets a parser for a joined table
export const setParserForSelectedString = (
  q: Pick<Query, 'q'>,
  arg: string,
  as: string | getValueKey | undefined,
  columnAs?: string | getValueKey,
): void => {
  const index = arg.indexOf('.');
  if (index !== -1) {
    const table = arg.slice(0, index);
    const column = arg.slice(index + 1);

    // 'table.*' is selecting a full joined record
    if (column === '*') {
      addParsersForSelectJoined(q, table, columnAs);
    } else {
      if (table === as) {
        const parser = q.q.parsers?.[column];
        if (parser) setParserToQuery(q.q, columnAs || column, parser);
      } else {
        const parser = q.q.joinedParsers?.[table]?.[column];
        if (parser) setParserToQuery(q.q, columnAs || column, parser);
      }
    }
  } else {
    const parser = q.q.parsers?.[arg];
    if (parser) setParserToQuery(q.q, columnAs || arg, parser);
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
            result[key] = it._type as unknown as ColumnTypeBase;
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
  if (q.relations[arg] as unknown as boolean) {
    result[key || arg] = emptyObject as QueryColumn;
    return;
  }

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
  return isSubQuery && (column as ColumnTypeBase).data.name
    ? setColumnData(column as ColumnTypeBase, 'name', undefined)
    : column;
};

export function _querySelect<T extends Query, Columns extends SelectArg<T>[]>(
  q: T,
  args: Columns,
): SelectResult<T, Columns>;
export function _querySelect<
  T extends Query,
  Columns extends SelectArg<T>[],
  Obj extends SelectAsArg<T>,
>(
  q: T,
  args: [...columns: Columns, obj: Obj],
): SelectResultWithObj<T, Columns, Obj>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _querySelect(q: Query, args: any[]) {
  if (!args.length) {
    return q;
  }

  const as = q.q.as || q.table;
  const selectArgs = args.map((item) => processSelectArg(q, as, item));

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
   * // select raw SQL value, the first argument of `raw` is a column type, it is used for return type of the query
   * db.table.select({
   *   raw: db.table.sql((t) => t.integer())`1 + 2`,
   * });
   *
   * // same raw SQL query as above, but raw value is returned from a callback
   * db.table.select({
   *   raw: (q) => q.sql((t) => t.integer())`1 + 2`,
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
  select<T extends Query, Columns extends SelectArg<T>[]>(
    this: T,
    ...args: Columns
  ): SelectResult<T, Columns>;
  select<
    T extends Query,
    Columns extends SelectArg<T>[],
    Obj extends SelectAsArg<T>,
  >(
    this: T,
    ...args: [...columns: Columns, obj: Obj]
  ): SelectResultWithObj<T, Columns, Obj>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select(this: Query, ...args: any[]) {
    return _querySelect(this.clone(), args);
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
  selectAll<T extends Query>(this: T): SelectResult<T, ['*']> {
    const q = this.clone();
    q.q.select = ['*'];
    return q as unknown as SelectResult<T, ['*']>;
  }
}
