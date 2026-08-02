import { IsQuery, Query, QuerySelectable, SelectableFromShape } from '../../query';
import { Column } from '../../../columns/column';
import { ColumnsShape } from '../../../columns';
import { PickQuerySelectableResultRelationsWithDataReturnType, PickQueryResultRelationsWithDataReturnTypeShape, PickQuerySelectableShapeRelationsWithDataAs, PickQueryRelationsWithData, PickQueryResultAs, PickQueryShapeAsRelations, PickQuerySelectable, PickQuerySelectableRelationsResultReturnType, PickQuerySelectableShape, PickQuerySelectableColumnTypes, PickQuerySelectableResultAs, PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, PickQuerySelectableShapeRelationsWithDataAsResultReturnType, PickQueryHasSelectResultShapeAsRelations, PickQuerySelectableRelations, PickQueryResultAsRelations } from '../../pick-query-types';
import { EmptyObject, EmptyTuple } from '../../../utils';
import { Expression } from '../../expressions/expression';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { WithDataItem } from '../cte/cte.sql';
import { RelationsBase } from '../../relations';
import { JoinItemArgs } from './join.sql';
import { ToSQLQuery } from '../../sql/to-sql';
import { QueryThenByQuery } from '../../then/then';
type WithSelectable<W extends WithDataItem> = keyof W['shape'] | `${W['table']}.${keyof W['shape'] & string}`;
/**
 * The first argument of all `join` and `joinLateral` methods.
 * See argument of {@link join}.
 */
export type JoinFirstArg<T extends PickQueryRelationsWithData> = PickQueryResultAs | keyof T['relations'] | keyof T['withData'] | ((q: {
    [K in keyof T['relations']]: T['relations'][K]['query'];
}) => PickQueryResultAs) | FnPickQueryResultAs;
interface FnPickQueryResultAs {
    (): PickQueryResultAs;
}
/**
 * Arguments of `join` methods (not `joinLateral`).
 * See {@link join}
 */
export type JoinArgs<T extends PickQuerySelectableShapeRelationsWithDataAs, Arg extends JoinFirstArg<T>> = Arg extends PickQueryResultAs ? [
    conditions: {
        [K in JoinSelectable<Arg>]: keyof T['__selectable'] | Expression;
    } | Expression
] | [
    leftColumn: JoinSelectable<Arg> | Expression,
    rightColumn: keyof T['__selectable'] | Expression
] | [
    leftColumn: JoinSelectable<Arg> | Expression,
    op: string,
    rightColumn: keyof T['__selectable'] | Expression
] : Arg extends keyof T['withData'] ? JoinWithArgs<T, T['withData'][Arg]> : EmptyTuple;
/**
 * Column names of the joined table that can be used to join.
 * Derived from 'result', not from 'shape',
 * because if the joined table has a specific selection, it will be wrapped like:
 * ```sql
 * JOIN (SELECT something FROM joined) joined ON joined.something = ...
 * ```
 * And the selection becomes available to use in the `ON` and to select from the joined table.
 */
type JoinSelectable<Q extends PickQueryResultAs> = keyof Q['result'] | `${Q['__as']}.${keyof Q['result'] & string}`;
type JoinWithArgs<T extends PickQuerySelectable, Arg extends WithDataItem> = [
    conditions: {
        [K in WithSelectable<Arg>]: keyof T['__selectable'] | Expression;
    } | Expression
] | [
    leftColumn: WithSelectable<Arg> | Expression,
    rightColumn: keyof T['__selectable'] | Expression
] | [
    leftColumn: WithSelectable<Arg> | Expression,
    op: string,
    rightColumn: keyof T['__selectable'] | Expression
];
export type JoinResultRequireMain<T extends PickQuerySelectable, JoinedSelectable> = {
    [K in keyof T]: K extends '__selectable' ? T['__selectable'] & JoinedSelectable : T[K];
};
/**
 * Result of all `join` methods, not `joinLateral`.
 * Adds joined table columns from its 'result' to the '__selectable' of the query.
 */
export type JoinResult<T extends PickQuerySelectableRelationsResultReturnType, Joined extends PickQuerySelectableRelations, RequireMain> = RequireMain extends true ? {
    [K in keyof T]: K extends '__selectable' ? T['__selectable'] & Joined['__selectable'] : K extends 'relations' ? {
        [K in keyof T['relations'] | keyof Joined['relations']]: K extends keyof Joined['relations'] ? Joined['relations'][K] : T['relations'][K];
    } : T[K];
} : {
    [K in keyof T]: K extends '__selectable' ? {
        [K in keyof T['__selectable']]: {
            as: T['__selectable'][K]['as'];
            column: Column.QueryColumnToNullable<T['__selectable'][K]['column']>;
        };
    } & Joined['__selectable'] : K extends 'result' ? {
        [K in keyof T['result']]: Column.QueryColumnToNullable<T['result'][K]>;
    } : K extends 'then' ? QueryThenByQuery<T, {
        [K in keyof T['result']]: Column.QueryColumnToNullable<T['result'][K]>;
    }> : K extends 'relations' ? {
        [K in keyof T['relations'] | keyof Joined['relations']]: K extends keyof Joined['relations'] ? Joined['relations'][K] : T['relations'][K];
    } : T[K];
};
/**
 * Calls {@link JoinResult} with either callback result, if join has a callback,
 * or with a query derived from the first join argument.
 */
export type JoinResultFromArgs<T extends PickQuerySelectableResultRelationsWithDataReturnType, Arg, Args extends unknown[], RequireJoined, RequireMain> = JoinResult<T, Args[0] extends GenericJoinCallback ? JoinResultSelectable<ReturnType<Args[0]>['result'], ReturnType<Args[0]>['__as'], ReturnType<Args[0]>['relations'], RequireJoined> : Arg extends PickQueryHasSelectResultShapeAsRelations ? JoinResultSelectable<Arg['__hasSelect'] extends true ? Arg['result'] : Arg['shape'], Arg['__as'], Arg['relations'], RequireJoined> : Arg extends keyof T['relations'] ? JoinResultSelectable<T['relations'][Arg]['query']['shape'], T['relations'][Arg]['query']['__as'], T['relations'][Arg]['query']['relations'], RequireJoined> : Arg extends FirstArgCallback ? JoinResultSelectable<ReturnType<Arg>['shape'], ReturnType<Arg>['__as'], ReturnType<Arg>['relations'], RequireJoined> : Arg extends keyof T['withData'] ? T['withData'][Arg] extends WithDataItem ? JoinResultSelectable<T['withData'][Arg]['shape'], T['withData'][Arg]['table'], EmptyObject, RequireJoined> : never : never, RequireMain>;
interface GenericJoinCallback {
    (...args: any[]): PickQueryResultAsRelations;
}
interface FirstArgCallback {
    (...args: any[]): PickQueryShapeAsRelations;
}
/**
 * Result of all `joinLateral` methods.
 * Adds joined table columns from its 'result' to the '__selectable' of the query.
 *
 * @param T - query type to join to
 * @param Arg - first arg of join, see {@link JoinFirstArg}
 * @param RequireJoined - when false, joined table shape will be mapped to make all columns optional
 */
export type JoinLateralResult<T extends PickQuerySelectable, As extends string, Result extends Column.QueryColumns, JoinedRelations extends RelationsBase, RequireJoined> = JoinAddSelectable<T, JoinResultSelectable<Result, As, JoinedRelations, RequireJoined>>;
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
export type JoinResultSelectable<Result extends Column.QueryColumns, As extends string, JoinedRelations, RequireJoined> = RequireJoined extends true ? {
    __selectable: {
        [K in '*' | (keyof Result & string) as `${As}.${K}`]: K extends '*' ? {
            as: As;
            column: ColumnsShape.MapToObjectColumn<Result>;
        } : {
            as: K;
            column: Result[K];
        };
    };
    relations: {
        [K in keyof JoinedRelations & string as `${As}.${K}`]: JoinedRelations[K];
    };
} : {
    __selectable: {
        [K in '*' | (keyof Result & string) as `${As}.${K}`]: K extends '*' ? {
            as: As;
            column: ColumnsShape.MapToNullableObjectColumn<Result>;
        } : {
            as: K;
            column: Column.QueryColumnToNullable<Result[K]>;
        };
    };
    relations: {
        [K in keyof JoinedRelations & string as `${As}.${K}`]: JoinedRelations[K];
    };
};
type JoinAddSelectable<T extends PickQuerySelectable, Joined extends PickQuerySelectableRelations> = {
    [K in keyof T]: K extends '__selectable' ? T['__selectable'] & Joined['__selectable'] : T[K];
};
/**
 * Map the first argument of `join` or `joinLateral` to a query type.
 *
 * `with` table arg is mapped into `QueryBase`,
 * query arg is returned as is,
 * relation name is replaced with a relation table.
 */
export type JoinArgToQuery<T extends PickQueryRelationsWithData, Arg extends JoinFirstArg<T>> = Arg extends keyof T['withData'] ? T['withData'][Arg] extends WithDataItem ? {
    [K in 'result' | '__as' | keyof T]: K extends '__as' ? T['withData'][Arg]['table'] : K extends '__selectable' ? {
        [K in keyof T['withData'][Arg]['shape'] & string as `${T['withData'][Arg]['table']}.${K}`]: {
            as: K;
            column: T['withData'][Arg]['shape'][K];
        };
    } : K extends 'result' ? T['withData'][Arg]['shape'] : K extends keyof T ? T[K] : never;
} : never : Arg extends PickQuerySelectableResultAs ? Arg : Arg extends keyof T['relations'] ? T['relations'][Arg]['query'] : Arg extends JoinArgToQueryCallback ? ReturnType<Arg> : never;
interface JoinArgToQueryCallback {
    (...args: any[]): IsQuery;
}
/**
 * Type of the `join` callback (not `joinLateral`).
 *
 * Receives a query builder that can access columns of both the main and the joined table.
 *
 * The query builder is limited to `or` and `where` methods only.
 *
 * Callback must return a query builder.
 */
export interface JoinCallback<T extends PickQuerySelectableShapeRelationsWithDataAs, Arg extends JoinFirstArg<T>> {
    (q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>): IsQuery;
}
export type JoinCallbackArgs<T extends PickQuerySelectableShapeRelationsWithDataAs, Arg extends JoinFirstArg<T>> = [cb?: JoinCallback<T, Arg> | true];
/**
 * After getting a query from a sub-query callback,
 * join it to the main query in case it's a relation query.
 *
 * If it's not a relation query, it will be returned as is.
 *
 * @param q - main query object
 * @param sub - sub-query query object
 */
export declare const joinSubQuery: (q: ToSQLQuery, sub: ToSQLQuery) => SubQueryForSql;
export declare const _joinReturningArgs: <T extends PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, RequireJoined extends boolean>(query: T, require: RequireJoined, first: JoinFirstArg<never> | {
    _internalJoin: Query;
}, args: JoinArgs<Query, JoinFirstArg<Query>>, forbidLateral?: boolean) => JoinItemArgs | undefined;
/**
 * Generic function to construct all JOIN queries.
 * Add a shape of the joined table into `joinedShapes`.
 * Add column parsers of the joined table into `joinedParsers`.
 * Add join data into `join` of the query data.
 *
 * @param query - query object to join to
 * @param require - true for INNER kind of JOIN
 * @param type - SQL of the JOIN kind: JOIN, LEFT JOIN, RIGHT JOIN, etc.
 * @param first - the first argument of join: join target
 * @param args - rest join arguments: columns to join with, or a callback
 */
export declare const _join: (query: PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, require: boolean, type: string, first: JoinFirstArg<never> | {
    _internalJoin: Query;
}, args: JoinArgs<Query, JoinFirstArg<Query>>) => never;
export declare const _joinLateralProcessArg: (q: Query, arg: JoinFirstArg<any>, cb: (q: JoinQueryBuilder<PickQuerySelectableShape, PickQuerySelectableResultAs>) => {
    table: string;
    result: Column.QueryColumns;
}) => Query;
/**
 * Generic function to construct all JOIN LATERAL queries.
 * Adds a shape of the joined table into `joinedShapes`.
 * Adds column parsers of the joined table into `joinedParsers`.
 * Adds join data into `join` of the query data.
 *
 * @param self - query object to join to
 * @param type - SQL of the JOIN kind: JOIN or LEFT JOIN
 * @param joinQuery - join target: a query, or a relation name, or a `with` table name, or a callback returning a query.
 * @param as - alias of the joined table, it is set the join lateral happens when selecting a relation in `select`
 * @param innerJoinLateral - add `ON p.r IS NOT NULL` check to have INNER JOIN like experience when sub-selecting arrays.
 */
export declare const _joinLateral: (self: PickQueryResultRelationsWithDataReturnTypeShape, type: string, joinQuery: Query, as?: string, innerJoinLateral?: boolean) => string | undefined;
export declare class QueryJoin {
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
     * # join
     *
     * `join` methods allows to join other tables, relations by name, [with](/guide/advanced-queries#with) statements, sub queries.
     *
     * All the `join` methods accept the same arguments, but returning type is different because with `join` it's guaranteed to load joined table, and with `leftJoin` the joined table columns may be `NULL` when no matching record was found.
     *
     * For the following examples, imagine you have a `User` table with `id` and `name`, and `Message` table with `id`, `text`, messages belongs to user via `userId` column:
     *
     * ```ts
     * export const UserTable = defineTable('user', (t) => ({
     *   id: t.identity().primaryKey(),
     *   name: t.text(),
     * })).relations((user) => ({
     *   messages: user('id').hasMany(() => MessageTable('userId')),
     * }));
     *
     * export const MessageTable = defineTable('message', (t) => ({
     *   id: t.identity().primaryKey(),
     *   userId: t.integer(),
     *   text: t.text(),
     *   ...t.timestamps(),
     * })).relations((message) => ({
     *   user: message('userId').belongsTo(() => UserTable('id')),
     * }));
     * ```
     *
     * `join` is a method for SQL `JOIN`, which is equivalent to `INNER JOIN`, `LEFT INNERT JOIN`.
     *
     * When no matching record is found, it will skip records of the main table.
     *
     * ### join relation
     *
     * When relations are defined between the tables, you can join them by a relation name.
     * Joined table can be references from `where` and `select` by a relation name.
     *
     * ```ts
     * const result = await db.user
     *   .join('messages')
     *   // after joining a table, you can use it in `where` conditions:
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
     * The first argument can also be a callback, where instead of relation name as a string you're picking it as a property of `q`.
     * In such a way, you can alias the relation with `as`, add `where` conditions, use other query methods.
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
     *       .on('messages.text', 'user.name') // additionally, match message with user name
     *       .where({ text: 'some text' }), // you can add `where` in a second callback as well.
     * );
     * ```
     *
     * ### join a relation of the joined
     *
     * After joining a relation or a table:
     *
     * ```ts
     * db.post.join('comments');
     *
     * db.post.join(() => db.comment);
     * ```
     *
     * You can join a relation of that joined table:
     *
     * ```ts
     * db.post.join('comments').join('comments.author');
     *
     * db.post.join(() => db.comment).join('comment.author');
     * ```
     *
     * Note that in the first case it's `comments` - a relation name, while in the second case it is a table name.
     *
     * ### joins deduplication
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
     * ### select full joined records
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
     * db.user
     *   .join(db.message, 'userId', 'user.id')
     *   .where({ 'message.text': { startsWith: 'Hi' } })
     *   .select('name', 'message.text');
     * ```
     *
     * The name of the joining table can be omitted, but not the name of the main table:
     *
     * ```ts
     * db.user.join(db.message, 'userId', 'user.id');
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
     * db.user.join(db.message, 'userId', '!=', 'user.id');
     * ```
     *
     * Join can accept raw SQL for the `ON` part of join:
     *
     * ```ts
     * db.user.join(
     *   db.message,
     *   // `sql` can be imported from your table factory file
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
     *   'message.userId': 'user.id',
     *
     *   // joined table name may be omitted
     *   userId: 'user.id',
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
     *       .on('message.userId', 'user.id')
     *       // joined table name may be omitted
     *       .on('userId', 'user.id')
     *       // operator can be specified:
     *       .on('userId', '!=', 'user.id')
     *       // operator can be specified with table names as well:
     *       .on('message.userId', '!=', 'user.id')
     *       // `.orOn` takes the same arguments as `.on` and acts like `.or`:
     *       .on('userId', 'user.id') // where message.userId = user.id
     *       .orOn('text', 'user.name'), // or message.text = user.name
     * );
     * ```
     *
     * Column names in the where conditions are applied for the joined table, but you can specify a table name to add a condition for the main table.
     *
     * ```ts
     * db.user.join(db.message, (q) =>
     *   q
     *     .on('userId', 'user.id')
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
     *   'user.id',
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
    join<T extends PickQuerySelectableShapeRelationsWithDataAsResultReturnType, Arg extends JoinFirstArg<T>, Cb extends JoinCallbackArgs<T, Arg>>(this: T, arg: Arg, ...args: Cb | JoinArgs<T, Arg>): JoinResultFromArgs<T, Arg, Cb, true, true>;
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
     *   .leftJoin(db.message, 'userId', 'user.id')
     *   .select('name', 'message.text');
     *
     * // result has the following type:
     * const ok: { name: string; text: string | null }[] = result;
     * ```
     *
     * @param arg - {@link JoinFirstArg}
     * @param args - {@link JoinArgs}
     */
    leftJoin<T extends PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, Arg extends JoinFirstArg<T>, Cb extends JoinCallbackArgs<T, Arg>>(this: T, arg: Arg, ...args: Cb | JoinArgs<T, Arg>): JoinResultFromArgs<T, Arg, Cb, false, true>;
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
    rightJoin<T extends PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, Arg extends JoinFirstArg<T>, Cb extends JoinCallbackArgs<T, Arg>>(this: T, arg: Arg, ...args: Cb | JoinArgs<T, Arg>): JoinResultFromArgs<T, Arg, Cb, true, false>;
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
    fullJoin<T extends PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, Arg extends JoinFirstArg<T>, Cb extends JoinCallbackArgs<T, Arg>>(this: T, arg: Arg, ...args: Cb | JoinArgs<T, Arg>): JoinResultFromArgs<T, Arg, Cb, false, false>;
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
     * // joinLateral messages relation, alias it as `m`
     * // without aliasing you can refer to the message by a table name
     * db.user
     *   .joinLateral(db.message.as('m'), (q) =>
     *     q
     *       // select message columns
     *       .select('text')
     *       // join the message to the user, column names can be prefixed with table names
     *       .on('authorId', 'user.id')
     *       // message columns are available without prefixing,
     *       // outer table columns are available with a table name
     *       .where({ text: 'some text', 'user.name': 'name' })
     *       .order({ createdAt: 'DESC' }),
     *   )
     *   // only selected message columns are available in select and where
     *   .select('id', 'name', 'm.text')
     *   .where({ 'm.text': messageData.text });
     * ```
     *
     * As well as simple `join`, `joinLateral` can select an object of full joined record:
     *
     * ```ts
     * // join by relation name
     * const result = await db.user
     *   .joinLateral('messages', (q) => q.as('message')) // alias to 'message'
     *   .select('name', { message: 'message.*' });
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
     * const result = await db.user
     *   .joinLateral('messages', (q) => q.as('message')) // alias to 'message'
     *   .select('name', { msg: 'message.*' });
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
     * @param cb - callback for shaping the joined query
     */
    joinLateral<T extends PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, Arg extends JoinFirstArg<T>, As extends string, Result extends Column.QueryColumns, JoinedRelations extends RelationsBase>(this: T, arg: Arg, cb: (q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>) => {
        __as: As;
        result: Result;
        relations: JoinedRelations;
    }): JoinLateralResult<T, As, Result, JoinedRelations, true>;
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
     * @param cb - callback for shaping the joined query
     */
    leftJoinLateral<T extends PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs, Arg extends JoinFirstArg<T>, As extends string, Result extends Column.QueryColumns, JoinedRelations extends RelationsBase>(this: T, arg: Arg, cb: (q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>) => {
        __as: As;
        result: Result;
        relations: JoinedRelations;
    }): JoinLateralResult<T, As, Result, JoinedRelations, false>;
    /**
     * This method may be useful
     * for combining with [createForEachFrom](/guide/create-update-delete.html#createForEachFrom-insertForEachFrom).
     *
     * `createForEachFrom` creates multiple record based on a selecting query:
     *
     * ```sql
     * INSERT INTO t1(c1, c2)
     * SELECT c1, c2 FROM t2
     * ```
     *
     * Such a query inserts one record per one selected record.
     *
     * Use `joinData` to insert a multiplication of selected records and the provided data.
     *
     * ```ts
     * const data = [{ column2: 'one' }, { column2: 'two' }, { column2: 'three' }];
     *
     * await db.table.createForEachFrom(
     *   db.otherTable
     *     .joinData('data', (t) => ({ column2: t.text() }), data)
     *     .select('otherTable.column1', 'data.column2'),
     * );
     * ```
     *
     * If the query on the other table returns 2 records,
     * and the data array contains 3 records, then 2 \* 3 = 6 will be inserted - every combination.
     *
     * Joined data values are available in `where` just as usual.
     *
     * @param as - alias to reference joined columns
     * @param fn - declare column types
     * @param data - array of data to join
     */
    joinData<T extends PickQuerySelectableColumnTypes, As extends string, RecordType extends Column.QueryColumnsInit, Item extends ColumnsShape.Input<RecordType>>(this: T, as: As, fn: (types: T['columnTypes']) => RecordType, data: Item[]): {
        [K in keyof T]: K extends '__selectable' ? T['__selectable'] & {
            [K in keyof RecordType & string as `${As}.${K}`]: {
                as: K;
                column: RecordType[K];
            };
        } : T[K];
    };
}
type OnArgs<S extends QuerySelectable> = [leftColumn: keyof S, rightColumn: keyof S] | [leftColumn: keyof S, op: string, rightColumn: keyof S];
export declare const pushQueryOnForOuter: <T extends PickQuerySelectable>(q: T, joinFrom: PickQuerySelectable, joinTo: PickQuerySelectable, leftColumn: string, rightColumn: string) => T;
export declare const pushQueryOn: <T extends PickQuerySelectable>(q: T, joinFrom: PickQuerySelectable, joinTo: PickQuerySelectable, ...on: OnArgs<QuerySelectable>) => T;
export declare const pushQueryOrOn: <T extends PickQuerySelectable>(q: T, joinFrom: PickQuerySelectable, joinTo: PickQuerySelectable, ...on: OnArgs<QuerySelectable>) => never;
export declare const addQueryOn: <T extends PickQuerySelectable>(query: T, joinFrom: PickQuerySelectable, joinTo: PickQuerySelectable, ...args: OnArgs<QuerySelectable>) => T;
type OnJsonPathEqualsArgs<S extends QuerySelectable> = [
    leftColumn: keyof S,
    leftPath: string,
    rightColumn: keyof S,
    rightPath: string
];
/**
 * Mutative {@link OnMethods.prototype.on}
 */
export declare const _queryJoinOn: <T extends PickQuerySelectable>(q: T, args: OnArgs<T['__selectable']>) => T;
/**
 * Mutative {@link OnMethods.prototype.orOn}
 */
export declare const _queryJoinOrOn: <T extends PickQuerySelectable>(q: T, args: OnArgs<T['__selectable']>) => T;
/**
 * Mutative {@link OnMethods.prototype.onJsonPathEquals}
 */
export declare const _queryJoinOnJsonPathEquals: <T extends PickQuerySelectable>(q: T, args: OnJsonPathEqualsArgs<T['__selectable']>) => T;
/**
 * Argument of join callback.
 * It is a query object of table that you're joining, with ability to select main table's columns.
 * Adds {@link OnMethods.prototype.on} method and similar to the query.
 */
export type JoinQueryBuilder<T extends PickQuerySelectableShape, J extends PickQuerySelectableResultAs> = {
    [K in keyof J | keyof OnMethods]: K extends '__selectable' ? SelectableFromShape<J['result'], J['__as']> & Omit<T['__selectable'], keyof T['shape']> : K extends keyof OnMethods ? OnMethods[K] : K extends keyof J ? J[K] : never;
};
export declare class OnMethods {
    /**
     * Use `on` to specify columns to join records.
     *
     * ```ts
     * q
     *   .on('message.userId', 'user.id')
     *   // joined table name may be omitted
     *   .on('userId', 'user.id')
     *   // operator can be specified:
     *   .on('userId', '!=', 'user.id')
     *   // operator can be specified with table names as well:
     *   .on('message.userId', '!=', 'user.id')
     * ```
     *
     * @param args - columns to join with
     */
    on<T extends PickQuerySelectable>(this: T, ...args: OnArgs<T['__selectable']>): T;
    /**
     * Works as {@link on}, but the added conditions will be separated from previous with `OR`.
     *
     * @param args - columns to join with
     */
    orOn<T extends PickQuerySelectable>(this: T, ...args: OnArgs<T['__selectable']>): T;
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
    onJsonPathEquals<T extends PickQuerySelectable>(this: T, ...args: OnJsonPathEqualsArgs<T['__selectable']>): T;
}
export {};
