import { IsQuery, Query, QueryMetaHasSelect, QueryReturnType } from '../../query';
import { pushQueryArrayImmutable } from '../../query.utils';
import { Column } from '../../../columns/column';
import { _queryNone } from '../../extra-features/none/none';
import { RelationsBase } from '../../relations';
import { EmptyObject, UnionToIntersection } from '../../../utils';
import {
  PickQueryQ,
  PickQueryRelationsWithData,
  PickQueryReturnType,
  PickQueryWithData,
} from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
import { ColumnsShape } from '../../../columns/columns-shape';
import { _clone } from '../clone/clone';
import { processSelectArg } from './select.utils';
import { QueryMetaBase, QueryMetaIsSubQuery } from '../../query-meta';
import { SelectItem } from './select.sql';
import { QueryThenByReturnType } from '../../then/then';

export interface SelectSelf {
  shape: Column.QueryColumns;
  relations: RelationsBase;
  result: Column.QueryColumns;
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

interface SubQueryAddition<T extends PickQueryWithData>
  extends QueryMetaIsSubQuery {
  withData: T['withData']; // to refer to the outside `.with` from a relation query
}

export type SelectAsFnArg<T extends PickQueryRelationsWithData> =
  EmptyObject extends T['relations']
    ? T
    : {
        [K in keyof T['relations'] | keyof T]: K extends keyof T['relations']
          ? T['relations'][K]['maybeSingle'] & SubQueryAddition<T>
          : K extends keyof T
          ? T[K]
          : never;
      };

// .select method object argument.
// Key is alias for selected item,
// value can be a column, raw, or a function returning query or raw.
export interface SelectAsArg<T extends SelectSelf> {
  [K: string]:
    | keyof T['meta']['selectable']
    | Expression
    | ((q: SelectAsFnArg<T>) => unknown);
}

type SelectAsFnReturnType =
  | {
      result: Column.QueryColumns;
      returnType: Exclude<QueryReturnType, 'rows'>;
    }
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

// To allow where-ing on a relation that returns a single value.
// Where-ing is allowed because relation is joined and the value is not JSON-ed.

// To allow where-ing on a relation that returns a single record.
// Where-ing is allowed because relation is joined and the row is not JSON-ed unlike selecting multiple rows.
interface AllowedRelationOneQueryForSelectable extends QueryMetaIsSubQuery {
  result: Column.QueryColumns;
  returnType: 'value' | 'valueOrThrow' | 'one' | 'oneOrThrow';
}

// Add new 'selectable' types based on the select object argument.
type SelectAsMeta<Obj> = {
  // type is better than interface here

  hasSelect: true;
  selectable: UnionToIntersection<
    {
      [K in keyof Obj]: Obj[K] extends ((
        q: never,
      ) => infer R extends AllowedRelationOneQueryForSelectable)
        ? {
            [C in R['returnType'] extends 'value' | 'valueOrThrow'
              ? K
              : keyof R['result'] as R['returnType'] extends
              | 'value'
              | 'valueOrThrow'
              ? K
              : `${K & string}.${C & string}`]: {
              as: C;
              column: R['returnType'] extends 'value' | 'valueOrThrow'
                ? R['result']['value']
                : R['result'][C & keyof R['result']];
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
    ? ColumnsShape.MapToObjectArrayColumn<Arg['result']>
    : Arg['returnType'] extends 'value' | 'valueOrThrow'
    ? Arg['result']['value']
    : Arg['returnType'] extends 'pluck'
    ? ColumnsShape.MapToPluckColumn<Arg['result']>
    : Arg['returnType'] extends 'one'
    ? ColumnsShape.MapToNullableObjectColumn<Arg['result']>
    : ColumnsShape.MapToObjectColumn<Arg['result']>;

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
  } else if (returnType === 'void') {
    q.q.returnType = q.q.returningMany ? 'all' : 'oneOrThrow';
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

export const _querySelectAll = (query: IsQuery) => {
  const q = query as unknown as PickQueryQ;
  q.q.select = ['*'];
  q.q.parsers = q.q.defaultParsers;
};

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
   *   .join(db.message, 'authorId', 'user.id')
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
    _querySelectAll(q);
    if (q.q.returning) {
      q.q.returnType = q.q.returningMany ? 'all' : 'oneOrThrow';
      q.q.returning = undefined;
    }
    return q as never;
  }
}
