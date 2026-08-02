import { MutativeQueriesSelectRelationsSqlProp, MutativeQueriesSelectRelationsSqlState, MutativeQueriesSelectRelationsValue } from './mutative-queries-select-relations.sql';
import { RecordString } from '../../../utils';
import { ThenSavepointState } from '../../then/then';
export declare const checkIfNeedResultAllForMutativeQueriesSelectRelations: (sql: MutativeQueriesSelectRelationsSqlProp) => MutativeQueriesSelectRelationsValue | undefined;
export declare const checkIfShouldReleaseSavepointForMutativeQueriesSelectRelations: (sql: MutativeQueriesSelectRelationsSqlProp) => MutativeQueriesSelectRelationsValue | undefined;
export declare const loadMutativeQueriesSelectRelations: (sql: MutativeQueriesSelectRelationsSqlProp, result: unknown, savepointState?: ThenSavepointState, renames?: RecordString) => Promise<void> | undefined;
export declare const loadRelations: (state: MutativeQueriesSelectRelationsSqlState, result: unknown, savepointState?: ThenSavepointState, renames?: RecordString) => Promise<void>;
