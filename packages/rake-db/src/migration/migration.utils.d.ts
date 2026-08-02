import { Adapter, Column, RawSqlBase, TableData, type SingleSql, type QuerySchema } from 'pqb/internal';
import { ColumnComment } from './migration';
import { RakeDbConfig } from '../config/config';
import { TableQuery } from './create-table';
export declare const versionToString: (config: Pick<RakeDbConfig, 'migrationId'>, version: number) => string;
export declare const columnTypeToSql: (schema: QuerySchema | undefined, item: Column.Pick.Data) => string;
export declare const getColumnName: (item: {
    data: {
        name?: string;
    };
}, key: string, snakeCase: boolean | undefined) => string;
export declare const columnToSql: (schema: QuerySchema | undefined, name: string, item: Column, values: unknown[], hasMultiplePrimaryKeys: boolean, snakeCase: boolean | undefined) => string;
export declare const encodeColumnDefault: (def: unknown, values: unknown[], column?: Column.Pick.Data) => string | null;
export declare const identityToSql: (schema: QuerySchema | undefined, identity: TableData.Identity) => string;
export declare const addColumnIndex: (indexes: TableData.Index[], name: string, item: Column) => void;
export declare const addColumnExclude: (excludes: TableData.Exclude[], name: string, item: Column) => void;
export declare const addColumnComment: (comments: ColumnComment[], name: string, item: Column) => void;
export declare const getForeignKeyTable: (schema: QuerySchema | undefined, fnOrTable: (() => Column.ForeignKey.TableParam) | string) => [string | undefined, string];
export declare const getConstraintName: (table: string, constraint: {
    references?: {
        columns: string[];
    };
    check?: unknown;
    identity?: unknown;
}, snakeCase: boolean | undefined) => string;
export declare const constraintToSql: (schema: QuerySchema | undefined, { name }: {
    schema?: string;
    name: string;
}, up: boolean, constraint: TableData.Constraint, values: unknown[], snakeCase: boolean | undefined) => string;
export declare const referencesToSql: (schema: QuerySchema | undefined, references: TableData.References, snakeCase: boolean | undefined) => string;
export interface GetIndexOrExcludeName {
    (table: string, columns: ({
        column?: string;
    } | {
        expression: string;
    })[]): string;
}
export declare const getIndexName: GetIndexOrExcludeName;
export declare const getExcludeName: GetIndexOrExcludeName;
export declare const indexesToQuery: (up: boolean, { schema, name: tableName }: {
    schema?: string;
    name: string;
}, indexes: TableData.Index[], snakeCase: boolean | undefined, language?: string) => SingleSql[];
export declare const excludesToQuery: (up: boolean, { schema, name: tableName }: {
    schema?: string;
    name: string;
}, excludes: TableData.Exclude[], snakeCase: boolean | undefined) => SingleSql[];
export declare const commentsToQuery: (schemaTable: {
    schema?: string;
    name: string;
}, comments: ColumnComment[]) => SingleSql[];
export declare const primaryKeyToSql: (primaryKey: Exclude<TableData['primaryKey'], undefined>) => string;
export declare const interpolateSqlValues: ({ text, values }: TableQuery) => string;
export interface ColumnNamedCheck extends Column.Data.Check {
    name: string;
}
export declare const nameColumnChecks: (table: string, column: string, checks: Column.Data.Check[]) => ColumnNamedCheck[];
export declare const cmpRawSql: (a: RawSqlBase, b: RawSqlBase) => boolean;
export declare const getMigrationsSchemaAndTable: (adapter: Adapter, config: {
    migrationsTable: string;
}) => {
    schema?: string;
    table: string;
};
export declare const migrationsSchemaTableSql: (adapter: Adapter, config: {
    migrationsTable: string;
}) => string;
