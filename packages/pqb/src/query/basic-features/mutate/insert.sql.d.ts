import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { HookPurpose } from '../../extra-features/hooks/hooks.sql';
import { Sql } from '../../sql/sql';
import { RecordUnknown } from '../../../utils';
import { Expression } from '../../expressions/expression';
import { MutativeQueriesSelectRelationsSqlState } from '../../internal-features/mutative-queries-select-relation/mutative-queries-select-relations.sql';
export type OnConflictTarget = string | string[] | Expression | {
    constraint: string;
};
export type OnConflictSet = RecordUnknown;
export type OnConflictMerge = string | string[] | {
    except: string | string[];
};
export declare const makeInsertSql: (ctx: ToSQLCtx, q: ToSQLQuery, query: QueryData, quotedAs: string, isSubSql?: boolean) => Sql;
export declare const makeReturningSql: (ctx: ToSQLCtx, q: ToSQLQuery, data: QueryData, quotedAs: string, relationSelectState: MutativeQueriesSelectRelationsSqlState | undefined, hookPurpose?: HookPurpose, addHookPurpose?: HookPurpose, isSubSql?: boolean) => string | undefined;
