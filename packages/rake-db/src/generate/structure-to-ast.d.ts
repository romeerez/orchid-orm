import { DbStructure, IntrospectedStructure } from './db-structure';
import { RakeDbAst } from '../ast';
import { type ColumnsByType, ColumnsShape, Column, DbStructureDomainsMap, TableData, Adapter, ColumnSchemaConfig } from 'pqb/internal';
import { RakeDbConfig } from '../config/config';
export interface StructureToAstCtx {
    snakeCase?: boolean;
    unsupportedTypes: Record<string, string[]>;
    currentSchema: string;
    columnSchemaConfig: ColumnSchemaConfig;
    columnsByType: ColumnsByType;
}
export interface StructureToAstTableData {
    primaryKey?: TableData.PrimaryKey;
    indexes: DbStructure.Index[];
    excludes: DbStructure.Exclude[];
    constraints: DbStructure.Constraint[];
    roles?: DbStructure.Role[];
}
export declare const makeStructureToAstCtx: (config: Pick<RakeDbConfig, 'snakeCase' | 'schemaConfig'>, currentSchema: string) => StructureToAstCtx;
export declare const structureToAst: (ctx: StructureToAstCtx, adapter: Adapter, config: Pick<RakeDbConfig, 'migrationsTable'>) => Promise<RakeDbAst[]>;
export declare const makeDomainsMap: (ctx: StructureToAstCtx, data: IntrospectedStructure) => DbStructureDomainsMap;
export declare const instantiateDbColumn: (ctx: StructureToAstCtx, data: IntrospectedStructure, domains: DbStructureDomainsMap, dbColumn: DbStructure.Column) => Column;
export declare const tableToAst: (ctx: StructureToAstCtx, data: IntrospectedStructure, table: DbStructure.Table, action: 'create' | 'drop', domains: DbStructureDomainsMap) => RakeDbAst.Table;
export declare const getDbStructureTableData: (data: IntrospectedStructure, { name, schemaName }: DbStructure.Table) => StructureToAstTableData;
export declare const makeDbStructureColumnsShape: (ctx: StructureToAstCtx, data: IntrospectedStructure, domains: DbStructureDomainsMap, table: DbStructure.Table | DbStructure.View | DbStructure.MaterializedView, tableData?: StructureToAstTableData) => ColumnsShape;
export interface ColumnChecks {
    [K: string]: string[];
}
export declare const getDbTableColumnsChecks: (tableData: StructureToAstTableData) => ColumnChecks;
export declare const dbColumnToAst: (ctx: StructureToAstCtx, data: IntrospectedStructure, domains: DbStructureDomainsMap, tableName: string, item: DbStructure.Column, table?: DbStructure.Table, tableData?: StructureToAstTableData, checks?: ColumnChecks) => [key: string, column: Column];
