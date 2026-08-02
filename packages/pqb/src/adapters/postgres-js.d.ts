import postgres from 'postgres';
import { AdapterConfigBase, DbOptions, DefaultColumnTypes, DefaultSchemaConfig, DbResult, ColumnSchemaConfig, DriverAdapter, QuerySchema } from 'pqb/internal';
export interface CreatePostgresJsDbOptions<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> extends PostgresJsAdapterOptions, DbOptions<SchemaConfig, ColumnTypes> {
}
export declare const createDb: <SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig, ColumnTypes = DefaultColumnTypes<SchemaConfig>>(options: CreatePostgresJsDbOptions<SchemaConfig, ColumnTypes>) => DbResult<ColumnTypes>;
export interface PostgresJsAdapterOptions extends postgres.Options<any>, Omit<AdapterConfigBase, 'searchPath' | 'ssl'> {
    databaseURL?: string;
    schema?: QuerySchema;
}
export declare const PostgresJsAdapter: DriverAdapter;
