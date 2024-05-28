import {
  GetQueryResult,
  PickQueryMetaResultRelationsWithDataReturnType,
  PickQueryMetaResultRelationsWithDataReturnTypeShape,
  PickQueryMetaShapeRelationsWithData,
  PickQueryMetaWithData,
  PickQueryQ,
  PickQueryRelationsWithData,
  PickQueryWithData,
  Query,
  SelectableFromShape,
  WithDataItem,
} from '../../query/query';
import { pushQueryValue, setQueryObjectValue } from '../../query/queryUtils';
import {
  EmptyTuple,
  Expression,
  PickQueryMeta,
  PickQueryMetaResultReturnType,
  PickQueryMetaShape,
  PickQueryResult,
  PickQueryTable,
  PickQueryTableMetaResult,
  PickQueryTableMetaResultShape,
  QueryColumns,
  QueryColumnToNullable,
  QueryMetaBase,
  QueryThen,
  SelectableBase,
} from 'orchid-core';
import { _join, _joinLateral } from './_join';
import { AliasOrTable } from '../../common/utils';
import {
  ColumnsShapeToNullableObject,
  ColumnsShapeToObject,
} from '../../columns';

// Type of column names of a `with` table, to use to join a `with` table by these columns.
// Union of `with` column names that may be prefixed with a `with` table name.
type WithSelectable<
  T extends PickQueryWithData,
  W extends keyof T['withData'],
> = T['withData'][W] extends WithDataItem
  ?
      | keyof T['withData'][W]['shape']
      | `${T['withData'][W]['table']}.${keyof T['withData'][W]['shape'] &
          string}`
  : never;

/**
 * The first argument of all `join` and `joinLateral` methods.
 * See argument of {@link join}.
 */
export type JoinFirstArg<T extends PickQueryRelationsWithData> =
  | PickQueryTableMetaResult
  | keyof T['relations']
  | keyof T['withData']
  | ((q: T['relations']) => PickQueryTableMetaResult);

/**
 * Arguments of `join` methods (not `joinLateral`).
 * See {@link join}
 */
export type JoinArgs<
  T extends PickQueryMetaShapeRelationsWithData,
  Arg extends JoinFirstArg<T>,
> =
  | [on?: JoinCallback<T, Arg>]
  | (Arg extends PickQueryTableMetaResult
      ? JoinQueryArgs<T, Arg>
      : Arg extends keyof T['relations']
      ? EmptyTuple
      : Arg extends keyof T['withData']
      ? JoinWithArgs<T, Arg>
      : never);

/**
 * Column names of the joined table that can be used to join.
 * Derived from 'result', not from 'shape',
 * because if the joined table has a specific selection, it will be wrapped like:
 * ```sql
 * JOIN (SELECT something FROM joined) joined ON joined.something = ...
 * ```
 * And the selection becomes available to use in the `ON` and to select from the joined table.
 */
type JoinSelectable<Q extends PickQueryTableMetaResult> =
  | keyof Q['result']
  | `${AliasOrTable<Q>}.${keyof Q['result'] & string}`;

// Available arguments when joining a query object. Can be:
// - an object where keys are columns of the joined table and values are columns of the main table or a raw SQL.
// - raw SQL expression
// - `true` to join without conditions
// - pair of columns, first is of the joined table, second is of main table
// - string tuple of a column of a joined table, operator string such as '=' or '!=', and a column of the main table
type JoinQueryArgs<
  T extends PickQueryMeta,
  Q extends PickQueryTableMetaResult,
> =
  | [
      conditions:
        | {
            [K in JoinSelectable<Q>]:
              | keyof T['meta']['selectable']
              | Expression;
          }
        | Expression
        | true,
    ]
  | [
      leftColumn: JoinSelectable<Q> | Expression,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ]
  | [
      leftColumn: JoinSelectable<Q> | Expression,
      op: string,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ];

// Available arguments when joining a `with` table. Can be:
// - an object where keys are columns of the `with` table and values are columns of the main table or a raw SQL
// - raw SQL expression
// - pair of columns, first is of the `with` table, second is of main table
// - string tuple of a column of a `with` table, operator string such as '=' or '!=', and a column of the main table
type JoinWithArgs<
  T extends PickQueryMetaWithData,
  W extends keyof T['withData'],
> =
  | [
      conditions:
        | {
            [K in WithSelectable<T, W>]:
              | keyof T['meta']['selectable']
              | Expression;
          }
        | Expression,
    ]
  | [
      leftColumn: WithSelectable<T, W> | Expression,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ]
  | [
      leftColumn: WithSelectable<T, W> | Expression,
      op: string,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ];

/**
 * Result of all `join` methods, not `joinLateral`.
 * Adds joined table columns from its 'result' to the 'selectable' of the query.
 *
 * @param T - query type to join to
 * @param Arg - first arg of join, see {@link JoinFirstArg}
 * @param RequireJoined - when false, joined table shape will be mapped to make all columns optional
 * @param RequireMain - when false, main table shape will be mapped to make all columns optional (for right and full join)
 */
export type JoinResult<
  T extends PickQueryMetaResultReturnType,
  R extends PickQueryTableMetaResult,
  RequireJoined,
  RequireMain,
> = RequireMain extends true
  ? JoinAddSelectable<
      T,
      JoinResultSelectable<R['result'], AliasOrTable<R>, RequireJoined>
    >
  : JoinOptionalMain<
      T,
      JoinResultSelectable<R['result'], AliasOrTable<R>, RequireJoined>
    >;

/**
 * Calls {@link JoinResult} with either callback result, if join has a callback,
 * or with a query derived from the first join argument.
 */
type JoinResultFromArgs<
  T extends PickQueryMetaResultRelationsWithDataReturnType,
  Arg,
  Args,
  RequireJoined,
  RequireMain,
> = JoinResult<
  T,
  Args extends GenericJoinCallbackTuple
    ? ReturnType<Args[0]>
    : Arg extends PickQueryTableMetaResultShape
    ? Arg['meta']['hasSelect'] extends true
      ? // If joined query has select, computed values won't be available, use `result` as is
        Arg
      : // If no select, allow using computed values by setting result to shape
        { table: Arg['table']; meta: Arg['meta']; result: Arg['shape'] }
    : Arg extends keyof T['relations']
    ? T['relations'][Arg]['relationConfig']['query']
    : Arg extends GenericJoinCallback
    ? ReturnType<Arg>
    : Arg extends keyof T['withData']
    ? T['withData'][Arg] extends WithDataItem
      ? {
          table: T['withData'][Arg]['table'];
          meta: QueryMetaBase;
          result: T['withData'][Arg]['shape'];
        }
      : never
    : never,
  RequireJoined,
  RequireMain
>;

type GenericJoinCallback = (q: never) => PickQueryTableMetaResult;
type GenericJoinCallbackTuple = [GenericJoinCallback];

/**
 * Result of all `joinLateral` methods.
 * Adds joined table columns from its 'result' to the 'selectable' of the query.
 *
 * @param T - query type to join to
 * @param Arg - first arg of join, see {@link JoinFirstArg}
 * @param RequireJoined - when false, joined table shape will be mapped to make all columns optional
 */
export type JoinLateralResult<
  T extends PickQueryMeta,
  Table extends string,
  Meta extends QueryMetaBase,
  Result extends QueryColumns,
  RequireJoined,
> = JoinAddSelectable<
  T,
  JoinResultSelectable<
    Result,
    Meta['as'] extends string ? Meta['as'] : Table,
    RequireJoined
  >
>;

/**
 * Build `selectable` type for joined table.
 *
 * When `RequireJoined` parameter is false,
 * the result type of the joined table will be mapped to make all columns optional.
 *
 * Callback may override the joined table alias.
 *
 * The resulting selectable receives all joined table columns prefixed with the table name or alias,
 * and a star prefixed with the table name or alias to select all joined columns.
 */
type JoinResultSelectable<
  // Interestingly, accepting T and inlining T['result'] adds a LOT (~823k) instantiations
  Result extends QueryColumns,
  As extends string,
  RequireJoined,
> = (RequireJoined extends true
  ? {
      [K in keyof Result & string as `${As}.${K}`]: {
        as: K;
        column: Result[K];
      };
    }
  : {
      [K in keyof Result & string as `${As}.${K}`]: {
        as: K;
        column: QueryColumnToNullable<Result[K]>;
      };
    }) & {
  [K in As as `${As}.*`]: {
    as: K;
    column: RequireJoined extends true
      ? ColumnsShapeToObject<Result>
      : ColumnsShapeToNullableObject<Result>;
  };
};

// Replace the 'selectable' of the query with the given selectable.
type JoinAddSelectable<T extends PickQueryMeta, Selectable> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'selectable'
          ? T['meta']['selectable'] & Selectable
          : T['meta'][K];
      }
    : T[K];
};

// Map `selectable` of the query to make all columns optional, and add the given `Selectable` to it.
// Derive and apply a new query result type, where all columns become optional.
type JoinOptionalMain<
  T extends PickQueryMetaResultReturnType,
  Selectable extends SelectableBase,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'selectable'
          ? {
              [K in keyof T['meta']['selectable']]: {
                as: T['meta']['selectable'][K]['as'];
                column: QueryColumnToNullable<
                  T['meta']['selectable'][K]['column']
                >;
              };
            } & Selectable
          : T['meta'][K];
      }
    : K extends 'result'
    ? NullableResult<T>
    : K extends 'then'
    ? QueryThen<GetQueryResult<T, NullableResult<T>>>
    : T[K];
};

type NullableResult<T extends PickQueryResult> = {
  [K in keyof T['result']]: QueryColumnToNullable<T['result'][K]>;
};

/**
 * Map the `with` table first argument of `join` or `joinLateral` to a query type.
 * Constructs `selectable` based on `with` table shape, and adds generic types to conform the `QueryBase` type.
 */
interface JoinWithArgToQuery<With extends WithDataItem> extends Query {
  table: With['table'];
  meta: QueryMetaBase & {
    selectable: {
      [K in keyof With['shape'] & string as `${With['table']}.${K}`]: {
        as: K;
        column: With['shape'][K];
      };
    };
  };
  result: With['shape'];
}

/**
 * Map the first argument of `join` or `joinLateral` to a query type.
 *
 * `with` table arg is mapped into `QueryBase`,
 * query arg is returned as is,
 * relation name is replaced with a relation table.
 */
type JoinArgToQuery<
  T extends PickQueryRelationsWithData,
  Arg extends JoinFirstArg<T>,
> = Arg extends keyof T['withData']
  ? T['withData'][Arg] extends WithDataItem
    ? JoinWithArgToQuery<T['withData'][Arg]>
    : never
  : Arg extends PickQueryTableMetaResult
  ? Arg
  : Arg extends keyof T['relations']
  ? T['relations'][Arg]['relationConfig']['query']
  : Arg extends JoinArgToQueryCallback
  ? ReturnType<Arg>
  : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JoinArgToQueryCallback = (...args: any[]) => PickQueryTableMetaResult;

/**
 * Type of the `join` callback (not `joinLateral`).
 *
 * Receives a query builder that can access columns of both the main and the joined table.
 *
 * The query builder is limited to `or` and `where` methods only.
 *
 * Callback must return a query builder.
 */
export type JoinCallback<
  T extends PickQueryMetaShapeRelationsWithData,
  Arg extends JoinFirstArg<T>,
> = (
  q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>,
) => PickQueryTableMetaResult;

/**
 * Type of the `joinLateral`.
 *
 * Receives a query builder that can access columns of both the main and the joined table.
 *
 * Query builder inside callback is the query derived from the `joinLateral` first argument,
 * all query methods are allowed, `on` methods are available.
 *
 * The callback must return a query object. Its resulting type will become a type of the joined table.
 */
export type JoinLateralCallback<
  T extends PickQueryMetaShapeRelationsWithData,
  Arg extends JoinFirstArg<T>,
  Table extends string,
  Meta extends QueryMetaBase,
  Result extends QueryColumns,
> = (q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>) => {
  table: Table;
  meta: Meta;
  result: Result;
};

/**
 * Type of {@link Join.join} query method.
 */
export type JoinQueryMethod = <
  T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
  Arg extends JoinFirstArg<T>,
  Args extends JoinArgs<T, Arg>,
>(
  this: T,
  arg: Arg,
  ...args: Args
) => JoinResultFromArgs<T, Arg, Args, true, true>;

export class Join {
  /**
   * ## Select relation
   *
   * Before joining a table, consider if selecting a relation is enough for your case:
   *
   * ```ts
   * // select users with profiles
   * // result type is Array<{ name: string, profile: Profile }>
   * await db.user.select('name', {
   *   profile: (q) => q.profile,
   * });
   *
   * // select posts with counts of comments, filter and order by comments count
   * // result type is Array<Post & { commentsCount: number }>
   * await db.post
   *   .select('*', {
   *     commentsCount: (q) => q.comments.count(),
   *   })
   *   .where({ commentsCount: { gt: 10 } })
   *   .order({ commentsCount: 'DESC' });
   *
   * // select authors with array of their book titles
   * // result type is Array<Author & { books: string[] }>
   * await db.author.select('*', {
   *   books: (q) => q.books.pluck('title'),
   * });
   * ```
   *
   * Internally, such selects will use `LEFT JOIN LATERAL` to join a relation.
   * If you're loading users with profiles (one-to-one relation), and some users don't have a profile, `profile` property will have `NULL` for such users.
   * If you want to load only users that have profiles, and filter out the rest, add `.join()` method to the relation without arguments:
   *
   * ```ts
   * // load only users who have a profile
   * await db.user.select('*', {
   *   profile: (q) => q.profile.join(),
   * });
   *
   * // load only users who have a specific profile
   * await db.user.select('*', {
   *   profile: (q) => q.profile.join().where({ age: { gt: 20 } }),
   * });
   * ```
   *
   * You can also use this `.join()` method on the one-to-many relations, and records with empty array will be filtered out:
   *
   * ```ts
   * // posts that have no tags won't be loaded
   * // result type is Array<Post & { tags: Tag[] }>
   * db.post.select('*', {
   *   tags: (q) => q.tags.join(),
   * });
   * ```
   *
   * # Joins
   *
   * `join` methods allows to join other tables, relations by name, [with](/guide/advanced-queries#with) statements, sub queries.
   *
   * All the `join` methods accept the same arguments, but returning type is different because with `join` it's guaranteed to load joined table, and with `leftJoin` the joined table columns may be `NULL` when no matching record was found.
   *
   * For the following examples, imagine we have a `User` table with `id` and `name`, and `Message` table with `id`, `text`, messages belongs to user via `userId` column:
   *
   * ```ts
   * export class UserTable extends BaseTable {
   *   readonly table = 'user';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     name: t.text(),
   *   }));
   *
   *   relations = {
   *     messages: this.hasMany(() => MessageTable, {
   *       primaryKey: 'id',
   *       foreignKey: 'userId',
   *     }),
   *   };
   * }
   *
   * export class MessageTable extends BaseTable {
   *   readonly table = 'message';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     text: t.text(),
   *     ...t.timestamps(),
   *   }));
   *
   *   relations = {
   *     user: this.belongsTo(() => UserTable, {
   *       primaryKey: 'id',
   *       foreignKey: 'userId',
   *     }),
   *   };
   * }
   * ```
   *
   * ## join
   *
   * `join` is a method for SQL `JOIN`, which is equivalent to `INNER JOIN`, `LEFT INNERT JOIN`.
   *
   * When no matching record is found, it will skip records of the main table.
   *
   * When joining the same table with the same condition more than once, duplicated joins will be ignored:
   *
   * ```ts
   * // joining a relation
   * db.post.join('comments').join('comments');
   *
   * // joining a table with a condition
   * db.post
   *   .join('comments', 'comments.postId', 'post.id')
   *   .join('comments', 'comments.postId', 'post.id');
   * ```
   *
   * Both queries will produce SQL with only 1 join
   *
   * ```sql
   * SELECT * FROM post JOIN comments ON comments.postId = post.id
   * ```
   *
   * However, this is only possible if the join has no dynamic values:
   *
   * ```ts
   * db.post
   *   .join('comments', (q) => q.where({ rating: { gt: 5 } }))
   *   .join('comments', (q) => q.where({ rating: { gt: 5 } }));
   * ```
   *
   * Both joins above have the same `{ gt: 5 }`, but still, the `5` is a dynamic value and in this case joins will be duplicated,
   * resulting in a database error.
   *
   * ### join relation
   *
   * When relations are defined between the tables, you can join them by a relation name.
   * Joined table can be references from `where` and `select` by a relation name.
   *
   * ```ts
   * const result = await db.user
   *   .join('messages')
   *   // after joining a table, we can use it in `where` conditions:
   *   .where({ 'messages.text': { startsWith: 'Hi' } })
   *   .select(
   *     'name', // name is User column, table name may be omitted
   *     'messages.text', // text is the Message column, and the table name is required
   *   );
   *
   * // result has the following type:
   * const ok: { name: string; text: string }[] = result;
   * ```
   *
   * The first argument can also be a callback, where instead of relation name as a string we're picking it as a property of `q`.
   * In such a way, we can alias the relation with `as`, add `where` conditions, use other query methods.
   *
   * ```ts
   * const result = await db.user.join((q) =>
   *   q.messages.as('m').where({ text: 'some text' }),
   * );
   * ```
   *
   * Optionally, you can pass a second callback argument, it makes `on` and `orOn` methods available.
   *
   * But remember that when joining a relation, the relevant `ON` conditions are already handled automatically.
   *
   * ```ts
   * const result = await db.user.join(
   *   (q) => q.messages.as('m'),
   *   (q) =>
   *     q
   *       .on('text', 'name') // additionally, match message with user name
   *       .where({ text: 'some text' }), // you can add `where` in a second callback as well.
   * );
   * ```
   *
   * ### Selecting full joined records
   *
   * `select` supports selecting a full record of a previously joined table by passing a table name with `.*` at the end:
   *
   * ```ts
   * const result = await db.book.join('author').select('title', {
   *   author: 'author.*',
   * });
   *
   * // result has the following type:
   * const ok: {
   *   // title of the book
   *   title: string;
   *   // a full author record is included:
   *   author: { id: number; name: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * It works fine for `1:1` (`belongsTo`, `hasOne`) relations, but it may have an unexpected result for `1:M` or `M:M` (`hasMany`, `hasAndBelongsToMany`) relations.
   * For any kind of relation, it results in one main table record with data of exactly one joined table record, i.e. when selecting in this way, the records **won't** be collected into arrays.
   *
   * ```ts
   * const result = await db.user
   *   .join('messages')
   *   .where({ 'messages.text': { startsWith: 'Hi' } })
   *   .select('name', { messages: 'messages.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included:
   *   messages: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * Because it's a one-to-many relation, one user has many messages, the user data will be duplicated for different messages data:
   *
   * | name   | msg                            |
   * | ------ | ------------------------------ |
   * | user 1 | `{ id: 1, text: 'message 1' }` |
   * | user 1 | `{ id: 2, text: 'message 2' }` |
   * | user 1 | `{ id: 3, text: 'message 3' }` |
   *
   * ### join table
   *
   * If relation wasn't defined, provide a `db.table` instance and specify columns for the join.
   * Joined table can be references from `where` and `select` by a table name.
   *
   * ```ts
   * // Join message where userId = id:
   * db.user
   *   .join(db.message, 'userId', 'id')
   *   .where({ 'message.text': { startsWith: 'Hi' } })
   *   .select('name', 'message.text');
   * ```
   *
   * Columns in the join list may be prefixed with table names for clarity:
   *
   * ```ts
   * db.user.join(db.message, 'message.userId', 'user.id');
   * ```
   *
   * Joined table can have an alias for referencing it further:
   *
   * ```ts
   * db.user
   *   .join(db.message.as('m'), 'message.userId', 'user.id')
   *   .where({ 'm.text': { startsWith: 'Hi' } })
   *   .select('name', 'm.text');
   * ```
   *
   * Joined table can be selected as an object as well as the relation join above:
   *
   * ```ts
   * const result = await db.user
   *   .join(db.message.as('m'), 'message.userId', 'user.id')
   *   .where({ 'm.text': { startsWith: 'Hi' } })
   *   .select('name', { msg: 'm.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included as msg:
   *   msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * You can provide a custom comparison operator
   *
   * ```ts
   * db.user.join(db.message, 'userId', '!=', 'id');
   * ```
   *
   * Join can accept raw SQL for the `ON` part of join:
   *
   * ```ts
   * db.user.join(
   *   db.message,
   *   // `sql` can be imported from your `BaseTable` file
   *   sql`lower("message"."text") = lower("user"."name")`,
   * );
   * ```
   *
   * Join can accept raw SQL instead of columns:
   *
   * ```ts
   * db.user.join(
   *   db.message,
   *   sql`lower("message"."text")`,
   *   sql`lower("user"."name")`,
   * );
   *
   * // with operator:
   * db.user.join(
   *   db.message,
   *   sql`lower("message"."text")`,
   *   '!=',
   *   sql`lower("user"."name")`,
   * );
   * ```
   *
   * To join based on multiple columns, you can provide an object where keys are joining table columns, and values are main table columns or a raw SQL:
   *
   * ```ts
   * db.user.join(db.message, {
   *   userId: 'id',
   *
   *   // with table names:
   *   'message.userId': 'user.id',
   *
   *   // value can be a raw SQL expression:
   *   text: sql`lower("user"."name")`,
   * });
   * ```
   *
   * Join all records without conditions by providing `true`:
   *
   * ```ts
   * db.user.join(db.message, true);
   * ```
   *
   * Join methods can accept a callback with a special query builder that has `on` and `orOn` methods for handling advanced cases:
   *
   * ```ts
   * db.user.join(
   *   db.message,
   *   (q) =>
   *     q
   *       // left column is the db.message column, right column is the db.user column
   *       .on('userId', 'id')
   *       // table names can be provided:
   *       .on('message.userId', 'user.id')
   *       // operator can be specified:
   *       .on('userId', '!=', 'id')
   *       // operator can be specified with table names as well:
   *       .on('message.userId', '!=', 'user.id')
   *       // `.orOn` takes the same arguments as `.on` and acts like `.or`:
   *       .on('userId', 'id') // where message.userId = user.id
   *       .orOn('text', 'name'), // or message.text = user.name
   * );
   * ```
   *
   * Column names in the where conditions are applied for the joined table, but you can specify a table name to add a condition for the main table.
   *
   * ```ts
   * db.user.join(db.message, (q) =>
   *   q
   *     .on('userId', 'id')
   *     .where({
   *       // not prefixed column name is for joined table:
   *       text: { startsWith: 'hello' },
   *       // specify a table name to set condition on the main table:
   *       'user.name': 'Bob',
   *     })
   *     // id is a column of a joined table Message
   *     .whereIn('id', [1, 2, 3])
   *     // condition for id of a user
   *     .whereIn('user.id', [4, 5, 6]),
   * );
   * ```
   *
   * The query above will generate the following SQL (simplified):
   *
   * ```sql
   * SELECT * FROM "user"
   * JOIN "message"
   *   ON "message"."userId" = "user"."id"
   *  AND "message"."text" ILIKE 'hello%'
   *  AND "user"."name" = 'Bob'
   *  AND "message"."id" IN (1, 2, 3)
   *  AND "user"."id" IN (4, 5, 6)
   * ```
   *
   * The join argument can be a query with `select`, `where`, and other methods. In such case, it will be handled as a sub query:
   *
   * ```ts
   * db.user.join(
   *   db.message
   *     .select('id', 'userId', 'text')
   *     .where({ text: { startsWith: 'Hi' } })
   *     .as('t'),
   *   'userId',
   *   'id',
   * );
   * ```
   *
   * It will produce such SQL:
   *
   * ```sql
   * SELECT * FROM "user"
   * JOIN (
   *   SELECT "t"."id", "t"."userId", "t"."text"
   *   FROM "message" AS "t"
   * ) "t" ON "t"."userId" = "user"."id"
   * ```
   *
   * ## implicit join lateral
   *
   * `JOIN`'s source expression that comes before `ON` cannot access other tables, but in some cases this may be needed.
   *
   * For example, let's consider joining last 10 messages of a user:
   *
   * ```ts
   * await db.user.join('messages', (q) => q.order({ createdAt: 'DESC' }).limit(10));
   * ```
   *
   * When the `join`'s callback returns a more complex query than the one that simply applies certain conditions,
   * it will implicitly generate a `JOIN LATERAL` SQL query, as the following:
   *
   * ```sql
   * SELECT *
   * FROM "user"
   * JOIN LATERAL (
   *   SELECT *
   *   FROM "message" AS "messages"
   *   WHERE "message"."userId" = "user"."id"
   *   ORDER BY "message"."createdAt" DESC
   *   LIMIT 10
   * ) "messages" ON true
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  join<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, true, true> {
    return _join(
      (this as any).clone(), // eslint-disable-line @typescript-eslint/no-explicit-any
      true,
      'JOIN',
      arg,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `leftJoin` is a method for SQL `LEFT JOIN`, which is equivalent to `OUTER JOIN`, `LEFT OUTER JOIN`.
   *
   * When no matching record is found, it will fill joined table columns with `NULL` values in the result rows.
   *
   * Works just like `join`, except for result type that may have `null`:
   *
   * ```ts
   * const result = await db.user
   *   .leftJoin('messages')
   *   .select('name', 'messages.text');
   *
   * // the same query, but joining table explicitly
   * const result2: typeof result = await db.user
   *   .leftJoin(db.message, 'userId', 'id')
   *   .select('name', 'message.text');
   *
   * // result has the following type:
   * const ok: { name: string; text: string | null }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  leftJoin<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, false, true> {
    return _join(
      (this as any).clone(), // eslint-disable-line @typescript-eslint/no-explicit-any
      false,
      'LEFT JOIN',
      arg,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `rightJoin` is a method for SQL `RIGHT JOIN`, which is equivalent to `RIGHT OUTER JOIN`.
   *
   * Takes the same arguments as `json`.
   *
   * It will load all records from the joining table, and fill the main table columns with `null` when no match is found.
   *
   * The columns of the table you're joining to are becoming nullable when using `rightJoin`.
   *
   * ```ts
   * const result = await db.user
   *   .rightJoin('messages')
   *   .select('name', 'messages.text');
   *
   * // even though name is not a nullable column, it becomes nullable after using rightJoin
   * const ok: { name: string | null; text: string }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  rightJoin<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, true, false> {
    return _join(
      (this as any).clone(), // eslint-disable-line @typescript-eslint/no-explicit-any
      true,
      'RIGHT JOIN',
      arg,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `fullJoin` is a method for SQL `FULL JOIN`, which is equivalent to `FULL OUTER JOIN`.
   *
   * Takes the same arguments as `json`.
   *
   * It will load all records from the joining table, both sides of the join may result in `null` values when there is no match.
   *
   * All columns become nullable after using `fullJoin`.
   *
   * ```ts
   * const result = await db.user
   *   .rightJoin('messages')
   *   .select('name', 'messages.text');
   *
   * // all columns can be null
   * const ok: { name: string | null; text: string | null }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  fullJoin<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, false, false> {
    return _join(
      (this as any).clone(), // eslint-disable-line @typescript-eslint/no-explicit-any
      false,
      'FULL JOIN',
      arg,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `joinLateral` allows joining a table with a sub-query that can reference the main table of current query and the other joined tables.
   *
   * First argument is the other table you want to join, or a name of relation, or a name of `with` defined table.
   *
   * Second argument is a callback where you can reference other tables using `on` and `orOn`, select columns, do `where` conditions, and use any other query methods to build a sub-query.
   *
   * Note that the regular `join` will also generate `JOIN LATERAL` SQL expression when the query returned from callback is complex enough (see the bottom of {@link join} description).
   *
   * ```ts
   * // joinLateral a Message table, alias it as `m`
   * // without aliasing you can refer to the message by a table name
   * User.joinLateral(Message.as('m'), (q) =>
   *   q
   *     // select message columns
   *     .select('text')
   *     // join the message to the user, column names can be prefixed with table names
   *     .on('authorId', 'id')
   *     // message columns are available without prefixing,
   *     // outer table columns are available with a table name
   *     .where({ text: 'some text', 'user.name': 'name' })
   *     .order({ createdAt: 'DESC' }),
   * )
   *   // only selected message columns are available in select and where
   *   .select('id', 'name', 'm.text')
   *   .where({ 'm.text': messageData.text });
   * ```
   *
   * As well as simple `join`, `joinLateral` can select an object of full joined record:
   *
   * ```ts
   * // join by relation name
   * const result = await User.joinLateral(
   *   'messages',
   *   (q) => q.as('message'), // alias to 'message'
   * ).select('name', { message: 'message.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included:
   *   message: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * `message` can be aliased withing the `select` as well as in case of a simple `join`:
   *
   * ```ts
   * // join by relation name
   * const result = await User.joinLateral(
   *   'messages',
   *   (q) => q.as('message'), // alias to 'message'
   * ).select('name', { msg: 'message.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included as msg:
   *   msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param cb - {@link JoinLateralCallback}
   */
  joinLateral<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    Table extends string,
    Meta extends QueryMetaBase,
    Result extends QueryColumns,
  >(
    this: T,
    arg: Arg,
    cb: JoinLateralCallback<T, Arg, Table, Meta, Result>,
  ): JoinLateralResult<T, Table, Meta, Result, true> {
    return _joinLateral<T, Arg, Table, Meta, Result, true>(
      (this as any).clone(), // eslint-disable-line @typescript-eslint/no-explicit-any
      'JOIN',
      arg,
      cb,
    );
  }

  /**
   * The same as {@link joinLateral}, but when no records found for the join it will result in `null`:
   *
   * ```ts
   * const result = await db.user
   *   .leftJoinLateral('messages', (q) => q.as('message'))
   *   .select('name', 'message.text');
   *
   * // result has the following type:
   * const ok: { name: string; text: string | null }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param cb - {@link JoinLateralCallback}
   */
  leftJoinLateral<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    Table extends string,
    Meta extends QueryMetaBase,
    Result extends QueryColumns,
  >(
    this: T,
    arg: Arg,
    cb: JoinLateralCallback<T, Arg, Table, Meta, Result>,
  ): JoinLateralResult<T, Table, Meta, Result, false> {
    return _joinLateral<T, Arg, Table, Meta, Result, false>(
      (this as any).clone(), // eslint-disable-line @typescript-eslint/no-explicit-any
      'LEFT JOIN',
      arg,
      cb,
    );
  }
}

// Arguments of `on` and `orOn` methods inside `join` callback.
// Takes a pair of columns to check them for equality, or a pair of columns separated with an operator such as '!='.
type OnArgs<S extends SelectableBase> =
  | [leftColumn: keyof S, rightColumn: keyof S]
  | [leftColumn: keyof S, op: string, rightColumn: keyof S];

// Construct an object for `ON` type of where condition.
const makeOnItem = (
  joinTo: PickQueryMeta,
  joinFrom: PickQueryMeta,
  args: OnArgs<SelectableBase>,
) => {
  return {
    ON: {
      joinTo,
      joinFrom,
      on: args,
    },
  };
};

// Add `ON` statement.
export const pushQueryOn = <T extends PickQueryMeta>(
  q: T,
  joinFrom: PickQueryMeta,
  joinTo: PickQueryMeta,
  ...on: OnArgs<SelectableBase>
): T => {
  return pushQueryValue(
    q as unknown as PickQueryQ,
    'and',
    makeOnItem(joinFrom, joinTo, on),
  ) as unknown as T;
};

// Add `ON` statement separated from previous statements with `OR`.
export const pushQueryOrOn = <T extends PickQueryMeta>(
  q: T,
  joinFrom: PickQueryMeta,
  joinTo: PickQueryMeta,
  ...on: OnArgs<SelectableBase>
) => {
  return pushQueryValue(q as unknown as PickQueryQ, 'or', [
    makeOnItem(joinFrom, joinTo, on),
  ]);
};

// Used by the ORM to join relations.
// Adds a shape of relation to the `joinedShapes`, and adds an `on` statement.
export const addQueryOn = <T extends PickQueryMeta>(
  q: T,
  joinFrom: PickQueryMeta,
  joinTo: PickQueryMeta,
  ...args: OnArgs<SelectableBase>
): T => {
  const cloned = (q as unknown as Query).clone() as unknown;
  setQueryObjectValue(
    cloned as PickQueryQ,
    'joinedShapes',
    ((joinFrom as unknown as PickQueryQ).q.as ||
      (joinFrom as PickQueryTable).table) as string,
    (joinFrom as unknown as PickQueryQ).q.shape,
  );
  return pushQueryOn(cloned as PickQueryMeta, joinFrom, joinTo, ...args) as T;
};

// To join record based on a value inside their json columns
type OnJsonPathEqualsArgs<S extends SelectableBase> = [
  leftColumn: keyof S,
  leftPath: string,
  rightColumn: keyof S,
  rightPath: string,
];

/**
 * Mutative {@link OnMethods.on}
 */
export const _queryJoinOn = <T extends PickQueryMeta>(
  q: T,
  args: OnArgs<T['meta']['selectable']>,
): T => {
  return pushQueryOn(
    q,
    (q as unknown as PickQueryQ).q.joinTo as unknown as PickQueryMeta,
    q,
    ...args,
  );
};

/**
 * Mutative {@link OnMethods.orOn}
 */
export const _queryJoinOrOn = <T extends PickQueryMeta>(
  q: T,
  args: OnArgs<T['meta']['selectable']>,
): T => {
  return pushQueryOrOn(
    q,
    (q as unknown as PickQueryQ).q.joinTo as unknown as PickQueryMeta,
    q,
    ...args,
  ) as unknown as T;
};

/**
 * Mutative {@link OnMethods.onJsonPathEquals}
 */
export const _queryJoinOnJsonPathEquals = <T extends PickQueryMeta>(
  q: T,
  args: OnJsonPathEqualsArgs<T['meta']['selectable']>,
): T => {
  return pushQueryValue(q as unknown as PickQueryQ, 'and', {
    ON: args,
  }) as unknown as T;
};

/**
 * Argument of join callback.
 * It is a query object of table that you're joining, with ability to select main table's columns.
 * Adds {@link OnMethods.on} method and similar to the query.
 */
export type JoinQueryBuilder<
  T extends PickQueryMetaShape = PickQueryMetaShape,
  J extends PickQueryTableMetaResult = PickQueryTableMetaResult,
> = {
  [K in keyof J]: K extends 'meta'
    ? {
        [K in keyof J['meta']]: K extends 'selectable'
          ? SelectableFromShape<J['result'], AliasOrTable<J>> &
              Omit<T['meta']['selectable'], keyof T['shape']>
          : J['meta'][K];
      }
    : J[K];
} & OnMethods;

export class OnMethods {
  /**
   * Use `on` to specify columns to join records.
   *
   * ```ts
   * q
   *   // left column is the db.message column, right column is the db.user column
   *   .on('userId', 'id')
   *   // table names can be provided:
   *   .on('message.userId', 'user.id')
   *   // operator can be specified:
   *   .on('userId', '!=', 'id')
   *   // operator can be specified with table names as well:
   *   .on('message.userId', '!=', 'user.id')
   *   // `.orOn` takes the same arguments as `.on` and acts like `.or`:
   *   .on('userId', 'id') // where message.userId = user.id
   * ```
   *
   * @param args - columns to join with
   */
  on<T extends PickQueryMeta>(
    this: T,
    ...args: OnArgs<T['meta']['selectable']>
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return _queryJoinOn((this as any).clone(), args);
  }

  /**
   * Works as {@link on}, but the added conditions will be separated from previous with `OR`.
   *
   * @param args - columns to join with
   */
  orOn<T extends PickQueryMeta>(
    this: T,
    ...args: OnArgs<T['meta']['selectable']>
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return _queryJoinOrOn((this as any).clone(), args);
  }

  /**
   * Use `onJsonPathEquals` to join record based on a field of their JSON column:
   *
   * ```ts
   * db.table.join(db.otherTable, (q) =>
   *   // '$.key' is a JSON path
   *   q.onJsonPathEquals('otherTable.data', '$.key', 'table.data', '$.key'),
   * );
   * ```
   *
   * @param args - columns and JSON paths to join with.
   */
  onJsonPathEquals<T extends PickQueryMeta>(
    this: T,
    ...args: OnJsonPathEqualsArgs<T['meta']['selectable']>
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return _queryJoinOnJsonPathEquals((this as any).clone(), args);
  }
}
