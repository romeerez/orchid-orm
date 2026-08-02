import { ColumnSchemaConfig, DefaultColumnTypes, TableData } from 'pqb/internal';
export interface TableFactoryOptions<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> {
    schemaConfig?: () => SchemaConfig;
    columnTypes?: ColumnTypes | ((t: DefaultColumnTypes<SchemaConfig>) => ColumnTypes);
    snakeCase?: boolean;
    filePath?: string;
    nowSQL?: string;
    exportAs?: string;
    defineTableExportAs?: string;
    language?: string;
    autoForeignKeys?: boolean | TableData.References.BaseOptions;
}
