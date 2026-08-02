import { IsQuery, Query, QueryReturnType } from './query';
import { ComputedColumns } from './extra-features/computed/computed';
import { Column } from '../columns/column';
import { ColumnsShape } from '../columns/columns-shape';
import { CteItem } from './basic-features/cte/cte.sql';
import { HasBeforeAndBeforeSet, SubQueryForSql } from './internal-features/sub-query/sub-query-for-sql';
import { BatchParsers, ColumnsParsers, PickQueryDataParsers } from './query-columns/query-column-parsers';
import { PickQueryInputType, PickQueryQ, PickQueryTable } from './pick-query-types';
import { Expression, ExpressionChain, SelectableOrExpression } from './expressions/expression';
import { Adapter, QueryResult } from '../adapters/adapter';
import { HasHookSelect } from './basic-features/select/hook-select';
import { MaybeArray, RecordString, RecordUnknown } from '../utils';
import { RelationConfigBase } from './relations';
import { QueryDataAliases } from './basic-features/as/as';
import { AfterCommitErrorHandler } from './basic-features/transaction/transaction';
import { Sql } from './sql/sql';
import { QueryDataTransform } from './extra-features/data-transform/transform';
import { QueryHookUtils } from './extra-features/hooks/hooks';
import { SelectItem } from './basic-features/select/select.sql';
import { QueryDataSources } from './extra-features/search/search.sql';
import { JoinItem, JoinItemArgs } from './basic-features/join/join.sql';
import { WhereItem } from './basic-features/where/where.sql';
import { OrderItem } from './basic-features/order/order.sql';
import { HavingItem } from './basic-features/having/having.sql';
import { WindowItem } from './basic-features/window/window.sql';
import { QueryDataUnion } from './basic-features/union/union.sql';
import { OnConflictMerge, OnConflictSet, OnConflictTarget } from './basic-features/mutate/insert.sql';
import { QueryLogger, QueryLogObject } from './basic-features/log/log';
import { QuerySchema } from './basic-features/schema/schema';
import { MutativeQueriesSelectRelationsQueryData } from './internal-features/mutative-queries-select-relation/mutative-queries-select-relations.sql';
import type { ToSQLCtx } from './sql/to-sql';
export interface RecordOfColumnsShapeBase {
    [K: string]: Column.Shape.QueryInit;
}
export interface WithConfigs {
    [K: string]: WithConfig;
}
export interface WithConfig {
    shape: Column.Shape.QueryInit;
    computeds?: ComputedColumns;
}
export type JoinedShapes = RecordOfColumnsShapeBase;
export interface JoinedParsers {
    [K: string]: ColumnsParsers | undefined;
}
export type QueryBeforeHook = (query: Query) => void | Promise<void>;
export type QueryBeforeActionHook = (utils: QueryHookUtils<PickQueryInputType>) => void | Promise<void>;
export type QueryAfterHook<Data = unknown> = (data: Data, query: Query) => unknown | Promise<unknown>;
export type QueryDataScopes = {
    [K: string]: QueryScopeData;
};
export type QueryScopeData = (q: Query) => {
    and?: WhereItem[];
    or?: WhereItem[][];
};
export type QueryDataFromItem = string | SubQueryForSql | Expression;
export interface QueryDataJoinTo extends PickQueryTable, PickQueryQ {
}
export interface HandleResult {
    (q: Query, returnType: QueryReturnType, result: QueryResult, sql: Sql, isSubQuery?: true): unknown;
}
export type WithItems = CteItem[];
export interface JoinValueDedupItem {
    q: Query;
    a: string;
}
export type QueryType = undefined | null | 'upsert' | 'insert' | 'update' | 'delete';
export interface AsFn {
    (as: string): void;
}
export interface SelectAllColumnExpression {
    (ctx: ToSQLCtx, quotedAs?: string): string;
}
export type SelectAllColumn = string | SelectAllColumnExpression;
export interface QueryData extends QueryDataAliases, PickQueryDataParsers, HasHookSelect, MutativeQueriesSelectRelationsQueryData {
    type: QueryType;
    adapter: Adapter;
    selectShape: ColumnsShape;
    nameInDb?: string;
    handleResult: HandleResult;
    catch?: boolean;
    returnType: QueryReturnType;
    returning?: boolean;
    returningMany?: boolean;
    wrapInTransaction?: boolean;
    throwOnNotFound?: boolean;
    cteThrowOnNotFound?: boolean;
    ensureCount?: number;
    with?: WithItems;
    withShapes?: WithConfigs;
    joinTo?: QueryDataJoinTo;
    joinedShapes?: JoinedShapes;
    joinedParsers?: JoinedParsers;
    joinedBatchParsers?: {
        [K: string]: BatchParsers;
    };
    joinedComputeds?: {
        [K: string]: ComputedColumns | undefined;
    };
    joined?: {
        [K: string]: Query;
    };
    joinedForSelect?: string;
    innerJoinLateral?: true;
    valuesJoinedAs?: RecordString;
    schema?: QuerySchema;
    select?: SelectItem[];
    selectCache?: {
        sql: string;
        aliases: string[];
    };
    selectAllColumns?: SelectAllColumn[];
    /**
     * Subset of the `shape` that only includes columns with no `data.explicitSelect`.
     */
    selectAllShape: RecordUnknown;
    /**
     * column type for query with 'value' or 'valueOrThrow' return type
     * Is needed in {@link getShapeFromSelect} to get shape of sub-select that returns a single value.
     */
    getColumn?: Column.Pick.QueryColumn;
    expr?: Expression;
    from?: MaybeArray<QueryDataFromItem>;
    updateFrom?: JoinItemArgs;
    sources?: QueryDataSources;
    and?: WhereItem[];
    or?: WhereItem[][];
    order?: OrderItem[];
    returnsOne?: true;
    useFromLimitOffset?: true;
    coalesceValue?: unknown | Expression;
    notFoundDefault?: unknown;
    defaults?: RecordUnknown;
    runtimeComputeds?: ComputedColumns;
    selectedComputeds?: ComputedColumns;
    beforeSet?: Set<QueryBeforeHook>;
    dynamicBefore?: HasBeforeAndBeforeSet[];
    before?: QueryBeforeHook[];
    after?: QueryAfterHook[];
    beforeCreate?: QueryBeforeHook[];
    afterCreate?: QueryAfterHook[];
    afterCreateCommit?: QueryAfterHook[];
    afterCreateSelect?: Set<string>;
    beforeUpdate?: QueryBeforeHook[];
    afterUpdate?: QueryAfterHook[];
    afterUpdateCommit?: QueryAfterHook[];
    afterUpdateSelect?: Set<string>;
    afterSave?: QueryAfterHook[];
    afterSaveCommit?: QueryAfterHook[];
    beforeDelete?: QueryBeforeHook[];
    afterDelete?: QueryAfterHook[];
    afterDeleteCommit?: QueryAfterHook[];
    afterDeleteSelect?: Set<string>;
    catchAfterCommitErrors?: AfterCommitErrorHandler[];
    log?: QueryLogObject;
    logger: QueryLogger;
    autoPreparedStatements?: boolean;
    transform?: QueryDataTransform[];
    language?: string;
    subQuery?: number;
    chainMultiple?: boolean;
    relChain?: {
        query: Query;
        rel: RelationConfigBase;
    }[];
    /**
     * Stores current operator functions available for the query.
     * Is needed to remove these operators from query object when changing the query type, see {@link setQueryOperators}.
     */
    operators?: RecordUnknown;
    scopes?: {
        [K: string]: QueryScopeData;
    };
    all?: true;
    chain?: ExpressionChain;
    outerQuery?: Query;
    hookCreateSet?: RecordUnknown[];
    hookUpdateSet?: RecordUnknown[];
    appendQueries?: SubQueryForSql[];
    asFns?: AsFn[];
    /** select and upsert **/
    distinct?: SelectableOrExpression[];
    only?: boolean;
    join?: JoinItem[];
    joinValueDedup?: Map<string, JoinValueDedupItem>;
    group?: (string | Expression)[];
    having?: HavingItem[];
    window?: WindowItem[];
    union?: QueryDataUnion;
    limit?: number;
    offset?: number;
    for?: {
        type: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
        tableNames?: string[] | Expression;
        mode?: 'NO WAIT' | 'SKIP LOCKED';
    };
    /** upsert **/
    upsertUpdate?: boolean;
    upsertSecond?: boolean;
    upsertUpdateAsFns?: AsFn[];
    upsertCreateWith?: WithItems;
    upsertCreateAppendQueries?: SubQueryForSql[];
    upsertCreateAsFns?: AsFn[];
    upsertInsert?(): unknown;
    /** insert **/
    columns: string[];
    insertFrom?: SubQueryForSql;
    insertValuesAs?: string;
    queryColumnsCount?: number;
    values: unknown[][];
    onConflict?: {
        target?: OnConflictTarget;
        set?: OnConflictSet;
        merge?: OnConflictMerge;
    };
    /** update **/
    updateData?: UpdateQueryDataItem[];
    updateMany?: UpdateManyQueryData;
}
export interface UpdateManyQueryData {
    primaryKeys: string[];
    setColumns: string[];
    data: RecordUnknown[];
    strict?: boolean;
}
export interface UpdateQueryDataObject {
    [K: string]: Expression | {
        op: string;
        arg: unknown;
    } | unknown;
}
export interface UpdatedAtDataInjector {
    (data: UpdateQueryDataItem[]): UpdateQueryDataObject | void;
}
export type UpdateQueryDataItem = UpdateQueryDataObject | UpdatedAtDataInjector;
export interface PickQueryDataShapeAndJoinedShapes {
    shape: Column.Shape.QueryInit;
    joinedShapes?: JoinedShapes;
}
export interface PickQueryDataShapeAndJoinedShapesAndAliases extends PickQueryDataShapeAndJoinedShapes, QueryDataAliases {
}
/**
 * Push a new element into an array in the query data - immutable version
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - new element to push
 */
export declare const pushQueryValueImmutable: <T extends IsQuery>(q: T, key: string, value: unknown) => T;
export declare const getClonedQueryData: (query: QueryData) => QueryData;
