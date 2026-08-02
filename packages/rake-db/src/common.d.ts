import { Adapter, ColumnSchemaConfig, EnumColumn, QuerySchema } from 'pqb/internal';
import { TableQuery } from './migration/create-table';
import { MigrationsSet } from './migration/migrations-set';
import { RakeDbConfig } from './config/config';
export declare const RAKE_DB_LOCK_KEY = "8582141715823621641";
export interface RakeDbCtx {
    migrationsPromise?: Promise<MigrationsSet>;
}
export declare const getFirstWordAndRest: (input: string) => [string] | [string, string];
export declare const getTextAfterTo: (input: string) => string | undefined;
export declare const getTextAfterFrom: (input: string) => string | undefined;
export declare const joinWords: (...words: string[]) => string;
export declare const joinColumns: (columns: string[]) => string;
export declare const quoteWithSchema: ({ schema, name, }: {
    schema?: string;
    name: string;
}) => string;
export declare const quoteTable: (schema: string | undefined, table: string) => string;
export declare const getSchemaAndTableFromName: (schema: QuerySchema | undefined, name: string) => [string | undefined, string];
export declare const quoteNameFromString: (schema: QuerySchema | undefined, string: string) => string;
/**
 * Do not quote the type itself because it can be an expression like `geography(point)` for postgis.
 */
export declare const quoteCustomType: (schema: QuerySchema | undefined, type: string) => string;
export declare const quoteSchemaTable: (arg: {
    schema?: string;
    name: string;
}, excludeCurrentSchema?: string) => string;
export declare const concatSchemaAndName: ({ schema, name, }: {
    schema?: string;
    name: string;
}, excludeCurrentSchema?: string) => string;
export declare const makePopulateEnumQuery: (schema: QuerySchema | undefined, item: EnumColumn<ColumnSchemaConfig, unknown, readonly string[]>) => TableQuery;
export declare const transaction: <T>(adapter: Adapter, config: Pick<RakeDbConfig, 'transactionSearchPath'>, fn: (trx: Adapter) => Promise<T>) => Promise<T>;
export declare const queryLock: (trx: Adapter) => Promise<import("pqb/internal").QueryResult<import("pqb/internal").QueryResultRow>>;
export declare const getCliParam: (args: string[] | undefined, name: string) => string | undefined;
