import { PoolConfig } from 'pg';
import { AdapterConfigBase, ColumnSchemaConfig, DefaultColumnTypes, DefaultSchemaConfig, DbOptions, DbResult, QuerySchema, DriverAdapter, AdapterSchemaConfigOptions } from 'pqb/internal';
export declare const nodePostgresSchemaConfig: (() => DefaultSchemaConfig) & AdapterSchemaConfigOptions;
export declare const createDb: <SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig, ColumnTypes = DefaultColumnTypes<SchemaConfig>>({ log, ...options }: DbOptions<SchemaConfig, ColumnTypes> & Omit<NodePostgresAdapterOptions, 'log'>) => DbResult<ColumnTypes>;
export interface TypeParsers {
    [K: number]: (input: string) => unknown;
}
export interface AdapterConfig extends Omit<AdapterConfigBase, 'searchPath' | 'ssl'>, Omit<PoolConfig, 'types' | 'connectionString'> {
    databaseURL?: string;
}
export interface NodePostgresAdapterOptions extends Omit<AdapterConfig, 'log'> {
    schema?: QuerySchema;
}
export declare const NodePostgresAdapter: DriverAdapter;
