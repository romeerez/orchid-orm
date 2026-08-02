import { RawSqlBase, type RlsPolicy } from 'pqb/internal';
import { Migration } from './migration';
interface RlsPolicyForSelectOrDelete {
    for: 'SELECT' | 'DELETE';
    using: RawSqlBase;
    withCheck?: never;
}
interface RlsPolicyForInsert {
    for: 'INSERT';
    using?: never;
    withCheck: RawSqlBase;
}
interface RlsPolicyForAllOrUpdate {
    for?: 'ALL' | 'UPDATE';
    using: RawSqlBase;
    withCheck: RawSqlBase;
}
type RlsPolicyExpressions = RlsPolicyForSelectOrDelete | RlsPolicyForInsert | RlsPolicyForAllOrUpdate;
export type RlsPolicyDefinition = RlsPolicyExpressions & {
    as: RlsPolicy.PolicyMode;
    to?: string | string[];
};
export interface ChangeRlsPolicyAlterDefinition {
    name?: string;
    to?: string | string[];
    using?: RawSqlBase;
    withCheck?: RawSqlBase;
}
export type ChangeRlsPolicyRecreateDefinition = RlsPolicyDefinition & {
    table?: string;
    name?: string;
};
export type ChangeRlsPolicyParams = {
    from: ChangeRlsPolicyAlterDefinition;
    to: ChangeRlsPolicyAlterDefinition;
} | {
    from: ChangeRlsPolicyRecreateDefinition;
    to: ChangeRlsPolicyRecreateDefinition;
};
export declare const enableOrDisableRls: (migration: Migration, up: boolean, tableName: string) => Promise<void>;
export declare const forceOrNoForceRls: (migration: Migration, up: boolean, tableName: string) => Promise<void>;
export declare const createOrDropPolicy: (migration: Migration, up: boolean, tableName: string, policyName: string, params: RlsPolicyDefinition) => Promise<void>;
export declare const changePolicy: (migration: Migration, up: boolean, tableName: string, policyName: string, params: ChangeRlsPolicyParams) => Promise<void>;
export declare const dropOrCreatePolicy: (migration: Migration, up: boolean, tableName: string, policyName: string, params: RlsPolicyDefinition) => Promise<void>;
export {};
