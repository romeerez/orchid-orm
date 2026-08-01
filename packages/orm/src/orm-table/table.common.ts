import {
  ColumnSchemaConfig,
  DefaultColumnTypes,
  TableData,
} from 'pqb/internal';

export interface TableFactoryOptions<
  SchemaConfig extends ColumnSchemaConfig,
  ColumnTypes,
> {
  schemaConfig?: () => SchemaConfig;
  // concrete column types or a callback for overriding standard column types
  // this types will be used in tables to define their columns
  columnTypes?:
    | ColumnTypes
    | ((t: DefaultColumnTypes<SchemaConfig>) => ColumnTypes);
  // when set to true, all columns will be translated to `snake_case` when querying database
  snakeCase?: boolean;
  // if for some unknown reason you see error that file path for a table can't be guessed automatically,
  // provide it manually via `filePath`
  filePath?: string;
  // if `now()` for some reason doesn't suite your timestamps, provide a custom SQL for it
  nowSQL?: string;
  // export name of the base table, by default it is defineTable
  exportAs?: string;
  // export name of the defineTable function, by default it is defineTable
  defineTableExportAs?: string;
  // default language for the full text search
  language?: string;
  // automatically create foreign keys for relations
  autoForeignKeys?: boolean | TableData.References.BaseOptions;
}
