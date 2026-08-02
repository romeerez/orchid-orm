import { RawSqlBase } from '../../expressions/raw-sql';
export declare namespace RlsPolicy {
    export type PolicyMode = 'PERMISSIVE' | 'RESTRICTIVE';
    export type PolicyCommand = 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    interface Base {
        name: string;
        to: string | string[];
    }
    export interface ForSelectOrDelete extends Base {
        for: 'SELECT' | 'DELETE';
        using: RawSqlBase;
        withCheck?: never;
    }
    export interface ForInsert extends Base {
        for: 'INSERT';
        using?: never;
        withCheck: RawSqlBase;
    }
    export interface ForAllOrUpdate extends Base {
        for?: 'ALL' | 'UPDATE';
        using: RawSqlBase;
        withCheck: RawSqlBase;
    }
    export type Policy = ForSelectOrDelete | ForInsert | ForAllOrUpdate;
    export {};
}
export declare namespace Rls {
    interface TableConfigBase {
        enable?: boolean;
        force?: boolean;
    }
    interface TableConfig extends TableConfigBase {
        permit: [RlsPolicy.Policy, ...RlsPolicy.Policy[]];
        restrict?: RlsPolicy.Policy[];
    }
    interface TableDefaults {
        /**
         * Default RLS table flags for declarations that omit them.
         */
        enable?: boolean;
        force?: boolean;
    }
    interface Options {
        tableRlsDefaults?: TableDefaults;
    }
}
