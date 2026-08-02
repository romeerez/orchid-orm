import { EnumColumn, DefaultSchemaConfig } from 'pqb/internal';
export interface TableMethods {
    enum(name: string): EnumColumn<DefaultSchemaConfig, undefined, [string, ...string[]]>;
}
export declare const makeTableMethods: (schemaConfig: DefaultSchemaConfig) => TableMethods;
