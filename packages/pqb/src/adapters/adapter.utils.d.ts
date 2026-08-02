import { AdapterTransactionOptions, SqlSessionState } from './adapter';
export declare const getSetRoleSql: (parentRole?: string, options?: AdapterTransactionOptions) => string | undefined;
export declare const getResetRoleSql: (parentRole?: string, options?: AdapterTransactionOptions) => string | undefined;
export declare const getSetConfigSql: (parentSetConfig?: SqlSessionState['setConfig'], options?: AdapterTransactionOptions) => string | undefined;
export declare const getResetSetConfigSql: (parentSetConfig?: SqlSessionState['setConfig'], options?: AdapterTransactionOptions) => string | undefined;
