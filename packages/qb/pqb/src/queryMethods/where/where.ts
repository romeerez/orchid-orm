import { Query } from '../../query/query';
import { ColumnOperators } from '../../sql';
import { pushQueryArray, pushQueryValue } from '../../query/queryUtils';
import { JoinArgs, JoinCallback, JoinFirstArg } from '../join/join';
import {
  applyMixins,
  ColumnsShapeBase,
  Expression,
  MaybeArray,
  TemplateLiteralArgs,
} from 'orchid-core';
import { getIsJoinSubQuery } from '../../sql/join';
import { getShapeFromSelect } from '../select';
import { BooleanNullable } from '../../columns';
import { QueryBase } from '../../query/queryBase';
import { RawSQL } from '../../sql/rawSql';
import { ColumnExpression } from '../../common/fn';

/*
Argument of `where`:
- can be an object with special keys `NOT`, `OR`, `IN`, etc.: q.where({ NOT: { key: 'value' } })
- can be a raw SQL: q.where(q.raw`sql`)
- can be a special query builder: q.whereNot((q) => q.whereIn(...))
- can be a nested `where` query to be joined wth `AND`: q.where(q.where(...), q.where(...))
- can be an object where keys are column names and values can be one of:
  - value to check for equality
  - null for `IS NULL`
  - object with column operators: q.where({ num: { gt: 5 } })
  - raw SQL: q.where({ num: q.raw`sql` })
  - sub query returning a single column: q.where({ num: db.someTable.where(...).get('column') })
 */
export type WhereArg<T extends WhereQueryBase> =
  | {
      [K in
        | keyof T['selectable']
        | 'NOT'
        | 'OR'
        | 'IN'
        | 'EXISTS']?: K extends 'NOT'
        ? MaybeArray<WhereArg<T>>
        : K extends 'OR'
        ? MaybeArray<WhereArg<T>>[]
        : K extends 'IN'
        ? MaybeArray<{
            columns: (keyof T['selectable'])[];
            values: unknown[][] | Query | Expression;
          }>
        : K extends keyof T['selectable']
        ?
            | T['selectable'][K]['column']['queryType']
            | null
            | ColumnOperators<T['selectable'], K>
            | Expression
            | Query
        : never;
    }
  | QueryBase
  | Expression
  | ((
      q: WhereQueryBuilder<T>,
    ) => QueryBase | ColumnExpression<BooleanNullable>);

/**
 * Callback argument of `where`.
 * It has `where` methods (`where`, `whereNot`, `whereExists`, etc.),
 * and it has relations that you can aggregate and use a boolean comparison with, such as:
 * ```ts
 * db.table.where((q) => q.relation.count().equals(10))
 * ```
 */
export type WhereQueryBuilder<T extends WhereQueryBase> = Pick<
  T,
  keyof WhereQueryBase
> &
  T['relations'];

// One or more of {@link WhereArg} or a string template for raw SQL.
export type WhereArgs<T extends WhereQueryBase> =
  | WhereArg<T>[]
  | TemplateLiteralArgs;

// Argument of `whereIn`: can be a column name or a tuple with column names to search in.
export type WhereInColumn<T extends QueryBase> =
  | keyof T['selectable']
  | [keyof T['selectable'], ...(keyof T['selectable'])[]];

// If `WhereInColumn` is a single column, it accepts array of values, or Query returning single column, or raw SQL expression.
// If `WhereInColumn` is a tuple, it accepts a tuple of values described above.
export type WhereInValues<
  T extends QueryBase,
  Column extends WhereInColumn<T>,
> = Column extends keyof T['selectable']
  ? T['selectable'][Column]['column']['queryType'][] | Query | Expression
  :
      | ({
          [I in keyof Column]: Column[I] extends keyof T['selectable']
            ? T['selectable'][Column[I]]['column']['queryType']
            : never;
        } & {
          length: Column extends { length: number } ? Column['length'] : never;
        })[]
      | Query
      | Expression;

// In addition to `WhereInColumn` + `WhereInValues` where user can provide a tuple with columns and a tuple with values, enable `whereIn` with object syntax.
// Each key is a column name, value is array of column values, or a query returning single column, or a raw SQL expression.
export type WhereInArg<T extends Pick<Query, 'selectable'>> = {
  [K in keyof T['selectable']]?:
    | T['selectable'][K]['column']['queryType'][]
    | Query
    | Expression;
};

// After applying `where`, attach `hasWhere: true` to query meta to allow updating and deleting.
export type WhereResult<T extends QueryBase> = T & {
  meta: {
    hasWhere: true;
  };
};

/**
 * Adds `where` arguments to query data: SQL template string is added as `RawSQL` object, other arguments are added as is.
 *
 * @param q - query object to add the data to
 * @param args - `where` arguments, may be a template literal
 */
export const addWhere = <T extends WhereQueryBase>(
  q: T,
  args: WhereArgs<T>,
): WhereResult<T> => {
  if (Array.isArray(args[0])) {
    return pushQueryValue(
      q,
      'and',
      new RawSQL(args as TemplateLiteralArgs),
    ) as unknown as WhereResult<T>;
  }

  return pushQueryArray(q, 'and', args) as unknown as WhereResult<T>;
};

/**
 * Adds `where` arguments to query data with a `NOT` keyword: SQL template string is added as `RawSQL` object, other arguments are added as is.
 *
 * @param q - query object to add the data to
 * @param args - `where` arguments, may be a template literal
 */
export const addWhereNot = <T extends WhereQueryBase>(
  q: T,
  args: WhereArgs<T>,
): WhereResult<T> => {
  if (Array.isArray(args[0])) {
    return pushQueryValue(q, 'and', {
      NOT: new RawSQL(args as TemplateLiteralArgs),
    }) as unknown as WhereResult<T>;
  }
  return pushQueryValue(q, 'and', {
    NOT: args,
  }) as unknown as WhereResult<T>;
};

/**
 * Adds `where` arguments to query data. Arguments will be separated from each other with `OR`.
 *
 * @param q - query object to add the data to
 * @param args - `where` arguments, may be a template literal
 */
export const addOr = <T extends WhereQueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [item]),
  ) as unknown as WhereResult<T>;
};

/**
 * Adds `where` arguments to query data with a `NOT` keyword. Arguments will be separated from each other with `OR`.
 *
 * @param q - query object to add the data to
 * @param args - `where` arguments, may be a template literal
 */
export const addOrNot = <T extends WhereQueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ NOT: item }]),
  ) as unknown as WhereResult<T>;
};

/**
 * Process arguments of `whereIn` to add them to query data properly.
 *
 * @param q - query object to add the data to.
 * @param and - `true` to join arguments with `AND`, `false` to join them with `OR.
 * @param arg - `whereIn` argument: can be a single column name, tuple of column names, or object with column names and values.
 * @param values - if the `arg` is a column name or a tuple, `values` are the values for the column/columns. If `arg` is an object, `values` are `undefined`.
 * @param not - adds the `NOT` keyword.
 */
export const addWhereIn = <T extends QueryBase>(
  q: T,
  and: boolean,
  arg: unknown,
  values: unknown[] | unknown[][] | Query | Expression | undefined,
  not?: boolean,
): WhereResult<T> => {
  const op = not ? 'notIn' : 'in';

  let item;
  if (values) {
    if (Array.isArray(arg)) {
      item = {
        IN: {
          columns: arg,
          values,
        },
      };
      if (not) item = { NOT: item };
    } else {
      item = { [arg as string]: { [op]: values } };
    }
  } else {
    item = {} as Record<string, { in: unknown[] }>;
    for (const key in arg as Record<string, unknown[]>) {
      item[key] = { [op as 'in']: (arg as Record<string, unknown[]>)[key] };
    }
  }

  if (and) {
    pushQueryValue(q, 'and', item);
  } else {
    pushQueryValue(q, 'or', [item]);
  }

  return q as unknown as WhereResult<T>;
};

/**
 * Process arguments of `whereExists`.
 *
 * @param args - first element is a query, or relation name, or `with` alias, or a query builder callback that returns a query. Other arguments have conditions to join the query or a `with` table, no other arguments needed in case of a relation
 */
const existsArgs = (args: [JoinFirstArg<Query>, ...JoinArgs<Query, Query>]) => {
  const q = args[0];

  let isSubQuery;
  if (typeof q === 'object') {
    isSubQuery = getIsJoinSubQuery(q.q, q.baseQuery.q);
    if (isSubQuery) {
      args[0] = q.clone();
      args[0].shape = getShapeFromSelect(q, true) as ColumnsShapeBase;
    }
  } else {
    isSubQuery = false;
  }

  return {
    EXISTS: {
      args,
      isSubQuery,
    },
  } as never;
};

export abstract class Where {
  /**
   * Constructing `WHERE` conditions:
   *
   * ```ts
   * db.table.where({
   *   // column of the current table
   *   name: 'John',
   *
   *   // table name may be specified, it can be the name of a joined table
   *   'table.lastName': 'Johnsonuk',
   *
   *   // object with operators, see the "column operators" section to see a full list of them:
   *   age: {
   *     gt: 30,
   *     lt: 70,
   *   },
   *
   *   // where column equals to raw SQL
   *   column: db.table.sql`raw expression`,
   * });
   * ```
   *
   * Multiple `where`s are joined with `AND`:
   *
   * ```ts
   * db.table.where({ foo: 'foo' }).where({ bar: 'bar' });
   * ```
   *
   * ```sql
   * SELECT * FROM table WHERE foo = 'foo' AND bar = 'bar'
   * ```
   *
   * `undefined` values are ignored, so you can supply a partial object with conditions:
   *
   * ```ts
   * type Params = {
   *   // allow providing exact age, or lower or greater than
   *   age?: number | { lt?: number; gt?: number };
   * };
   *
   * const loadRecords = async (params: Params) => {
   *   // this will load all records if params is an empty object
   *   const records = await db.table.where(params);
   * };
   * ```
   *
   * It supports a sub-query that is selecting a single value to compare it with a column:
   *
   * ```ts
   * db.table.where({
   *   // compare `someColumn` in one table with the `column` value returned from another query.
   *   someColumn: db.otherTable.where(...conditions).get('column'),
   * });
   * ```
   *
   * `where` can accept other queries and merge their conditions:
   *
   * ```ts
   * const otherQuery = db.table.where({ name: 'John' });
   *
   * db.table.where({ id: 1 }, otherQuery);
   * // this will produce WHERE "table"."id" = 1 AND "table"."name' = 'John'
   * ```
   *
   * `where` supports raw SQL:
   *
   * ```ts
   * db.table.where`a = b`;
   *
   * // or
   * db.table.where(db.table.sql`a = b`);
   *
   * // or
   * import { raw } from 'orchid-orm';
   *
   * db.table.where(raw`a = b`);
   * ```
   *
   * `where` can accept a callback with a specific query builder containing all "where" methods such as `where`, `orWhere`, `whereNot`, `whereIn`, `whereExists`:
   *
   * ```ts
   * db.table.where((q) =>
   *   q
   *     .where({ name: 'Name' })
   *     .orWhere({ id: 1 }, { id: 2 })
   *     .whereIn('letter', ['a', 'b', 'c'])
   *     .whereExists(Message, 'authorId', 'id'),
   * );
   * ```
   *
   * `where` can accept multiple arguments, conditions are joined with `AND`:
   *
   * ```ts
   * db.table.where(
   *   { id: 1 },
   *   db.table.where({ name: 'John' }),
   *   db.table.sql`a = b`,
   * );
   * ```
   *
   * ## where sub query
   *
   * `where` handles a special callback where you can query a relation to get some value and filter by that value.
   *
   * It is useful for a faceted search. For instance, posts have tags, and we want to find all posts that have all the given tags.
   *
   * ```ts
   * const givenTags = ['typescript', 'node.js'];
   *
   * const posts = await db.post.where(
   *   (post) =>
   *     post.tags // query tags of the post
   *       .whereIn('tagName', givenTags) // where name of the tag is inside array
   *       .count() // count how many such tags were found
   *       .equals(wantedTags.length), // the count must be exactly the length of array
   *   // if the post has ony `typescript` tag but not the `node.js` it will be omitted
   * );
   * ```
   *
   * This will produce an efficient SQL query:
   *
   * ```sql
   * SELECT * FROM "post"
   * WHERE (
   *   SELECT count(*) = 3
   *   FROM "tag" AS "tags"
   *   WHERE "tag"."tagName" IN ('typescript', 'node.js')
   *     -- join tags to the post via "postTag" table
   *     AND EXISTS (
   *       SELECT 1 FROM "postTag"
   *       WHERE "postTag"."postId" = "post"."id"
   *         AND "postTag"."tagId" = "tag"."id"
   *     )
   * )
   * ```
   *
   * In the example above we use `count()`, you can also use any other aggregate method instead, such as `min`, `max`, `avg`.
   *
   * The `count()` is chained with `equals` to check for a strict equality, any other operation is also allowed, such as `not`, `lt`, `gt`.
   *
   * ## where special keys
   *
   * The object passed to `where` can contain special keys, each of the keys corresponds to its own method and takes the same value as the type of argument of the method.
   *
   * For example:
   *
   * ```ts
   * db.table.where({
   *   NOT: { key: 'value' },
   *   OR: [{ name: 'a' }, { name: 'b' }],
   *   IN: {
   *     columns: ['id', 'name'],
   *     values: [
   *       [1, 'a'],
   *       [2, 'b'],
   *     ],
   *   },
   * });
   * ```
   *
   * Using methods `whereNot`, `orWhere`, `whereIn` instead of this is a shorter and cleaner way, but in some cases, such object keys way may be more convenient.
   *
   * ```ts
   * db.table.where({
   *   // see .whereNot
   *   NOT: { id: 1 },
   *   // can be an array:
   *   NOT: [{ id: 1 }, { id: 2 }],
   *
   *   // see .orWhere
   *   OR: [{ name: 'a' }, { name: 'b' }],
   *   // can be an array:
   *   // this will give id = 1 AND id = 2 OR id = 3 AND id = 4
   *   OR: [
   *     [{ id: 1 }, { id: 2 }],
   *     [{ id: 3 }, { id: 4 }],
   *   ],
   *
   *   // see .in, the key syntax requires an object with columns and values
   *   IN: {
   *     columns: ['id', 'name'],
   *     values: [
   *       [1, 'a'],
   *       [2, 'b'],
   *     ],
   *   },
   *   // can be an array:
   *   IN: [
   *     {
   *       columns: ['id', 'name'],
   *       values: [
   *         [1, 'a'],
   *         [2, 'b'],
   *       ],
   *     },
   *     { columns: ['someColumn'], values: [['foo', 'bar']] },
   *   ],
   * });
   * ```
   *
   * ## column operators
   *
   * `where` argument can take an object where the key is the name of the operator and the value is its argument.
   *
   * Different types of columns support different sets of operators.
   *
   * All column operators can take a value of the same type as the column, a sub-query, or a raw SQL expression:
   *
   * ```ts
   * import { sql } from 'orchid-orm';
   *
   * db.table.where({
   *   numericColumn: {
   *     // lower than 5
   *     lt: 5,
   *
   *     // lower than the value returned by sub-query
   *     lt: OtherTable.select('someNumber').take(),
   *
   *     // raw SQL expression produces WHERE "numericColumn" < "otherColumn" + 10
   *     lt: sql`"otherColumn" + 10`,
   *   },
   * });
   * ```
   *
   * ### Any type of column operators
   *
   * `equals` is a simple `=` operator, it may be useful for comparing column value with JSON object:
   *
   * ```ts
   * db.table.where({
   *  // when searching for an exact same JSON value, this won't work:
   *   jsonColumn: someObject,
   *
   *   // use `{ equals: ... }` instead:
   *   jsonColumn: { equals: someObject },
   * });
   * ```
   *
   * `not` is `!=` (aka `<>`) not equal operator:
   *
   * ```ts
   * db.table.where({
   *   anyColumn: { not: value },
   * });
   * ```
   *
   * `in` is for the `IN` operator to check if the column value is included in a list of values.
   *
   * Takes an array of the same type as a column, a sub-query that returns a list of values, or a raw SQL expression that returns a list.
   *
   * ```ts
   * db.table.where({
   *   column: {
   *     in: ['a', 'b', 'c'],
   *
   *     // WHERE "column" IN (SELECT "column" FROM "otherTable")
   *     in: OtherTable.select('column'),
   *
   *     in: db.table.sql`('a', 'b')`,
   *   },
   * });
   * ```
   *
   * `notIn` is for the `NOT IN` operator, and takes the same arguments as `in`
   *
   * ### Numeric, Date, and Time column operators
   *
   * To compare numbers, dates, and times.
   *
   * `lt` is for `<` (lower than)
   *
   * `lte` is for `<=` (lower than or equal)
   *
   * `gt` is for `>` (greater than)
   *
   * `gte` is for `>=` (greater than or equal)
   *
   * ```ts
   * db.table.where({
   *   numericColumn: {
   *     gt: 5,
   *     lt: 10,
   *   },
   *
   *   date: {
   *     lte: new Date(),
   *   },
   *
   *   time: {
   *     gte: new Date(),
   *   },
   * });
   * ```
   *
   * `between` also works with numeric, dates, and time columns, it takes an array of two elements.
   *
   * Both elements can be of the same type as a column, a sub-query, or a raw SQL expression.
   *
   * ```ts
   * db.table.where({
   *   column: {
   *     // simple values
   *     between: [1, 10],
   *
   *     // sub-query and raw SQL expression
   *     between: [OtherTable.select('column').take(), db.table.sql`2 + 2`],
   *   },
   * });
   * ```
   *
   * ### Text column operators
   *
   * For `text`, `char`, `varchar`, and `json` columns.
   *
   * `json` is stored as text, so it has text operators. Use the `jsonb` type for JSON operators.
   *
   * Takes a string, or sub-query returning string, or raw SQL expression as well as other operators.
   *
   * ```ts
   * db.table.where({
   *   textColumn: {
   *     // WHERE "textColumn" LIKE '%string%'
   *     contains: 'string',
   *     // WHERE "textColumn" ILIKE '%string%'
   *     containsInsensitive: 'string',
   *     // WHERE "textColumn" LIKE 'string%'
   *     startsWith: 'string',
   *     // WHERE "textColumn" ILIKE 'string%'
   *     startsWithInsensitive: 'string',
   *     // WHERE "textColumn" LIKE '%string'
   *     endsWith: 'string',
   *     // WHERE "textColumn" ILIKE '%string'
   *     endsWithInsensitive: 'string',
   *   },
   * });
   * ```
   *
   * ### JSONB column operators
   *
   * For the `jsonb` column, note that the `json` type has text operators instead.
   *
   * `jsonPath` operator: compare a column value under a given JSON path with the provided value.
   *
   * Value can be of any type to compare with JSON value, or it can be a sub-query or a raw SQL expression.
   *
   * ```ts
   * db.table.where({
   *   jsonbColumn: {
   *     jsonPath: [
   *       '$.name', // first element is JSON path
   *       '=', // second argument is comparison operator
   *       'value', // third argument is a value to compare with
   *     ],
   *   },
   * });
   * ```
   *
   * `jsonSupersetOf`: check if the column value is a superset of provided value.
   *
   * For instance, it is true if the column has JSON `{ "a": 1, "b": 2 }` and provided value is `{ "a": 1 }`.
   *
   * Takes the value of any type, or sub query which returns a single value, or a raw SQL expression.
   *
   * ```ts
   * db.table.where({
   *   jsonbColumn: {
   *     jsonSupersetOf: { a: 1 },
   *   },
   * });
   * ```
   *
   * `jsonSubsetOf`: check if the column value is a subset of provided value.
   *
   * For instance, it is true if the column has JSON `{ "a": 1 }` and provided value is `{ "a": 1, "b": 2 }`.
   *
   * Takes the value of any type, or sub query which returns a single value, or a raw SQL expression.
   *
   * ```ts
   * db.table.where({
   *   jsonbColumn: {
   *     jsonSupersetOf: { a: 1 },
   *   },
   * });
   * ```
   *
   * @param args - {@link WhereArgs}
   */
  where<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArgs<T>
  ): WhereResult<T> {
    return this.clone()._where(...args);
  }
  _where<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArgs<T>
  ): WhereResult<T> {
    return addWhere(this, args);
  }

  /**
   * `whereNot` takes the same arguments as `where` and prepends them with `NOT` in SQL
   *
   * ```ts
   * // find records of different colors than red
   * db.table.whereNot({ color: 'red' });
   * ```
   *
   * @param args - {@link WhereArgs}
   */
  whereNot<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArgs<T>
  ): WhereResult<T> {
    return this.clone()._whereNot(...args);
  }
  _whereNot<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArgs<T>
  ): WhereResult<T> {
    return addWhereNot(this, args);
  }

  /**
   * `orWhere` is accepting the same arguments as {@link where}, joining arguments with `OR`.
   *
   * Columns in single arguments are still joined with `AND`.
   *
   * The database is processing `AND` before `OR`, so this should be intuitively clear.
   *
   * ```ts
   * db.table.where({ id: 1, color: 'red' }).orWhere({ id: 2, color: 'blue' });
   * // equivalent:
   * db.table.orWhere({ id: 1, color: 'red' }, { id: 2, color: 'blue' });
   * ```
   *
   * This query will produce such SQL (simplified):
   *
   * ```sql
   * SELECT * FROM "table"
   * WHERE id = 1 AND color = 'red'
   *    OR id = 2 AND color = 'blue'
   * ```
   *
   * @param args - {@link WhereArgs} will be joined with `OR`
   */
  orWhere<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArg<T>[]
  ): WhereResult<T> {
    return this.clone()._orWhere(...args);
  }
  _orWhere<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArg<T>[]
  ): WhereResult<T> {
    return addOr(this, args);
  }

  /**
   * `orWhereNot` takes the same arguments as {@link orWhere}, and prepends each condition with `NOT` just as {@link whereNot} does.
   *
   * @param args - {@link WhereArgs} will be prefixed with `NOT` and joined with `OR`
   */
  orWhereNot<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArg<T>[]
  ): WhereResult<T> {
    return this.clone()._orWhereNot(...args);
  }
  _orWhereNot<T extends WhereQueryBase>(
    this: T,
    ...args: WhereArg<T>[]
  ): WhereResult<T> {
    return addOrNot(this, args);
  }

  /**
   * `whereIn` and related methods are for the `IN` operator to check for inclusion in a list of values.
   *
   * When used with a single column it works equivalent to the `in` column operator:
   *
   * ```ts
   * db.table.whereIn('column', [1, 2, 3]);
   * // the same as:
   * db.table.where({ column: [1, 2, 3] });
   * ```
   *
   * `whereIn` can support a tuple of columns, that's what the `in` operator cannot support:
   *
   * ```ts
   * db.table.whereIn(
   *   ['id', 'name'],
   *   [
   *     [1, 'Alice'],
   *     [2, 'Bob'],
   *   ],
   * );
   * ```
   *
   * It supports sub query which should return records with columns of the same type:
   *
   * ```ts
   * db.table.whereIn(['id', 'name'], OtherTable.select('id', 'name'));
   * ```
   *
   * It supports raw SQL expression:
   *
   * ```ts
   * db.table.whereIn(['id', 'name'], db.table.sql`((1, 'one'), (2, 'two'))`);
   * ```
   *
   * @param column - one column name, or array of column names
   * @param values - array of values, or a query to load values, or a raw SQL. Tuple of such values in case of multiple columns.
   */
  whereIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  /**
   * See {@link whereIn}.
   *
   * @param arg - object where keys are column names, and values are an array of column values, or a query returning column values, or a raw SQL.
   */
  whereIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  whereIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereIn(
      arg as any,
      values as any,
    ) as unknown as WhereResult<T>;
  }
  _whereIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _whereIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  _whereIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    return addWhereIn(this, true, arg, values);
  }

  /**
   * Takes the same arguments as {@link whereIn}.
   * Add a `WHERE IN` condition prefixed with `OR` to the query:
   *
   * ```ts
   * db.table.whereIn('a', [1, 2, 3]).orWhereIn('b', ['one', 'two']);
   * ```
   *
   * @param column - one column name, or array of column names
   * @param values - array of values, or a query to load values, or a raw SQL. Tuple of such values in case of multiple columns.
   */
  orWhereIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  /**
   * See {@link orWhereIn}.
   *
   * @param arg - object where keys are column names, and values are an array of column values, or a query returning column values, or a raw SQL.
   */
  orWhereIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  orWhereIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    return this.clone()._orWhereIn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      arg as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values as any,
    ) as unknown as WhereResult<T>;
  }
  _orWhereIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _orWhereIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  _orWhereIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    return addWhereIn(this, false, arg, values);
  }

  /**
   * Acts as `whereIn`, but negates the condition with `NOT`:
   *
   * ```ts
   * db.table.whereNotIn('color', ['red', 'green', 'blue']);
   * ```
   *
   * @param column - one column name, or array of column names
   * @param values - array of values, or a query to load values, or a raw SQL. Tuple of such values in case of multiple columns.
   */
  whereNotIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  /**
   * See {@link whereNotIn}.
   *
   * @param arg - object where keys are column names, and values are an array of column values, or a query returning column values, or a raw SQL.
   */
  whereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  whereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereNotIn(arg as any, values as any);
  }
  _whereNotIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _whereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  _whereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    return addWhereIn(this, true, arg, values, true);
  }

  /**
   * Acts as `whereIn`, but prepends `OR` to the condition and negates it with `NOT`:
   *
   * ```ts
   * db.table.whereNotIn('a', [1, 2, 3]).orWhereNoIn('b', ['one', 'two']);
   * ```
   *
   * @param column - one column name, or array of column names
   * @param values - array of values, or a query to load values, or a raw SQL. Tuple of such values in case of multiple columns.
   */
  orWhereNotIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  /**
   * See {@link orWhereNotIn}.
   *
   * @param arg - object where keys are column names, and values are an array of column values, or a query returning column values, or a raw SQL.
   */
  orWhereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  orWhereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereNotIn(arg as any, values as any);
  }
  _orWhereNotIn<T extends WhereQueryBase, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _orWhereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: WhereInArg<T>,
  ): WhereResult<T>;
  _orWhereNotIn<T extends WhereQueryBase>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    return addWhereIn(this, false, arg, values, true);
  }

  /**
   * `whereExists` is for support of the `WHERE EXISTS (query)` clause.
   *
   * This method is accepting the same arguments as `join`, see the {@link Join.join} section for more details.
   *
   * ```ts
   * // find users who have accounts
   * // find by a relation name if it's defined
   * db.user.whereExists('account');
   *
   * // find using a table and a join conditions
   * db.user.whereExists(db.account, 'account.id', 'user.id');
   *
   * // find using a query builder in a callback:
   * db.user.whereExists(db.account, (q) => q.on('account.id', '=', 'user.id'));
   * ```
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param args - no arguments needed when the first argument is a relation name, or conditions to join the table with.
   */
  whereExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    ...args: JoinArgs<T, Arg>
  ): WhereResult<T>;
  /**
   * See {@link whereExists}.
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param cb - callback with a query builder to join the table.
   */
  whereExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereExists(this: WhereQueryBase, arg: any, ...args: any) {
    return this.clone()._whereExists(arg, ...args);
  }
  _whereExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    ...args: JoinArgs<T, Arg>
  ): WhereResult<T>;
  _whereExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereExists(this: WhereQueryBase, ...args: any) {
    return this._where(existsArgs(args));
  }

  /**
   * Acts as `whereExists`, but prepends the condition with `OR`:
   *
   * ```ts
   * // find users who have an account or a profile,
   * // imagine that the user has both `account` and `profile` relations defined.
   * db.user.whereExist('account').orWhereExists('profile');
   * ```
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param args - no arguments needed when the first argument is a relation name, or conditions to join the table with.
   */
  orWhereExists<
    T extends WhereQueryBase,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  /**
   * See {@link orWhereExists}.
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param cb - callback with a query builder to join the table.
   */
  orWhereExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereExists(this: WhereQueryBase, arg: any, ...args: any) {
    return this.clone()._orWhereExists(arg, ...args);
  }
  _orWhereExists<
    T extends WhereQueryBase,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  _orWhereExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _orWhereExists(this: WhereQueryBase, ...args: any) {
    return this._orWhere(existsArgs(args));
  }

  /**
   * Acts as `whereExists`, but negates the condition with `NOT`:
   *
   * ```ts
   * // find users who don't have an account,
   * // image that the user `belongsTo` or `hasOne` account.
   * db.user.whereNotExist('account');
   * ```
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param args - no arguments needed when the first argument is a relation name, or conditions to join the table with.
   */
  whereNotExists<
    T extends WhereQueryBase,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  /**
   * See {@link whereNotExists}.
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param cb - callback with a query builder to join the table.
   */
  whereNotExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereNotExists(this: WhereQueryBase, arg: any, ...args: any) {
    return this.clone()._whereNotExists(arg, ...args);
  }
  _whereNotExists<
    T extends WhereQueryBase,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  _whereNotExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereNotExists(this: WhereQueryBase, ...args: any) {
    return this._whereNot(existsArgs(args));
  }

  /**
   * Acts as `whereExists`, but prepends the condition with `OR` and negates it with `NOT`:
   *
   * ```ts
   * // find users who don't have an account OR who don't have a profile
   * // imagine that the user has both `account` and `profile` relations defined.
   * db.user.whereNotExists('account').orWhereNotExists('profile');
   * ```
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param args - no arguments needed when the first argument is a relation name, or conditions to join the table with.
   */
  orWhereNotExists<
    T extends WhereQueryBase,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  /**
   * See {@link orWhereNotExists}.
   *
   * @param arg - relation name, or a query object, or a `with` table alias, or a callback returning a query object.
   * @param cb - callback with a query builder to join the table.
   */
  orWhereNotExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereNotExists(this: WhereQueryBase, arg: any, ...args: any) {
    return this.clone()._orWhereNotExists(arg, ...args);
  }
  _orWhereNotExists<
    T extends WhereQueryBase,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  _orWhereNotExists<T extends WhereQueryBase, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _orWhereNotExists(this: WhereQueryBase, ...args: any) {
    return this._orWhereNot(existsArgs(args));
  }
}

// Query builder class that only has Where methods.
// Used for `where` callback argument, and for callback argument of `join`.
export interface WhereQueryBase extends Where, QueryBase {}
export abstract class WhereQueryBase extends QueryBase {}
applyMixins(WhereQueryBase, [Where]);
