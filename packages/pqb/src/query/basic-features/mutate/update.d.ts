import { Query, QueryOrExpression, SetQueryReturnsAllResult, SetQueryReturnsPluckColumnResult, SetQueryReturnsRowCount, SetQueryReturnsRowCountMany, SetQueryResult } from '../../query';
import { QueryHasWhere } from '../where/where';
import { Column } from '../../../columns';
import { JoinArgs, JoinCallbackArgs, JoinFirstArg, JoinResultFromArgs } from '../join/join';
import { PickQueryAs, PickQueryHasSelect, PickQueryHasWhere, PickQueryInputType, PickQueryRelations, PickQueryResult, PickQueryReturnType, PickQuerySelectable, PickQueryShape, PickQueryWithData } from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
export interface UpdateSelf extends PickQuerySelectable, PickQueryResult, PickQueryRelations, PickQueryWithData, PickQueryReturnType, PickQueryShape, PickQueryInputType, PickQueryAs, PickQueryHasSelect, PickQueryHasWhere, Query.Pick.IsNotReadOnly {
}
export type UpdateData<T extends UpdateSelf> = {
    [K in keyof T['__inputType'] | keyof T['relations']]?: K extends keyof T['__inputType'] ? T['__inputType'][K] | ((q: {
        [K in keyof T['relations'] | keyof T]: K extends keyof T['relations'] ? T['relations'][K]['query'] : K extends keyof T ? T[K] : never;
    }) => QueryOrExpression<T['__inputType'][K]>) : T['returnType'] extends undefined | 'all' ? T['relations'][K]['dataForUpdate'] : T['relations'][K]['dataForUpdateOne'];
};
export type UpdateArg<T extends UpdateSelf> = T['__hasWhere'] extends true ? UpdateData<T> : 'Update statement must have where conditions. To update all prefix `update` with `all()`';
type UpdateResult<T extends UpdateSelf> = T['__hasSelect'] extends true ? T : T['returnType'] extends undefined | 'all' ? SetQueryReturnsRowCountMany<T> : SetQueryReturnsRowCount<T>;
export type NumericColumns<T extends UpdateSelf> = {
    [K in keyof T['__inputType']]: Exclude<T['shape'][K]['__queryType'], string> extends number | bigint | null ? K : never;
}[keyof T['__inputType']];
export type ChangeCountArg<T extends UpdateSelf> = NumericColumns<T> | {
    [K in NumericColumns<T>]?: T['shape'][K]['__type'] extends number | null ? number : number | string | bigint;
};
interface UpdateManyBySelf extends UpdateSelf {
    internal: {
        uniqueColumns: unknown;
        uniqueColumnNames: unknown;
        uniqueColumnTuples: unknown;
        uniqueConstraints: unknown;
    };
}
type UpdateManyData<T extends UpdateSelf> = ({
    [K in keyof T['shape'] as T['shape'][K] extends Column.IsPrimaryKey<string> ? K : never]: T['shape'][K]['__queryType'] | Expression;
} & {
    [P in keyof T['__inputType']]?: T['__inputType'][P] | Expression;
})[];
type UpdateManyByKeys<T extends UpdateManyBySelf> = T['internal']['uniqueColumnNames'] | T['internal']['uniqueColumnTuples'];
type UpdateManyByKeyColumns<K> = K extends string[] ? K[number] : K;
type UpdateManyByData<T extends UpdateSelf, K> = ({
    [P in K & keyof T['__inputType']]: T['__inputType'][P];
} & {
    [P in keyof T['__inputType']]?: P extends K ? T['__inputType'][P] : T['__inputType'][P] | Expression;
})[];
type UpdateManyResult<T extends UpdateSelf> = T['__hasSelect'] extends true ? T['returnType'] extends 'one' | 'oneOrThrow' ? SetQueryReturnsAllResult<T, T['result']> : T['returnType'] extends 'value' | 'valueOrThrow' ? SetQueryReturnsPluckColumnResult<T, T['result']> : SetQueryResult<T, T['result']> : SetQueryReturnsRowCountMany<T>;
export declare const _queryChangeCounter: <T extends UpdateSelf>(self: T, op: string, data: ChangeCountArg<T>) => never;
export declare const _queryUpdate: <T extends UpdateSelf>(updateSelf: T, arg: UpdateArg<T>) => UpdateResult<T>;
export declare const _queryUpdateOrThrow: <T extends UpdateSelf>(q: T, arg: UpdateArg<T>) => UpdateResult<T>;
export declare class QueryUpdate {
    /**
     * `update` takes an object with columns and values to update records.
     *
     * By default, `update` will return a count of updated records.
     *
     * Use `select`, `selectAll`, `get`, or `pluck` alongside `update` to specify
     * returning columns.
     *
     * You need to provide `where`, `findBy`, or `find` conditions before calling `update`.
     * To ensure that the whole table won't be updated by accident, updating without where conditions will result in TypeScript and runtime errors.
     *
     * Use `all()` to update ALL records without conditions:
     *
     * ```ts
     * await db.table.all().update({ name: 'new name' });
     * ```
     *
     * If `select` and `where` were specified before the update it will return an array of updated records.
     *
     * If `select` and `take`, `find`, or similar were specified before the update it will return one updated record.
     *
     * For a column value you can provide a specific value, raw SQL, a query object that returns a single value, or a callback with a sub-query.
     *
     * The callback is allowed to select a single value from a relation (see `fromRelation` column below),
     * or to use a [jsonSet](/guide/advanced-queries.html#jsonset),
     * [jsonInsert](/guide/advanced-queries.html#jsoninsert),
     * and [jsonRemove](/guide/advanced-queries.html#jsonremove) for a JSON column (see `jsonColumn` below).
     *
     * ```ts
     * import { sql } from './baseTable';
     *
     * // returns number of updated records by default
     * const updatedCount = await db.table
     *   .where({ name: 'old name' })
     *   .update({ name: 'new name' });
     *
     * // returning only `id`
     * const id = await db.table.find(1).get('id').update({ name: 'new name' });
     *
     * // `selectAll` + `find` will return a full record
     * const oneFullRecord = await db.table
     *   .selectAll()
     *   .find(1)
     *   .update({ name: 'new name' });
     *
     * // `selectAll` + `where` will return array of full records
     * const recordsArray = await db.table
     *   .select('id', 'name')
     *   .where({ id: 1 })
     *   .update({ name: 'new name' });
     *
     * await db.table.where({ ...conditions }).update({
     *   // set the column to a specific value
     *   value: 123,
     *
     *   // use custom SQL to update the column
     *   fromSql: () => sql`2 + 2`,
     *
     *   // use query that returns a single value
     *   // returning multiple values will result in Postgres error
     *   fromQuery: () => db.otherTable.get('someColumn'),
     *
     *   // select a single value from a related record
     *   fromRelation: (q) => q.relatedTable.get('someColumn'),
     *
     *   // set a new value to the `.foo.bar` path into a JSON column
     *   jsonColumn: (q) => q.jsonSet('jsonColumn', ['foo', 'bar'], 'new value'),
     * });
     * ```
     *
     * `update` can be used in [with](/guide/advanced-queries#with) expressions:
     *
     * ```ts
     * db.$qb
     *   // update record in one table
     *   .with('a', db.table.find(1).select('id').update(data))
     *   // update record in other table using the first table record id
     *   .with('b', (q) =>
     *     db.otherTable
     *       .find(1)
     *       .select('id')
     *       .update({
     *         ...otherData,
     *         aId: () => q.from('a').get('id'),
     *       }),
     *   )
     *   .from('b');
     *
     * `update` can be used in {@link WithMethods.with} expressions:
     *
     * ```ts
     * db.$qb
     *   // update record in one table
     *   .with('a', db.table.find(1).select('id').update(data))
     *   // update record in other table using the first table record id
     *   .with('b', (q) =>
     *     db.otherTable
     *       .find(1)
     *       .select('id')
     *       .update({
     *         ...otherData,
     *         aId: () => q.from('a').get('id'),
     *       }),
     *   )
     *   .from('b');
     * ```
     *
     * ### sub-queries
     *
     * In all `create`, `update`, `upsert` methods,
     * you can use sub queries that are either selecting a single value,
     * or creating/updating/deleting a record and return a single value.
     *
     * ```ts
     * await db.table.where({ ...conditions }).update({
     *   // `column` will be set to a value of the `otherColumn` of the created record.
     *   column: () => db.otherTable.get('otherColumn').create({ ...data }),
     *
     *   // `column2` will be set to a value of the `otherColumn` of the updated record.
     *   column2: () =>
     *     db.otherTable
     *       .get('otherColumn')
     *       .findBy({ ...conditions })
     *       .update({ key: 'value' }),
     *
     *   // `column3` will be set to a value of the `otherColumn` of the deleted record.
     *   column3: () =>
     *     db.otherTable
     *       .get('otherColumn')
     *       .findBy({ ...conditions })
     *       .delete(),
     * });
     * ```
     *
     * This is achieved by defining a `WITH` clause under the hood, it produces such a query:
     *
     * ```sql
     * WITH q AS (
     *   INSERT INTO "otherTable"(col1, col2, col3)
     *   VALUES ('val1', 'val2', 'val3')
     *   RETURNING "otherTable"."selectedColumn"
     * )
     * -- In a case of create
     * INSERT INTO "table"("column") VALUES ((SELECT * FROM "q"))
     * -- In a case of update
     * UPDATE "table"
     * SET "column" = (SELECT * FROM "q")
     * ```
     *
     * The query is atomic.
     * No changes will persist in the database if the sub-query fails, or if the top-level query fails, or if multiple rows are returned from a sub-query.
     *
     * [//]: # 'not supported in create because cannot query related records for a thing that is not created yet'
     * [//]: # 'modificational sub queries are not allowed in update because it would be too hard to join a with statement to the update query'
     *
     * Only selective sub-queries are supported in `update` queries when the sub-query is using a relation:
     *
     * ```ts
     * db.book.update({
     *   authorName: (q) => q.author.get('name'),
     * });
     * ```
     *
     * ### null, undefined, unknown columns
     *
     * - `null` value will set a column to `NULL`
     * - `undefined` value will be ignored
     * - unknown columns will be ignored
     *
     * ```ts
     * db.table.findBy({ id: 1 }).update({
     *   name: null, // updates to null
     *   age: undefined, // skipped, no effect
     *   lalala: 123, // skipped
     * });
     * ```
     *
     * ### empty set
     *
     * When trying to query update with an empty object, it will be transformed seamlessly to a `SELECT` query:
     *
     * ```ts
     * // imagine the data is an empty object
     * const data = req.body;
     *
     * // query is transformed to `SELECT count(*) WHERE key = 'value'`
     * const count = await db.table.where({ key: 'value' }).update(data);
     *
     * // will select a full record by id
     * const record = await db.table.find(1).selectAll().update(data);
     *
     * // will select a single column by id
     * const name = await db.table.find(1).get('name').update(data);
     * ```
     *
     * If the table has `updatedAt` [timestamp](/guide/common-column-methods.html#timestamps), it will be updated even for an empty data.
     *
     * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
     */
    update<T extends UpdateSelf>(this: T, arg: UpdateArg<T>): UpdateResult<T>;
    /**
     * To make sure that at least one row was updated use `updateOrThrow`:
     *
     * ```ts
     * import { NotFoundError } from 'orchid-orm';
     *
     * try {
     *   // updatedCount is guaranteed to be greater than 0
     *   const updatedCount = await db.table
     *     .where(conditions)
     *     .updateOrThrow({ name: 'name' });
     *
     *   // updatedRecords is guaranteed to be a non-empty array
     *   const updatedRecords = await db.table
     *     .where(conditions)
     *     .select('id')
     *     .updateOrThrow({ name: 'name' });
     * } catch (err) {
     *   if (err instanceof NotFoundError) {
     *     // handle error
     *   }
     * }
     * ```
     *
     * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
     */
    updateOrThrow<T extends UpdateSelf>(this: T, arg: UpdateArg<T>): UpdateResult<T>;
    /**
     * Use `updateFrom` to update records in one table based on a query result from another table or CTE.
     *
     * `updateFrom` accepts the same arguments as {@link Query.join}.
     *
     * ```ts
     * // save all author names to their books by using a relation name:
     * db.books.updateFrom('author').set({ authorName: (q) => q.ref('author.name') });
     *
     * // update from authors that match the condition:
     * db.books
     *   .updateFrom((q) => q.author.where({ writingSkills: 'good' }))
     *   .set({ authorName: (q) => q.ref('author.name') });
     *
     * // update from any table using custom `on` conditions:
     * db.books
     *   .updateFrom(
     *     () => db.authors,
     *     (q) => q.on('authors.id', 'books.authorId'),
     *   )
     *   .set({ authorName: (q) => q.ref('author.name') });
     *
     * // conditions after `updateFrom` can reference both tables:
     * db.books
     *   .updateFrom(() => db.authors)
     *   .where({
     *     'authors.id': (q) => q.ref('books.authorId'),
     *   })
     *   .set({ authorName: (q) => q.ref('author.name') });
     *
     * // can join and use another table in between `updateFrom` and `set`:
     * db.books
     *   .updateFrom('author')
     *   .join('publisher')
     *   .set({
     *     authorName: (q) => q.ref('author.name'),
     *     publisherName: (q) => q.ref('publisher.name'),
     *   });
     *
     * // updating from a CTE
     * db.books
     *   .with('a', () =>
     *     db.authors.where({ writingSkills: 'good' }).select('id', 'name').limit(10),
     *   )
     *   .updateFrom('a', (q) => q.on('a.id', 'books.authorId'))
     *   .set({ authorName: (q) => q.ref('author.name') });
     * ```
     */
    updateFrom<T extends UpdateSelf, Arg extends JoinFirstArg<T>, Cb extends JoinCallbackArgs<T, Arg>>(this: T, arg: Arg, ...args: Cb | JoinArgs<T, Arg>): JoinResultFromArgs<T, Arg, Cb, true, true> & QueryHasWhere;
    /**
     * Use after {@link updateFrom}
     */
    set<T extends UpdateSelf>(this: T, arg: UpdateArg<T>): UpdateResult<T>;
    /**
     * Increments a column by `1`, returns a count of updated records by default.
     *
     * ```ts
     * const updatedCount = await db.table
     *   .where(...conditions)
     *   .increment('numericColumn');
     * ```
     *
     * When using `find` or `get` it will throw `NotFoundError` when no records found.
     *
     * ```ts
     * // throws when not found
     * const updatedCount = await db.table.find(1).increment('numericColumn');
     *
     * // also throws when not found
     * const updatedCount2 = await db.table
     *   .where(...conditions)
     *   .get('columnName')
     *   .increment('numericColumn');
     * ```
     *
     * Provide an object to increment multiple columns with different values.
     * Use `select` to specify columns to return.
     *
     * ```ts
     * // increment someColumn by 5 and otherColumn by 10, return updated records
     * const result = await db.table
     *   .selectAll()
     *   .where(...conditions)
     *   .increment({
     *     someColumn: 5,
     *     otherColumn: 10,
     *   });
     * ```
     *
     * @param data - name of the column to increment, or an object with columns and values to add
     */
    increment<T extends UpdateSelf>(this: T, data: ChangeCountArg<T>): UpdateResult<T>;
    /**
     * Decrements a column by `1`, returns a count of updated records by default.
     *
     * ```ts
     * const updatedCount = await db.table
     *   .where(...conditions)
     *   .decrement('numericColumn');
     * ```
     *
     * When using `find` or `get` it will throw `NotFoundError` when no records found.
     *
     * ```ts
     * // throws when not found
     * const updatedCount = await db.table.find(1).decrement('numericColumn');
     *
     * // also throws when not found
     * const updatedCount2 = await db.table
     *   .where(...conditions)
     *   .get('columnName')
     *   .decrement('numericColumn');
     * ```
     *
     * Provide an object to decrement multiple columns with different values.
     * Use `select` to specify columns to return.
     *
     * ```ts
     * // decrement someColumn by 5 and otherColumn by 10, return updated records
     * const result = await db.table
     *   .selectAll()
     *   .where(...conditions)
     *   .decrement({
     *     someColumn: 5,
     *     otherColumn: 10,
     *   });
     * ```
     *
     * @param data - name of the column to decrement, or an object with columns and values to subtract
     */
    decrement<T extends UpdateSelf>(this: T, data: ChangeCountArg<T>): UpdateResult<T>;
    /**
     * Updates multiple records with different per-row data in a single query.
     *
     * Each row must include the primary key and the columns to update.
     * All rows must have the same set of non-key columns.
     *
     * Returns a count of updated records by default.
     * Use `select`, `selectAll`, `get`, or `pluck` alongside `updateMany` to return
     * updated records.
     *
     * Throws {@link NotFoundError} if any record is not found.
     * Use {@link updateManyOptional} to skip missing records without throwing.
     *
     * ```ts
     * // returns count of updated records
     * const count = await db.table.updateMany([
     *   { id: 1, name: 'Alice', age: 30 },
     *   { id: 2, name: 'Bob', age: 25 },
     * ]);
     *
     * // returns array of updated records
     * const records = await db.table.select('id', 'name').updateMany([
     *   { id: 1, name: 'Alice' },
     *   { id: 2, name: 'Bob' },
     * ]);
     * ```
     *
     * `.set()` applies shared values to all rows.
     * `.set()` values take precedence over per-row values for the same column.
     *
     * ```ts
     * await db.table
     *   .updateMany([
     *     { id: 1, name: 'Alice' },
     *     { id: 2, name: 'Bob' },
     *   ])
     *   .set({ updatedBy: currentUser.id });
     * ```
     */
    updateMany<T extends UpdateSelf>(this: T, data: UpdateManyData<T>): UpdateManyResult<T> & QueryHasWhere;
    /**
     * Same as {@link updateMany}, but skips missing records rather than throwing.
     *
     * ```ts
     * // updates what it can, doesn't throw for missing id: 999
     * const count = await db.table.updateManyOptional([
     *   { id: 1, name: 'Alice' },
     *   { id: 999, name: 'Ghost' },
     * ]);
     * ```
     */
    updateManyOptional<T extends UpdateSelf>(this: T, data: UpdateManyData<T>): UpdateManyResult<T> & QueryHasWhere;
    /**
     * Like {@link updateMany}, but matches rows by a unique column or a compound unique constraint instead of the primary key.
     *
     * Throws {@link NotFoundError} if any record is not found.
     * Use {@link updateManyByOptional} to skip records with no matching key without throwing.
     *
     * ```ts
     * // single unique column
     * await db.table.updateManyBy('email', [
     *   { email: 'alice@test.com', name: 'Alice' },
     *   { email: 'bob@test.com', name: 'Bob' },
     * ]);
     *
     * // compound unique constraint
     * await db.table.updateManyBy(['firstName', 'lastName'], [
     *   { firstName: 'John', lastName: 'Doe', bio: 'updated' },
     * ]);
     * ```
     */
    updateManyBy<T extends UpdateManyBySelf, Keys extends UpdateManyByKeys<T>, K = UpdateManyByKeyColumns<Keys>>(this: T, keys: Keys, data: UpdateManyByData<T, K>): UpdateManyResult<T> & QueryHasWhere;
    /**
     * Same as {@link updateManyBy}, but skips records with no matching key rather than throwing.
     *
     * ```ts
     * await db.table.updateManyByOptional('email', [
     *   { email: 'alice@test.com', name: 'Alice' },
     *   { email: 'unknown@test.com', name: 'Ghost' },
     * ]);
     * ```
     */
    updateManyByOptional<T extends UpdateManyBySelf, Keys extends UpdateManyByKeys<T>, K = UpdateManyByKeyColumns<Keys>>(this: T, keys: Keys, data: UpdateManyByData<T, K>): UpdateManyResult<T> & QueryHasWhere;
}
export {};
