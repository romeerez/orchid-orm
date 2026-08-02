import { AdapterConfigBase, ColumnSchemaConfig, DbOptions, DbResult, DefaultColumnTypes, DefaultSchemaConfig, DriverAdapter, QuerySchema, AdapterSchemaConfigOptions } from 'pqb/internal';
export declare const bunSchemaConfig: (() => DefaultSchemaConfig) & AdapterSchemaConfigOptions;
export interface CreateBunDbOptions<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> extends BunAdapterOptions, DbOptions<SchemaConfig, ColumnTypes> {
}
export declare const createDb: <SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig, ColumnTypes = DefaultColumnTypes<SchemaConfig>>({ log, ...options }: CreateBunDbOptions<SchemaConfig, ColumnTypes>) => DbResult<ColumnTypes>;
export interface BunOptions {
    hostname?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string | (() => string | Promise<string>);
    max?: number;
    idleTimeout?: number;
    maxLifetime?: number;
    connectionTimeout?: number;
    prepare?: boolean;
    tls?: unknown;
}
export interface BunAdapterOptions extends AdapterConfigBase, BunOptions {
    schema?: QuerySchema;
    searchPath?: string;
    ssl?: unknown;
}
export declare const BunAdapter: DriverAdapter;
