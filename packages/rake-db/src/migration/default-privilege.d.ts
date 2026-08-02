import { Migration } from './migration';
import { DefaultPrivileges } from 'pqb/internal';
interface DefaultPrivilegeObjectSetting<T> {
    privileges?: readonly T[];
    grantablePrivileges?: readonly T[];
}
interface DefaultPrivilegeObjectConfig {
    all?: boolean;
    allGrantable?: boolean;
    tables?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['Table']>;
    sequences?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['Sequence']>;
    functions?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['Function']>;
    types?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['Type']>;
    schemas?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['Schema']>;
    largeObjects?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['LargeObject']>;
}
export interface ChangeDefaultPrivilegesArg {
    owner?: string;
    grantee: string;
    schema?: string;
    grant?: DefaultPrivilegeObjectConfig;
    revoke?: DefaultPrivilegeObjectConfig;
}
export declare const changeDefaultPrivileges: (migration: Migration, up: boolean, arg: ChangeDefaultPrivilegesArg) => Promise<void>;
export {};
