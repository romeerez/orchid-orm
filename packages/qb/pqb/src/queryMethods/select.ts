import {
  GetQueryResult,
  Query,
  QueryReturnsAll,
  SelectableBase,
} from '../query/query';
import {
  ArrayOfColumnsObjects,
  ColumnsObject,
  JSONTextColumn,
  PluckResultColumnType,
} from '../columns';
import { pushQueryArray } from '../query/queryUtils';
import { SelectItem, SelectQueryData } from '../sql';
import { QueryResult } from '../adapter';
import {
  applyTransforms,
  ColumnsShapeBase,
  ColumnTypeBase,
  emptyArray,
  EmptyObject,
  Expression,
  getValueKey,
  isExpression,
  NullableColumn,
  QueryCatch,
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
import { SelectAggMethods } from './aggregate';
import { getSubQueryBuilder } from '../query/subQueryBuilder';

// .select method argument
export type SelectArg<T extends Query> =
  | '*'
  | StringKey<keyof T['selectable']>
  | SelectAsArg<T>;

// .select method object argument
// key is alias for selected item,
// value can be a column, raw, or a function returning query or raw
type SelectAsArg<T extends Query> = Record<string, SelectAsValue<T>>;

// .select method object argument value
// can be column, raw, or a function returning query or raw
type SelectAsValue<T extends Query, SB = SelectQueryBuilder<T>> =
  | StringKey<keyof T['selectable']>
  | Expression
  | ((q: SB) => QueryBase)
  | ((q: SB) => Expression)
  | ((q: SB) => QueryBase | Expression);

export type SelectQueryBuilder<T extends Query, Agg = SelectAggMethods<T>> = {
  [K in
    | keyof Agg
    | 'columnTypes'
    | 'sql'
    | 'baseQuery'
    | keyof T['relations']]: K extends keyof Agg
    ? Agg[K]
    : K extends keyof T
    ? T[K]
    : never;
};

// tuple for the result of selected by objects args
// the first element is shape of selected data
// the second is 'selectable', it allows to order and filter by the records
// that were implicitly joined when selecting belongsTo or hasOne relation
// ```ts
// db.book.select({ author: (q) => q.author }).order('author.name')
// ```
type SelectObjectResultTuple = [ColumnsShapeBase, SelectableBase];

// query type after select
type SelectResult<
  T extends Query,
  Args extends SelectArg<T>[],
  // shape of the columns selected by string args
  SelectStringsResult extends ColumnsShapeBase = SelectStringArgsResult<
    T,
    Args
  >,
  // keys of selected columns by string args
  StringsKeys extends keyof SelectStringsResult = keyof SelectStringsResult,
  // tuple for the result of selected by objects args
  SelectAsResult extends SelectObjectResultTuple = SpreadSelectObjectArgs<
    T,
    Args,
    [EmptyObject, T['selectable']]
  >,
  // keys of combined object args
  AsKeys extends keyof SelectAsResult[0] = keyof SelectAsResult[0],
  // previous result keys to preserve, if the query has select
  ResultKeys extends keyof T['result'] = T['meta']['hasSelect'] extends true
    ? keyof T['result']
    : never,
  // to include all columns when * arg is provided
  ShapeKeys extends keyof T['shape'] = '*' extends Args[number]
    ? keyof T['shape']
    : never,
  // combine previously selected items, all columns if * was provided,
  // and the selected by string and object arguments
  Result extends ColumnsShapeBase = {
    [K in StringsKeys | AsKeys | ResultKeys | ShapeKeys]: K extends StringsKeys
      ? SelectStringsResult[K]
      : K extends AsKeys
      ? SelectAsResult[0][K]
      : K extends ResultKeys
      ? T['result'][K]
      : K extends ShapeKeys
      ? T['shape'][K]
      : never;
  },
  Data = GetQueryResult<T['returnType'], Result>,
> = (T['meta']['hasSelect'] extends true
  ? unknown
  : { meta: { hasSelect: true } }) & {
  [K in keyof T]: K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : K extends 'selectable'
    ? SelectAsResult[1]
    : T[K];
};

// map string args of the select into a resulting object
type SelectStringArgsResult<T extends Query, Args extends SelectArg<T>[]> = {
  [Arg in Args[number] as Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['as']
    : never]: Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['column']
    : never;
};

// combine multiple object args of the select into a tuple
type SpreadSelectObjectArgs<
  T extends Query,
  Args extends [...unknown[]],
  Result extends SelectObjectResultTuple,
> = Args extends [infer L, ...infer R]
  ? SpreadSelectObjectArgs<T, R, SelectAsResult<T, L, Result>>
  : Result;

// map a single object arg of the select into the tuple of selected data and selectable columns
type SelectAsResult<
  T extends Query,
  Arg,
  Result extends SelectObjectResultTuple,
  Shape = Result[0],
  AddSelectable extends SelectableBase = {
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
    ? { [K in keyof I]: I[K] }
    : never,
> = Arg extends SelectAsArg<T>
  ? [
      {
        [K in keyof Shape | keyof Arg]: K extends keyof Arg
          ? SelectAsValueResult<T, Arg[K]>
          : K extends keyof Shape
          ? Shape[K]
          : never;
      },
      Result[1] & AddSelectable,
    ]
  : Result;

// map a single value of select object arg into a column
type SelectAsValueResult<
  T extends Query,
  Arg extends SelectAsValue<T>,
> = Arg extends keyof T['selectable']
  ? T['selectable'][Arg]['column']
  : Arg extends Expression
  ? Arg['_type']
  : Arg extends (q: SelectQueryBuilder<T>) => infer R
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
type SelectSubQueryResult<Arg extends QueryBase> = QueryReturnsAll<
  Arg['returnType']
> extends true
  ? ArrayOfColumnsObjects<Arg['result']>
  : Arg['returnType'] extends 'valueOrThrow'
  ? Arg['result']['value']
  : Arg['returnType'] extends 'pluck'
  ? PluckResultColumnType<Arg['result']['pluck']>
  : Arg extends { relationConfig: { required: true } }
  ? ColumnsObject<Arg['result']>
  : NullableColumn<ColumnsObject<Arg['result']>>;

// add a parser for a raw expression column
// is used by .select and .get methods
export const addParserForRawExpression = (
  q: Query,
  key: string | getValueKey,
  raw: Expression,
) => {
  if (raw._type.parseFn) setParserToQuery(q.q, key, raw._type.parseFn);
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
  q: Query,
  arg: string,
  as: string | getValueKey = arg,
) => {
  const parsers = q.q.joinedParsers?.[arg];
  if (parsers) {
    setParserToQuery(q.q, as, (item) => {
      subQueryResult.rows = [item];
      return q.q.handleResult(q, 'one', subQueryResult, true);
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
  if (typeof arg === 'object') {
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
    setParserForStringArg(q, arg, as, key);
  }

  return arg;
};

// process select argument: add parsers, join relations when needed
export const processSelectArg = <T extends Query>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem => {
  if (typeof arg === 'string') {
    setParserForStringArg(q, arg, as, columnAs);
    return arg;
  }

  const selectAs: Record<string, string | Query | Expression> = {};

  for (const key in arg as SelectAsArg<T>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value = (arg as SelectAsArg<T>)[key] as any;

    if (typeof value === 'function') {
      const qb = getSubQueryBuilder(q);

      value = resolveSubQueryCallback(qb as unknown as Query, value);

      if (!isExpression(value) && value.joinQuery) {
        value = value.joinQuery(q, value);

        let query;
        const returnType = value.q.returnType;
        if (!returnType || returnType === 'all') {
          query = value.json(false);
          value.q.coalesceValue = new RawSQL("'[]'");
        } else if (returnType === 'pluck') {
          query = value
            .wrap(value.baseQuery.clone())
            ._jsonAgg(value.q.select[0]);
          value.q.coalesceValue = new RawSQL("'[]'");
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
      }
    }

    selectAs[key] = addParserForSelectItem(q, as, key, value);
  }

  return { selectAs };
};

// process string select arg
// adds a column parser for a column
// when table.* string is provided, sets a parser for a joined table
const setParserForStringArg = (
  q: Query,
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
  let result: ColumnsShapeBase;
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
            result[key] = it._type;
          } else {
            const { returnType } = it.q;
            if (returnType === 'value' || returnType === 'valueOrThrow') {
              const type = (it.q as SelectQueryData)[getValueKey];
              if (type) result[key] = type;
            } else {
              result[key] = new JSONTextColumn();
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
  shape: ColumnsShapeBase,
  query: SelectQueryData,
  result: ColumnsShapeBase,
  isSubQuery?: boolean,
  key?: string,
) => {
  if (q.relations[arg] as unknown as boolean) {
    result[key || arg] = new JSONTextColumn();
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
const maybeUnNameColumn = (column: ColumnTypeBase, isSubQuery?: boolean) => {
  return isSubQuery && column.data.name
    ? setColumnData(column, 'name', undefined)
    : column;
};

export class Select {
  /**
   * Takes a list of columns to be selected, and by default, the query builder will select all columns of the table.
   *
   * Pass an object to select columns with aliases. Keys of the object are column aliases, value can be a column name, sub-query, or raw expression.
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
  select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    return this.clone()._select(...args) as unknown as SelectResult<T, K>;
  }

  _select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    if (!args.length) {
      return this as unknown as SelectResult<T, K>;
    }

    const as = this.q.as || this.table;
    const selectArgs = args.map((item) => processSelectArg(this, as, item));

    return pushQueryArray(
      this,
      'select',
      selectArgs,
    ) as unknown as SelectResult<T, K>;
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
    return this.clone()._selectAll();
  }

  _selectAll<T extends Query>(this: T): SelectResult<T, ['*']> {
    this.q.select = ['*'];
    return this as unknown as SelectResult<T, ['*']>;
  }
}
