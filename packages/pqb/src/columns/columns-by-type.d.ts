import { Column } from './column';
import { ColumnSchemaConfig } from './column-schema';
export interface ColumnsByType {
    [K: string]: () => Column.Pick.Data;
}
export declare const makeColumnsByType: (schema: ColumnSchemaConfig) => never;
