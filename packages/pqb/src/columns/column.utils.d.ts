import { Column } from './column';
export interface DbStructureDomainsMap {
    [K: string]: Column;
}
export declare const setColumnDefaultParse: (column: Column.Pick.Data, parse: (input: any) => unknown) => void;
export declare const setColumnParse: (column: Column.Pick.Data, fn: (input: any) => unknown, outputSchema?: unknown) => any;
export declare const setColumnParseNull: (column: Column.Pick.Data, fn: () => unknown, nullSchema?: unknown) => any;
export declare const setColumnDefaultEncode: (column: Column.Pick.Data, fn: (input: any) => unknown) => void;
export declare const setColumnEncode: (column: Column.Pick.Data, fn: (input: any) => unknown, inputSchema?: unknown) => any;
export declare const getColumnBaseType: (column: Column.Pick.Data, domainsMap: DbStructureDomainsMap, type: string) => string;
