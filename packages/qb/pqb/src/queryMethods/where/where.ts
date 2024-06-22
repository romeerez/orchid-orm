import {
  PickQueryMetaRelations,
  PickQueryMetaShapeRelationsWithData,
  PickQueryRelations,
  Query,
  QueryOrExpressionBooleanOrNullResult,
} from '../../query/query';
import { pushQueryArray, pushQueryValue } from '../../query/queryUtils';
import { JoinArgs, JoinFirstArg } from '../join/join';
import {
  ColumnsShapeBase,
  Expression,
  MaybeArray,
  PickQueryMeta,
  SQLQueryArgs,
} from 'orchid-core';
import { getIsJoinSubQuery } from '../../sql/join';
import { getShapeFromSelect } from '../select';
import { QueryBase } from '../../query/queryBase';
import { sqlQueryArgsToExpression } from '../../sql/rawSql';
import { RelationsBase } from '../../relations';
import { processJoinArgs } from '../join/processJoinArgs';
import { ExpressionMethods } from '../expressions';
import { _queryNone } from '../none';
import {
  getClonedQueryData,
  resolveSubQueryCallback,
} from '../../common/utils';

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
export type WhereArg<T extends PickQueryMetaRelations> =
  | {
      [K in
        | keyof T['meta']['selectable']
        | 'NOT'
        | 'OR'
        | 'IN']?: K extends 'NOT'
        ? WhereArg<T> | WhereArgs<T>
        : K extends 'OR'
        ? (WhereArg<T> | WhereArgs<T>)[]
        : K extends 'IN'
        ? MaybeArray<{
            columns: (keyof T['meta']['selectable'])[];
            values: unknown[][] | QueryBase | Expression;
          }>
        :
            | T['meta']['selectable'][K]['column']['queryType']
            | null
            // inlined `ColumnOperators` helper
            | {
                [O in keyof T['meta']['selectable'][K]['column']['operators']]?:
                  | T['meta']['selectable'][K]['column']['operators'][O]['_opType'];
              }
            // inlined QueryOrExpression
            | {
                result: {
                  value: {
                    // simplified QueryColumn
                    queryType:
                      | T['meta']['selectable'][K]['column']['queryType']
                      | null;
                  };
                };
              }
            // returns inlined QueryOrExpression
            | ((q: T) => {
                result: {
                  value: {
                    // simplified QueryColumn
                    queryType:
                      | T['meta']['selectable'][K]['column']['queryType']
                      | null;
                  };
                };
              });
    }
  | QueryOrExpressionBooleanOrNullResult
  | ((
      q: WhereQueryBuilder<T>,
    ) => QueryOrExpressionBooleanOrNullResult | WhereQueryBuilder<T>);

/**
 * Callback argument of `where`.
 * It has `where` methods (`where`, `whereNot`, `whereExists`, etc.),
 * and it has relations that you can aggregate and use a boolean comparison with, such as:
 * ```ts
 * db.table.where((q) => q.relation.count().equals(10))
 * ```
 */
export type WhereQueryBuilder<T extends PickQueryRelations> =
  RelationsBase extends T['relations']
    ? {
        [K in keyof T]: K extends
          | keyof QueryBase
          | keyof Where
          | keyof ExpressionMethods
          | 'sql'
          | 'get'
          | 'ref'
          ? T[K]
          : never;
      }
    : {
        [K in keyof T]: K extends keyof T['relations']
          ? T['relations'][K]
          : K extends
              | keyof QueryBase
              | keyof Where
              | keyof ExpressionMethods
              | 'sql'
              | 'get'
              | 'ref'
          ? T[K]
          : never;
      };

// One or more of {@link WhereArg} or a string template for raw SQL.
export type WhereArgs<T extends PickQueryMetaRelations> = WhereArg<T>[];

export type WhereNotArgs<T extends PickQueryMetaRelations> = [WhereArg<T>];

// Argument of `whereIn`: can be a column name or a tuple with column names to search in.
export type WhereInColumn<T extends PickQueryMetaRelations> =
  | keyof T['meta']['selectable']
  | [keyof T['meta']['selectable'], ...(keyof T['meta']['selectable'])[]];

// If `WhereInColumn` is a single column, it accepts array of values, or Query returning single column, or raw SQL expression.
// If `WhereInColumn` is a tuple, it accepts a tuple of values described above.
export type WhereInValues<
  T extends PickQueryMetaRelations,
  Column,
> = Column extends keyof T['meta']['selectable']
  ?
      | T['meta']['selectable'][Column]['column']['queryType'][]
      | Query
      | Expression
  :
      | ({
          [I in keyof Column]: Column[I] extends keyof T['meta']['selectable']
            ? T['meta']['selectable'][Column[I]]['column']['queryType']
            : never;
        } & {
          length: Column extends { length: number } ? Column['length'] : never;
        })[]
      | Query
      | Expression;

// In addition to `WhereInColumn` + `WhereInValues` where user can provide a tuple with columns and a tuple with values, enable `whereIn` with object syntax.
// Each key is a column name, value is array of column values, or a query returning single column, or a raw SQL expression.
export type WhereInArg<T extends PickQueryMeta> = {
  [K in keyof T['meta']['selectable']]?:
    | T['meta']['selectable'][K]['column']['queryType'][]
    | Query
    | Expression;
};

// After applying `where`, attach `hasWhere: true` to query meta to allow updating and deleting.
export type WhereResult<T> = T & QueryMetaHasWhere;

export interface QueryMetaHasWhere {
  meta: {
    hasWhere: true;
  };
}

const resolveCallbacksInArgs = <T extends PickQueryMetaRelations>(
  q: T,
  args: WhereArgs<T>,
) => {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === 'function') {
      const qb = Object.create(q);
      qb.q = getClonedQueryData((q as unknown as Query).q);
      qb.q.and = qb.q.or = qb.q.scopes = undefined;
      qb.q.subQuery = 1;

      args[i] = resolveSubQueryCallback(qb, arg as never) as never;
    }
  }
};

/**
 * Mutative {@link Where.prototype.where}
 */
export const _queryWhere = <T extends PickQueryMetaRelations>(
  q: T,
  args: WhereArgs<T>,
): WhereResult<T> => {
  resolveCallbacksInArgs(q, args);

  return pushQueryArray(
    q as unknown as Query,
    'and',
    args,
  ) as unknown as WhereResult<T>;
};

/**
 * Mutative {@link Where.prototype.whereSql}
 */
export const _queryWhereSql = <T>(q: T, args: SQLQueryArgs): T => {
  return pushQueryValue(
    q as unknown as Query,
    'and',
    sqlQueryArgsToExpression(args),
  ) as unknown as WhereResult<T>;
};

/**
 * Mutative {@link Where.prototype.whereNot}
 */
export const _queryWhereNot = <T extends PickQueryMetaRelations>(
  q: T,
  args: WhereNotArgs<T>,
): WhereResult<T> => {
  resolveCallbacksInArgs(q, args);

  return pushQueryValue(q as unknown as Query, 'and', {
    NOT: args,
  }) as never;
};

/**
 * Mutative {@link Where.prototype.whereNotSql}
 */
export const _queryWhereNotSql = <T>(q: T, args: SQLQueryArgs): T => {
  return pushQueryValue(q as unknown as Query, 'and', {
    NOT: sqlQueryArgsToExpression(args),
  }) as unknown as WhereResult<T>;
};

/**
 * Mutative {@link Where.prototype.orWhere}
 */
export const _queryOr = <T extends PickQueryMetaRelations>(
  q: T,
  args: WhereArgs<T>,
): WhereResult<T> => {
  resolveCallbacksInArgs(q, args);

  return pushQueryArray(
    q as unknown as Query,
    'or',
    args.map((item) => [item]),
  ) as unknown as WhereResult<T>;
};

/**
 * Mutative {@link Where.prototype.orWhereNot}
 */
export const _queryOrNot = <T extends PickQueryMetaRelations>(
  q: T,
  args: WhereArgs<T>,
): WhereResult<T> => {
  resolveCallbacksInArgs(q, args);

  return pushQueryArray(
    q as unknown as Query,
    'or',
    args.map((item) => {
      return [{ NOT: item }];
    }),
  ) as unknown as WhereResult<T>;
};

/**
 * Mutative {@link Where.prototype.whereIn}
 */
export const _queryWhereIn = <T>(
  q: T,
  and: boolean,
  arg: unknown,
  values: unknown[] | unknown[][] | Query | Expression | undefined,
  not?: boolean,
): WhereResult<T> => {
  let item;
  if (values) {
    if ('length' in values && !values.length) {
      return _queryNone(q) as WhereResult<T>;
    }

    if (Array.isArray(arg)) {
      item = {
        IN: {
          columns: arg,
          values,
        },
      };
    } else {
      item = { [arg as string]: { in: values } };
    }
  } else {
    item = {} as { [K: string]: { in: unknown[] } };
    for (const key in arg as { [K: string]: unknown[] }) {
      const values = (arg as { [K: string]: unknown[] })[key];
      if ('length' in values && !values.length) {
        return _queryNone(q) as WhereResult<T>;
      }

      item[key] = { in: values };
    }
  }

  if (not) item = { NOT: item };

  if (and) {
    pushQueryValue(q as unknown as Query, 'and', item);
  } else {
    pushQueryValue(q as unknown as Query, 'or', [item]);
  }

  return q as unknown as WhereResult<T>;
};

/**
 * Process arguments of `whereExists`.
 */
const existsArgs = (
  self: Query,
  q: JoinFirstArg<Query>,
  args: JoinArgs<Query, Query>,
) => {
  let joinSubQuery;
  if (typeof q === 'object') {
    joinSubQuery = getIsJoinSubQuery(q as Query);
    if (joinSubQuery) {
      q = (q as Query).clone();
      (q as Query).shape = getShapeFromSelect(
        q as Query,
        true,
      ) as ColumnsShapeBase;
    }
  } else {
    joinSubQuery = false;
  }

  const joinArgs = processJoinArgs(self, q, args as never, joinSubQuery);

  return [
    {
      EXISTS: joinArgs,
    },
  ] as never;
};

/**
 * Mutative {@link Where.prototype.whereExists}
 */
export const _queryWhereExists = <
  T extends PickQueryMetaShapeRelationsWithData,
  Arg extends JoinFirstArg<T>,
>(
  q: T,
  arg: Arg,
  args: JoinArgs<T, Arg>,
): WhereResult<T> => {
  return _queryWhere(
    q,
    existsArgs(q as unknown as Query, arg as never, args as never),
  ) as never;
};

export class Where {
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
   *   // import `sql` from your `BaseTable`
   *   column: sql`sql expression`,
   *   // or use `(q) => q.sql` for the same
   *   column2: (q) => q.sql`sql expression`,
   *
   *   // reference other columns in such a way:
   *   firstName: (q) => q.ref('lastName'),
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
   * db.table.where(sql`a = b`);
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
   *   sql`a = b`,
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
   *     in: sql`('a', 'b')`,
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
   *     between: [OtherTable.select('column').take(), sql`2 + 2`],
   *   },
   * });
   * ```
   *
   * ### Text column operators
   *
   * For `text`, `varchar`, `string`, and `json` columns.
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
  where<T extends PickQueryMetaRelations>(
    this: T,
    ...args: WhereArgs<T>
  ): WhereResult<T> {
    return _queryWhere(
      (this as unknown as Query).clone(),
      args as never,
    ) as never;
  }

  /**
   * Use a custom SQL expression in `WHERE` statement:
   *
   * ```ts
   * db.table.whereSql`a = b`;
   * ```
   *
   * @param args - SQL expression
   */
  whereSql<T>(this: T, ...args: SQLQueryArgs): T {
    return _queryWhereSql(
      (this as unknown as Query).clone(),
      args as never,
    ) as never;
  }

  /**
   * `whereNot` takes the same argument as `where`,
   * multiple conditions are combined with `AND`,
   * the whole group of conditions is negated with `NOT`.
   *
   * ```ts
   * // find records of different colors than red
   * db.table.whereNot({ color: 'red' });
   * // WHERE NOT color = 'red'
   * db.table.whereNot({ one: 1, two: 2 });
   * // WHERE NOT (one = 1 AND two = 2)
   * ```
   *
   * @param args - {@link WhereArgs}
   */
  whereNot<T extends PickQueryMetaRelations>(
    this: T,
    ...args: WhereNotArgs<T>
  ): WhereResult<T> {
    return _queryWhereNot(
      (this as unknown as Query).clone(),
      args as never,
    ) as never;
  }

  /**
   * `whereNotSql` is a version of `whereNot` accepting SQL expression:
   *
   * ```ts
   * db.table.whereNotSql`sql expression`
   * ```
   *
   * @param args - SQL expression
   */
  whereNotSql<T>(this: T, ...args: SQLQueryArgs): T {
    return _queryWhereNotSql((this as unknown as Query).clone(), args) as never;
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
  orWhere<T extends PickQueryMetaRelations>(
    this: T,
    ...args: WhereArgs<T>
  ): WhereResult<T> {
    return _queryOr((this as unknown as Query).clone(), args as never) as never;
  }

  /**
   * `orWhereNot` takes the same arguments as {@link orWhere}, and prepends each condition with `NOT` just as {@link whereNot} does.
   *
   * @param args - {@link WhereArgs} will be prefixed with `NOT` and joined with `OR`
   */
  orWhereNot<T extends PickQueryMetaRelations>(
    this: T,
    ...args: WhereArgs<T>
  ): WhereResult<T> {
    return _queryOrNot(
      (this as unknown as Query).clone(),
      args as never,
    ) as never;
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
   * db.table.whereIn(['id', 'name'], sql`((1, 'one'), (2, 'two'))`);
   * ```
   *
   * When empty set of values is given, `whereIn` will resolve into a {@link QueryMethods.none} query that has a special behavior.
   *
   * ```ts
   * // following queries resolves into `none`:
   * db.table.where('id', [])
   * db.table.where(['id', 'name'], [])
   * db.table.where({ id: [] })
   * ```
   */
  whereIn<T extends PickQueryMetaRelations, Column extends WhereInColumn<T>>(
    this: T,
    ...args:
      | [column: Column, values: WhereInValues<T, Column>]
      | [arg: WhereInArg<T>]
  ): WhereResult<T> {
    return _queryWhereIn(
      (this as unknown as Query).clone(),
      true,
      args[0],
      args[1],
    ) as never;
  }

  /**
   * Takes the same arguments as {@link whereIn}.
   * Add a `WHERE IN` condition prefixed with `OR` to the query:
   *
   * ```ts
   * db.table.whereIn('a', [1, 2, 3]).orWhereIn('b', ['one', 'two']);
   * ```
   */
  orWhereIn<T extends PickQueryMetaRelations, Column extends WhereInColumn<T>>(
    this: T,
    ...args:
      | [column: Column, values: WhereInValues<T, Column>]
      | [WhereInArg<T>]
  ): WhereResult<T> {
    return _queryWhereIn(
      (this as unknown as Query).clone(),
      false,
      args[0],
      args[1],
    ) as never;
  }

  /**
   * Acts as `whereIn`, but negates the condition with `NOT`:
   *
   * ```ts
   * db.table.whereNotIn('color', ['red', 'green', 'blue']);
   * ```
   */
  whereNotIn<T extends PickQueryMetaRelations, Column extends WhereInColumn<T>>(
    this: T,
    ...args:
      | [column: Column, values: WhereInValues<T, Column>]
      | [arg: WhereInArg<T>]
  ): WhereResult<T> {
    return _queryWhereIn(
      (this as unknown as Query).clone(),
      true,
      args[0],
      args[1],
      true,
    ) as never;
  }

  /**
   * Acts as `whereIn`, but prepends `OR` to the condition and negates it with `NOT`:
   *
   * ```ts
   * db.table.whereNotIn('a', [1, 2, 3]).orWhereNoIn('b', ['one', 'two']);
   * ```
   */
  orWhereNotIn<
    T extends PickQueryMetaRelations,
    Column extends WhereInColumn<T>,
  >(
    this: T,
    ...args:
      | [column: Column, values: WhereInValues<T, Column>]
      | [arg: WhereInArg<T>]
  ): WhereResult<T> {
    return _queryWhereIn(
      (this as unknown as Query).clone(),
      false,
      args[0],
      args[1],
      true,
    ) as never;
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
   */
  whereExists<
    T extends PickQueryMetaShapeRelationsWithData,
    Arg extends JoinFirstArg<T>,
  >(this: T, arg: Arg, ...args: JoinArgs<T, Arg>): WhereResult<T> {
    return _queryWhereExists(
      (this as unknown as Query).clone() as unknown as T,
      arg,
      args,
    );
  }

  /**
   * Acts as `whereExists`, but prepends the condition with `OR`:
   *
   * ```ts
   * // find users who have an account or a profile,
   * // imagine that the user has both `account` and `profile` relations defined.
   * db.user.whereExist('account').orWhereExists('profile');
   * ```
   */
  orWhereExists<
    T extends PickQueryMetaShapeRelationsWithData,
    Arg extends JoinFirstArg<T>,
  >(this: T, arg: Arg, ...args: JoinArgs<T, Arg>): WhereResult<T> {
    const q = (this as unknown as Query).clone();
    return _queryOr(q, existsArgs(q, arg as never, args as never)) as never;
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
    T extends PickQueryMetaShapeRelationsWithData,
    Arg extends JoinFirstArg<T>,
  >(this: T, arg: Arg, ...args: JoinArgs<T, Arg>): WhereResult<T> {
    const q = (this as unknown as Query).clone();
    return _queryWhereNot(
      q,
      existsArgs(q, arg as never, args as never),
    ) as never;
  }

  /**
   * Acts as `whereExists`, but prepends the condition with `OR` and negates it with `NOT`:
   *
   * ```ts
   * // find users who don't have an account OR who don't have a profile
   * // imagine that the user has both `account` and `profile` relations defined.
   * db.user.whereNotExists('account').orWhereNotExists('profile');
   * ```
   */
  orWhereNotExists<
    T extends PickQueryMetaShapeRelationsWithData,
    Arg extends JoinFirstArg<T>,
  >(this: T, arg: Arg, ...args: JoinArgs<T, Arg>): WhereResult<T> {
    const q = (this as unknown as Query).clone();
    return _queryOrNot(q, existsArgs(q, arg as never, args as never)) as never;
  }
}
