import { Query, SetQueryReturnsColumnOptional, QueryTakeOptional, SetQueryReturnsRowCount, SetQueryReturnsRowCountMany, QueryOrExpression, IsQuery, SetQueryReturnsOneResult, SetQueryReturnsColumnResult, SetQueryResult, SetQueryReturnsAll, SetValueQueryReturnsPluckColumn } from '../../query';
import { Column } from '../../../columns';
import { CreateFromMethodNames, CreateManyFromMethodNames } from './create-from';
import { PickQueryDefaults, PickQueryHasSelect, PickQueryInputType, PickQueryRelations, PickQueryResult, PickQueryReturnType, PickQueryRelationsDataForCreate, PickQueryRelationsDataForCreateOptional, PickQueryShape, PickQueryUniqueProperties, PickQueryWithData } from '../../pick-query-types';
import { EmptyObject, RecordUnknown } from '../../../utils';
import { RelationConfigDataForCreate } from '../../relations';
import { Expression } from '../../expressions/expression';
import { QueryData } from '../../query-data';
export interface CreateSelf extends PickQueryHasSelect, PickQueryDefaults, PickQueryResult, PickQueryRelations, PickQueryRelationsDataForCreate, PickQueryRelationsDataForCreateOptional, PickQueryWithData, PickQueryReturnType, PickQueryShape, PickQueryUniqueProperties, PickQueryInputType, Query.Pick.IsNotReadOnly {
}
export type CreateData<T extends CreateSelf> = EmptyObject extends T['relations'] ? CreateDataWithDefaults<T, keyof T['__defaults']> : CreateRelationsData<T>;
export type CreateDataOmit<T extends CreateSelf, OmitKeys> = EmptyObject extends T['relations'] ? CreateDataWithDefaultsOmit<T, keyof T['__defaults'], OmitKeys> : CreateRelationsDataOmit<T, OmitKeys>;
type CreateDataWithDefaults<T extends CreateSelf, Defaults extends PropertyKey> = {
    [K in keyof T['__inputType'] as K extends Defaults ? never : K]: K extends Defaults ? never : CreateColumn<T, K>;
} & {
    [K in Defaults]?: K extends keyof T['__inputType'] ? CreateColumn<T, K> : never;
};
type CreateDataWithDefaultsOmit<T extends CreateSelf, Defaults extends PropertyKey, OmitKeys> = {
    [K in keyof T['__inputType'] as K extends Defaults | OmitKeys ? never : K]: K extends Defaults ? never : CreateColumn<T, K>;
} & {
    [K in Defaults as K extends OmitKeys ? never : K]?: K extends keyof T['__inputType'] ? CreateColumn<T, K> : never;
};
type WritableForeignKeys<T extends CreateSelf, AllFKeys extends PropertyKey> = AllFKeys extends infer K ? K extends keyof T['shape'] ? T['shape'][K] extends {
    data: {
        makeColumnWritable: true;
    };
} ? K : never : never : never;
export type CreateColumn<T extends CreateSelf, K extends keyof T['__inputType']> = T['__inputType'][K] | ((q: T) => QueryOrExpression<T['__inputType'][K]>);
export type CreateRelationsData<T extends CreateSelf> = CreateDataWithDefaultsOmit<T, keyof T['__defaults'], Exclude<T['relations'][keyof T['relations']]['omitForeignKeyInCreate'], WritableForeignKeys<T, T['relations'][keyof T['relations']]['omitForeignKeyInCreate']>>> & CreateRelationsDataOmittingFKeys<T, T['relationsDataForCreate']> & T['relationsDataForCreateOptional'];
export type CreateRelationsDataOmit<T extends CreateSelf, OmitKeys> = CreateDataWithDefaultsOmit<T, keyof T['__defaults'], Exclude<T['relations'][keyof T['relations']]['omitForeignKeyInCreate'], WritableForeignKeys<T, T['relations'][keyof T['relations']]['omitForeignKeyInCreate']>> | OmitKeys> & CreateRelationsDataOmittingFKeys<T, T['relationsDataForCreate']> & T['relationsDataForCreateOptional'];
export type CreateRelationsDataOmittingFKeys<T extends CreateSelf, Data> = EmptyObject extends Data ? EmptyObject : {
    [K in keyof Data]: CreateRelationDataOmittingFKeys<T, Data[K]>;
}[keyof Data] extends (u: infer Obj) => void ? Obj : never;
type CreateRelationDataOmittingFKeys<T extends CreateSelf, Union> = (u: Union extends RelationConfigDataForCreate ? Union['columns'] extends keyof T['__defaults'] ? Pick<CreateDataWithDefaults<T, keyof T['__defaults']>, Union['columns']> & Partial<Union['nested']> : (Pick<{
    [P in keyof T['__inputType']]: CreateColumn<T, P>;
}, Union['columns'] & keyof T['__inputType']> & {
    [K in keyof Union['nested']]?: never;
}) | Union['nested'] : Union) => void;
export type CreateResult<T extends CreateSelf, Data> = T extends {
    isCount: true;
} ? T : T['returnType'] extends undefined | 'all' ? SetQueryReturnsOneResult<T, NarrowCreateResult<T, Data>> : T['returnType'] extends 'pluck' ? SetQueryReturnsColumnResult<T, NarrowCreateResult<T, Data>> : SetQueryResult<T, NarrowCreateResult<T, Data>>;
type InsertResult<T extends CreateSelf, Data> = T['__hasSelect'] extends true ? T['returnType'] extends undefined | 'all' ? SetQueryReturnsOneResult<T, NarrowCreateResult<T, Data>> : T['returnType'] extends 'pluck' ? SetQueryReturnsColumnResult<T, NarrowCreateResult<T, Data>> : SetQueryResult<T, NarrowCreateResult<T, Data>> : SetQueryReturnsRowCount<T>;
type CreateManyResult<T extends CreateSelf> = T extends {
    isCount: true;
} ? T : T['returnType'] extends 'one' | 'oneOrThrow' ? SetQueryReturnsAll<T> : T['returnType'] extends 'value' | 'valueOrThrow' ? SetValueQueryReturnsPluckColumn<T> : T;
type InsertManyResult<T extends CreateSelf> = T['__hasSelect'] extends true ? T['returnType'] extends 'one' | 'oneOrThrow' ? SetQueryReturnsAll<T> : T['returnType'] extends 'value' | 'valueOrThrow' ? SetValueQueryReturnsPluckColumn<T> : T : SetQueryReturnsRowCountMany<T>;
/**
 * When creating a record with a *belongs to* nested record,
 * un-nullify foreign key columns of the result.
 *
 * The same should work as well with any non-null columns passed to `create`, but it's to be implemented later.
 */
type NarrowCreateResult<T extends CreateSelf, Data> = EmptyObject extends T['relations'] ? T['result'] : {
    [K in keyof T['result']]: true extends {
        [R in keyof T['relations']]: K extends T['relations'][R]['omitForeignKeyInCreate'] ? R extends keyof Data ? true : T['relations'][R]['omitForeignKeyInCreate'] extends keyof Data ? null | undefined extends Data[T['relations'][R]['omitForeignKeyInCreate']] ? never : true : never : never;
    }[keyof T['relations']] ? Column.Pick.QueryColumnOfTypeAndOps<string, Exclude<T['result'][K]['__outputType'], null>, T['result'][K]['operators']> : T['result'][K];
};
type IgnoreResult<T extends CreateSelf> = T['returnType'] extends 'oneOrThrow' ? QueryTakeOptional<T> : T['returnType'] extends 'valueOrThrow' ? SetQueryReturnsColumnOptional<T, T['result']['value']> : T;
type OnConflictArg<T extends PickQueryUniqueProperties> = T['internal']['uniqueColumnNames'] | T['internal']['uniqueColumnTuples'] | Expression | {
    constraint: T['internal']['uniqueConstraints'];
};
export type AddQueryDefaults<T extends CreateSelf, DefaultKeys extends PropertyKey> = {
    [K in keyof T]: K extends '__defaults' ? {
        [K in keyof T['__defaults'] | DefaultKeys]: true;
    } : T[K];
};
/**
 * Used by ORM to access the context of current create query.
 * Is passed to the `create` method of a {@link VirtualColumn}
 */
export interface CreateCtx {
    columns: Map<string, number>;
    returnTypeAll?: true;
    resultAll: RecordUnknown[];
}
export declare const createSelect: (q: Query) => void;
export declare const throwOnReadOnly: (q: unknown, column: Column.Pick.Data, key: string) => void;
export declare const createCtx: () => CreateCtx;
/**
 * Processes arguments of `create`, `insert`, `createOneFrom` and `insertOneFrom` when it has data.
 * Apply defaults that may be present on a query object to the data.
 * Maps data object into array of values, encodes values when the column has an encoder.
 *
 * @param q - query object.
 * @param data - argument with data for create.
 * @param ctx - context of the create query.
 */
export declare const handleOneData: (q: CreateSelf, data: RecordUnknown, ctx: CreateCtx) => {
    columns: string[];
    values: unknown[][];
};
/**
 * Processes arguments of `createMany`, `insertMany`.
 * Apply defaults that may be present on a query object to the data.
 * Maps data objects into array of arrays of values, encodes values when the column has an encoder.
 *
 * @param q - query object.
 * @param data - arguments with data for create.
 * @param ctx - context of the create query.
 */
export declare const handleManyData: (q: CreateSelf, data: RecordUnknown[], ctx: CreateCtx) => {
    columns: string[];
    values: unknown[][];
};
/**
 * Core function that is used by all `create` and `insert` methods.
 * Sets query `type` to `insert` for `toSQL` to know it's for inserting.
 * Sets query columns and values.
 * Sets query kind, which is checked by `update` method when returning a query from callback.
 * Overrides query return type according to what is current create method supposed to return.
 *
 * @param self - query object.
 * @param columns - columns list of all values.
 * @param insertFrom - query of `createFrom` and alike
 * @param values - array of arrays matching columns
 * @param many - whether it's for creating one or many.
 * @param queryMany - whether is createForEachFrom
 */
export declare const insert: (self: CreateSelf, { columns, insertFrom, values, }: {
    insertFrom?: IsQuery;
    columns: string[];
    values: QueryData['values'];
}, many?: boolean, queryMany?: boolean) => CreateSelf;
export declare const _queryCreate: <T extends CreateSelf, Data extends CreateData<T>>(q: T, data: Data) => CreateResult<T, Data>;
export declare const _queryInsert: <T extends CreateSelf, Data extends CreateData<T>>(query: T, data: Data) => InsertResult<T, Data>;
export declare const _queryCreateMany: <T extends CreateSelf>(q: T, data: CreateData<T>[]) => CreateManyResult<T>;
export declare const _queryInsertMany: <T extends CreateSelf>(q: T, data: CreateData<T>[]) => InsertManyResult<T>;
export declare const _queryDefaults: <T extends CreateSelf, Data extends Partial<CreateData<T>>>(q: T, data: Data) => AddQueryDefaults<T, keyof Data>;
/**
 * Names of all create methods,
 * is used in relational query to remove these methods if chained relation shouldn't have them,
 * for the case of has one/many through.
 */
export type CreateMethodsNames = 'create' | 'insert' | 'createMany' | 'insertMany' | CreateFromMethodNames;
export type CreateManyMethodsNames = 'createMany' | 'insertMany' | CreateManyFromMethodNames;
type ExtraPropertiesAreNotAllowed<T extends CreateSelf, Data> = keyof Data extends keyof T['__inputType'] | keyof T['relations'] ? Data : `Extra properties are not allowed: ${Exclude<keyof Data, keyof T['__inputType'] | keyof T['relations']> & string}`;
export declare class QueryCreate {
    /**
     * `create` and `insert` create a single record.
     *
     * Use `select`, `selectAll`, `get`, or `pluck` alongside `create` or `insert` to
     * specify returning columns.
     *
     * Each column may accept a specific value, a raw SQL, or a query that returns a single value.
     *
     * ```ts
     * import { sql } from './baseTable';
     *
     * const oneRecord = await db.table.create({
     *   name: 'John',
     *   password: '1234',
     * });
     *
     * // When using `.onConflictDoNothing()`,
     * // the record may be not created and the `createdCount` will be 0.
     * const createdCount = await db.table.insert(data).onConflictDoNothing();
     *
     * await db.table.create({
     *   // raw SQL
     *   column1: () => sql`'John' || ' ' || 'Doe'`,
     *
     *   // query that returns a single value
     *   // returning multiple values will result in Postgres error
     *   column2: () => db.otherTable.get('someColumn'),
     *
     *   // nesting creates, updates, deletes produces a single SQL
     *   column4: () => db.otherTable.create(data).get('someColumn'),
     *   column5: (q) => q.relatedTable.find(id).update(data).get('someColumn'),
     * });
     * ```
     *
     * Creational methods can be used in {@link WithMethods.with} expressions:
     *
     * ```ts
     * db.$qb
     *   // create a record in one table
     *   .with('a', db.table.select('id').create(data))
     *   // create a record in other table using the first table record id
     *   .with('b', (q) =>
     *     db.otherTable.select('id').create({
     *       ...otherData,
     *       aId: () => q.from('a').get('id'),
     *     }),
     *   )
     *   .from('b');
     * ```
     */
    create<T extends CreateSelf, Data extends CreateData<T>>(this: T, data: ExtraPropertiesAreNotAllowed<T, Data>): CreateResult<T, Data>;
    /**
     * Works exactly as {@link create}, except that it returns inserted row count by default.
     */
    insert<T extends CreateSelf, Data extends CreateData<T>>(this: T, data: ExtraPropertiesAreNotAllowed<T, Data>): InsertResult<T, Data>;
    /**
     * `createMany` and `insertMany` will create a batch of records.
     *
     * Each column may be set with a specific value, a raw SQL, or a query, the same as in {@link create}.
     *
     * In case one of the objects has fewer fields, the `DEFAULT` SQL keyword will be placed in its place in the `VALUES` statement.
     *
     * ```ts
     * const manyRecords = await db.table.createMany([
     *   { key: 'value', otherKey: 'other value' },
     *   { key: 'value' }, // default will be used for `otherKey`
     * ]);
     *
     * // `createdCount` will be 3.
     * const createdCount = await db.table.insertMany([data, data, data]);
     * ```
     *
     * When nesting creates, a separate create query will be executed for every time it's used:
     *
     * ```ts
     * // will be performed twice, even though it is defined once
     * const nestedCreate = db.otherTable.create(data).get('column');
     *
     * await db.table.createMany([{ column: nestedCreate }, { column: nestedCreate }]);
     * ```
     *
     * Because of a limitation of Postgres protocol, queries having more than **65535** of values are going to fail in runtime.
     * To solve this seamlessly, `OrchidORM` will automatically batch such queries, and wrap them into a transaction, unless they are already in a transaction.
     *
     * ```ts
     * // OK: executes 2 inserts wrapped into a transaction
     * await db.table.createMany(
     *   Array.from({ length: 65536 }, () => ({ text: 'text' })),
     * );
     * ```
     *
     * However, this only works in the case shown above. This **won't** work if you're using the `createMany` in `with` statement,
     * or if the insert is used as a sub-query in other query part.
     *
     * @param data - array of records data, may have values, raw SQL, queries, relation operations
     */
    createMany<T extends CreateSelf>(this: T, data: CreateData<T>[]): CreateManyResult<T>;
    /**
     * Works exactly as {@link createMany}, except that it returns inserted row count by default.
     *
     * @param data - array of records data, may have values, raw SQL, queries, relation operations
     */
    insertMany<T extends CreateSelf>(this: T, data: CreateData<T>[]): InsertManyResult<T>;
    /**
     * `defaults` allows setting values that will be used later in `create`.
     *
     * Columns provided in `defaults` are marked as optional in the following `create`.
     *
     * Default data is the same as in {@link create} and {@link createMany},
     * so you can provide a raw SQL, or a query with a query.
     *
     * ```ts
     * // Will use firstName from defaults and lastName from create argument:
     * db.table
     *   .defaults({
     *     firstName: 'first name',
     *     lastName: 'last name',
     *   })
     *   .create({
     *     lastName: 'override the last name',
     *   });
     * ```
     *
     * @param data - default values for `create` and `createMany` which will follow `defaults`
     */
    defaults<T extends CreateSelf, Data extends Partial<CreateData<T>>>(this: T, data: Data): AddQueryDefaults<T, keyof Data>;
    /**
     * By default, violating unique constraint will cause the creative query to throw,
     * you can define what to do on a conflict: to ignore it, or to merge the existing record with a new data.
     *
     * A conflict occurs when a table has a primary key or a unique index on a column,
     * or a composite primary key unique index on a set of columns,
     * and a row being created has the same value as a row that already exists in the table in this column(s).
     *
     * Use {@link onConflictDoNothing} to suppress the error and continue without updating the record,
     * or the `merge` to update the record with new values automatically,
     * or the `set` to specify own values for the update.
     *
     * `onConflict` only accepts column names that are defined in `primaryKey` or `unique` in the table definition.
     * To specify a constraint, its name also must be explicitly set in `primaryKey` or `unique` in the table code.
     *
     * Postgres has a limitation that a single `INSERT` query can have only a single `ON CONFLICT` clause that can target only a single unique constraint
     * for updating the record.
     *
     * If your table has multiple potential reasons for unique constraint violation, such as username and email columns in a user table,
     * consider using `upsert` instead.
     *
     * ```ts
     * // leave `onConflict` without argument to ignore or merge on any conflict
     * db.table.create(data).onConflictDoNothing();
     *
     * // single column:
     * // (this requires a composite primary key or unique index, see below)
     * db.table.create(data).onConflict('email').merge();
     *
     * // array of columns:
     * db.table.create(data).onConflict(['email', 'name']).merge();
     *
     * // constraint name
     * db.table.create(data).onConflict({ constraint: 'unique_index_name' }).merge();
     *
     * // raw SQL expression:
     * db.table
     *   .create(data)
     *   .onConflict(sql`(email) where condition`)
     *   .merge();
     * ```
     *
     * :::info
     * A primary key or a unique index for a **single** column can be fined on a column:
     *
     * ```ts
     * export const MyTable = defineTable('myTable', (t) => ({
     *   pkey: t.uuid().primaryKey(),
     *   unique: t.string().unique(),
     * }));
     * ```
     *
     * But for composite primary keys or indexes (having multiple columns), define it in a separate function:
     *
     * ```ts
     * export const MyTable = defineTable('myTable', (t) => ({
     *   one: t.integer(),
     *   two: t.string(),
     *   three: t.boolean(),
     * }))
     *   .primaryKey(['one', 'two'])
     *   .unique(['two', 'three']);
     * ```
     * :::
     *
     * You can use the `sql` function exported from your table factory file in onConflict.
     * It can be useful to specify a condition when you have a partial index:
     *
     * ```ts
     * db.table
     *   .create({
     *     email: 'ignore@example.com',
     *     name: 'John Doe',
     *     active: true,
     *   })
     *   // ignore only when having conflicting email and when active is true.
     *   .onConflict(sql`(email) where active`)
     *   .ignore();
     * ```
     *
     * For `merge` and `set`, you can append `where` to update data only for the matching rows:
     *
     * ```ts
     * const timestamp = Date.now();
     *
     * db.table
     *   .create(data)
     *   .onConflict('email')
     *   .set({
     *     name: 'John Doe',
     *     updatedAt: timestamp,
     *   })
     *   .where({ updatedAt: { lt: timestamp } });
     * ```
     *
     * @param arg - optionally provide an array of columns
     */
    onConflict<T extends CreateSelf, Arg extends OnConflictArg<T>>(this: T, arg: Arg): OnConflictQueryBuilder<T, Arg>;
    /**
     * Use `onConflictDoNothing` to suppress unique constraint violation error when creating a record.
     *
     * Adds `ON CONFLICT (columns) DO NOTHING` clause to the insert statement, columns are optional.
     *
     * Can also accept a constraint name.
     *
     * ```ts
     * db.table
     *   .create({
     *     email: 'ignore@example.com',
     *     name: 'John Doe',
     *   })
     *   // on any conflict:
     *   .onConflictDoNothing()
     *   // or, for a specific column:
     *   .onConflictDoNothing('email')
     *   // or, for a specific constraint:
     *   .onConflictDoNothing({ constraint: 'unique_index_name' });
     * ```
     *
     * When there is a conflict, nothing can be returned from the database, so `onConflictDoNothing` adds `| undefined` part to the response type.
     *
     * ```ts
     * const maybeRecord: RecordType | undefined = await db.table
     *   .create(data)
     *   .onConflictDoNothing();
     *
     * const maybeId: number | undefined = await db.table
     *   .get('id')
     *   .create(data)
     *   .onConflictDoNothing();
     * ```
     *
     * When creating multiple records, only created records will be returned. If no records were created, array will be empty:
     *
     * ```ts
     * // array can be empty
     * const arr = await db.table.createMany([data, data, data]).onConflictDoNothing();
     * ```
     */
    onConflictDoNothing<T extends CreateSelf, Arg extends OnConflictArg<T>>(this: T, arg?: Arg): IgnoreResult<T>;
}
type OnConflictSet<T extends CreateSelf> = {
    [K in keyof T['__inputType']]?: T['__inputType'][K] | (() => QueryOrExpression<T['__inputType'][K]>);
};
export declare class OnConflictQueryBuilder<T extends CreateSelf, Arg extends OnConflictArg<T> | undefined> {
    private query;
    private onConflict;
    constructor(query: T, onConflict: Arg);
    /**
     * Available only after `onConflict`.
     *
     * Updates the record with a given data when conflict occurs.
     *
     * ```ts
     * db.table
     *   .create(data)
     *   .onConflict('email')
     *   .set({
     *     // supports plain values and SQL expressions
     *     key: 'value',
     *     fromSql: () => sql`custom sql`,
     *   })
     *   // to update records only on certain conditions
     *   .where({ ...certainConditions });
     * ```
     *
     * @param set - object containing new column values
     */
    set(set: OnConflictSet<T>): T;
    /**
     * Available only after `onConflict`.
     *
     * Use this method to merge all the data you have passed into `create` to update the existing record on conflict.
     *
     * If the table has columns with **dynamic** default values, such values will be applied as well.
     *
     * You can exclude certain columns from being merged by passing the `except` option.
     *
     * ```ts
     * // merge the full data
     * db.table.create(data).onConflict('email').merge();
     *
     * // merge only a single column
     * db.table.create(data).onConflict('email').merge('name');
     *
     * // merge multiple columns
     * db.table.create(data).onConflict('email').merge(['name', 'quantity']);
     *
     * // merge all columns except some
     * db.table
     *   .create(data)
     *   .onConflict('email')
     *   .merge({ except: ['name', 'quantity'] });
     *
     * // merge can be applied also for batch creates
     * db.table.createMany([data1, data2, data2]).onConflict('email').merge();
     *
     * // update records only on certain conditions
     * db.table
     *   .create(data)
     *   .onConflict('email')
     *   .merge()
     *   .where({ ...certainConditions });
     * ```
     *
     * @param merge - no argument will merge all data, or provide a column(s) to merge, or provide `except` to update all except some.
     */
    merge(merge?: keyof T['shape'] | (keyof T['shape'])[] | {
        except: keyof T['shape'] | (keyof T['shape'])[];
    }): T;
}
export {};
