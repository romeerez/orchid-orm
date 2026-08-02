import { Column } from './column';
export interface ColumnFromDbParams {
    isNullable?: boolean;
    default?: string;
    maxChars?: number;
    numericPrecision?: number;
    numericScale?: number;
    dateTimePrecision?: number;
    compression?: string;
    collate?: string;
    extension?: string;
    typmod: number;
}
export declare const assignDbDataToColumn: (column: Column.Pick.Data, params: ColumnFromDbParams) => Column.Pick.Data;
