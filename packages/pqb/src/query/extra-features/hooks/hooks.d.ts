import { IsQuery, Query, QueryOrExpression, QueryReturnType } from '../../query';
import { AfterCommitErrorHandler } from '../../basic-features/transaction/transaction';
import { Column } from '../../../columns';
import { PickQueryInputType, PickQueryShape } from '../../pick-query-types';
import { RecordString } from '../../../utils';
import { QueryBatchResult } from '../../basic-features/select/select.utils';
import { QueryAfterHook, QueryBeforeActionHook, QueryBeforeHook } from '../../query-data';
export type AfterHook<Select extends PropertyKey[], Shape extends Column.QueryColumns> = QueryAfterHook<{
    [K in Select[number]]: K extends keyof Shape ? Shape[K]['__outputType'] : never;
}[]>;
export type HookSelectArg<T extends PickQueryShape> = (keyof T['shape'] & string)[];
export type HookAction = 'Create' | 'Update' | 'Save' | 'Delete';
export declare const _queryHookBeforeQuery: <T extends PickQueryShape>(q: T, cb: QueryBeforeHook) => T;
export declare const _queryHookAfterQuery: <T extends PickQueryShape>(q: T, cb: QueryAfterHook) => T;
export declare const _hookSelectColumns: (query: Query, columns: string[], asFn: (as: string[]) => void) => void;
export declare class QueryHookUtils<T extends PickQueryInputType> {
    query: IsQuery;
    columns: string[];
    private key;
    constructor(query: IsQuery, columns: string[], key: 'hookCreateSet' | 'hookUpdateSet');
    set: (data: { [K in keyof T['__inputType']]?: T['__inputType'][K] | (() => QueryOrExpression<T['__inputType'][K]>); }) => void;
}
export declare const finalizeNestedHookSelect: (batches: QueryBatchResult[], returnType: QueryReturnType, tempColumns: Set<string> | undefined, renames: RecordString | undefined, key: string) => void;
export declare const _queryHookBeforeCreate: <T extends PickQueryShape>(q: T, cb: QueryBeforeActionHook) => T;
export declare const _queryHookAfterCreate: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, Column.QueryColumns>) => PickQueryShape;
export declare const _queryHookAfterCreateCommit: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, PickQueryShape['shape']>) => PickQueryShape;
export declare const _queryHookBeforeUpdate: <T extends PickQueryShape>(q: T, cb: QueryBeforeActionHook) => T;
export declare const _queryHookAfterUpdate: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, PickQueryShape['shape']>) => PickQueryShape;
export declare const _queryHookAfterUpdateCommit: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, PickQueryShape['shape']>) => PickQueryShape;
export declare const _queryHookBeforeSave: (q: PickQueryShape, cb: QueryBeforeActionHook) => PickQueryShape;
export declare const _queryHookAfterSave: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, PickQueryShape['shape']>) => PickQueryShape;
export declare const _queryAfterSaveCommit: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, PickQueryShape['shape']>) => PickQueryShape;
export declare const _queryHookBeforeDelete: (q: PickQueryShape, cb: QueryBeforeHook) => PickQueryShape;
export declare const _queryHookAfterDelete: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, PickQueryShape['shape']>) => PickQueryShape;
export declare const _queryHookAfterDeleteCommit: (q: PickQueryShape, select: HookSelectArg<PickQueryShape>, cb: AfterHook<HookSelectArg<PickQueryShape>, PickQueryShape['shape']>) => PickQueryShape;
export declare abstract class QueryHooks {
    /**
     * Run the function before any kind of query.
     *
     * @param cb - function to call, first argument is a query object
     */
    beforeQuery<T>(this: T, cb: QueryBeforeHook): T;
    /**
     * Run the function after any kind of query.
     * Enforces wrapping the query into a transaction.
     * The function will run after the query is succeeded, but before the transaction commit.
     *
     * @param cb - function to call, first argument is the query result of type `unknown`, second argument is a query object
     */
    afterQuery<T>(this: T, cb: QueryAfterHook): T;
    /**
     * Run the function before a `create` kind of query.
     *
     * @param cb - function to call, first argument is a query object
     */
    beforeCreate<T>(this: T, cb: QueryBeforeActionHook): T;
    /**
     * Run the function after a `create` kind of query.
     * Enforces wrapping the query into a transaction.
     * The function will run after the query is succeeded, but before the transaction commit.
     * Queries inside the function will run in the same transaction as the target query.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterCreate<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Run the function after transaction for a `create` kind of query will be committed.
     * If the query wasn't wrapped in a transaction, will run after the query.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterCreateCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Run the function before an `update` kind of query.
     *
     * @param cb - function to call, first argument is a query object
     */
    beforeUpdate<T>(this: T, cb: QueryBeforeActionHook): T;
    /**
     * Run the function after an `update` kind of query.
     * Enforces wrapping the query into a transaction.
     * The function will run after the query is succeeded, but before the transaction commit.
     * Queries inside the function will run in the same transaction as the target query.
     * If no records were updated, the hook *won't* run.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterUpdate<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Run the function after transaction for an `update` kind of query will be committed.
     * If the query wasn't wrapped in a transaction, will run after the query.
     * If no records were updated, the hook *won't* run.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterUpdateCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Run the function before a `create` or an `update` kind of query.
     *
     * @param cb - function to call, first argument is a query object
     */
    beforeSave<T>(this: T, cb: QueryBeforeActionHook): T;
    /**
     * Run the function after a `create` or an `update` kind of query.
     * Enforces wrapping the query into a transaction.
     * The function will run after the query is succeeded, but before the transaction commit.
     * Queries inside the function will run in the same transaction as the target query.
     * For the `update` query, if no records were updated, the hook *won't* run.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterSave<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Run the function after transaction for a `create` or an `update` kind of query will be committed.
     * If the query wasn't wrapped in a transaction, will run after the query.
     * For the `update` query, if no records were updated, the hook *won't* run.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterSaveCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Run the function before a `delete` kind of query.
     *
     * @param cb - function to call, first argument is a query object
     */
    beforeDelete<T>(this: T, cb: QueryBeforeHook): T;
    /**
     * Run the function after a `delete` kind of query.
     * Enforces wrapping the query into a transaction.
     * The function will run after the query is succeeded, but before the transaction commit.
     * Queries inside the function will run in the same transaction as the target query.
     * If no records were deleted, the hook *won't* run.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterDelete<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Run the function after transaction for a `delete` kind of query will be committed.
     * If the query wasn't wrapped in a transaction, will run after the query.
     * If no records were deleted, the hook *won't* run.
     *
     * @param select - list of columns to select for the hook
     * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
     */
    afterDeleteCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(this: T, select: S, cb: AfterHook<S, T['shape']>): T;
    /**
     * Add `catchAfterCommitError` to the query to catch possible errors that are coming from after commit hooks.
     *
     * When it is used, the transaction will return its result disregarding of a failed hook.
     *
     * Without `catchAfterCommitError`, the transaction function throws and won't return result.
     * Result is still accessible from the error object [AfterCommitError](#AfterCommitError).
     *
     * ```ts
     * const result = await db
     *   .$transaction(async () => {
     *     return db.table.create(data);
     *   })
     *   .catchAfterCommitError((err) => {
     *     // err is instance of AfterCommitError (see below)
     *   })
     *   // can be added multiple times, all catchers will be executed
     *   .catchAfterCommitError((err) => {});
     *
     * // result is available even if an after commit hook has failed
     * result.id;
     * ```
     */
    catchAfterCommitError<T>(this: T, fn: AfterCommitErrorHandler): T;
}
