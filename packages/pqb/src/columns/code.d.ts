import { Column } from './column';
import { RecordKeyTrue, RecordString } from '../utils';
import { TableData } from '../tableData';
import { ArrayMethodsDataForBaseColumn, BaseNumberData, DateColumnData, StringData } from './column-data-types';
export type Code = string | Codes;
export type Codes = Code[];
export interface ColumnToCodeCtx {
    t: string;
    table: string;
    currentSchema: string;
    migration?: boolean;
    snakeCase?: boolean;
    sql?: string;
    isSqlUsed?: boolean;
}
/**
 * Push code: this will append a code string to the last code array element when possible.
 * @param code - array of code to push into
 * @param add - code to push
 */
export declare const addCode: (code: Code[], add: Code) => void;
/**
 * Convert the code item into string.
 *
 * @param code - code item
 * @param tabs - each new line will be prefixed with the tabs. Each element of the code represents a new line
 * @param shift - array elements of the given code will be shifted with this sting
 */
export declare const codeToString: (code: Code, tabs: string, shift: string) => string;
/**
 * Convert a column default value into code string.
 *
 * @param t - column types variable name
 * @param value - column default
 */
export declare const columnDefaultArgumentToCode: (ctx: string | ColumnToCodeCtx, value: unknown) => string;
/**
 * Build a function that will generate a code for a specific column type.
 *
 * @param methodNames - array of column method names to convert to code
 * @param skip - allows skipping some methods
 * @param aliases - provide aliases for specific methods
 */
export declare const columnMethodsToCode: <T extends Column.Data>(methodNames: (keyof T)[], skip?: RecordKeyTrue, aliases?: RecordString) => (data: T, migration: boolean | undefined, skipLocal?: RecordKeyTrue) => string;
export declare const stringDataToCode: (data: StringData, migration: boolean | undefined, skipLocal?: RecordKeyTrue) => string;
export declare const numberDataToCode: (data: BaseNumberData, migration: boolean | undefined, skipLocal?: RecordKeyTrue) => string;
export declare const dateDataToCode: (data: DateColumnData, migration: boolean | undefined, skipLocal?: RecordKeyTrue) => string;
export declare const arrayDataToCode: (data: ArrayMethodsDataForBaseColumn, migration: boolean | undefined, skipLocal?: RecordKeyTrue) => string;
/**
 * Converts column type and JSON type custom errors into code
 *
 * @param errors - custom error messages
 */
export declare const columnErrorMessagesToCode: (errors: RecordString) => Code;
export declare const isDefaultTimeStamp: (item: Column.Pick.DataAndDataType) => boolean;
export declare const columnsShapeToCode: (ctx: ColumnToCodeCtx, shape: Column.Shape.QueryInit) => Codes;
export declare const pushTableDataCode: (code: Codes, ast: TableData) => Codes;
export declare const primaryKeyInnerToCode: (primaryKey: TableData.PrimaryKey, t: string) => string;
export declare const indexInnerToCode: (index: TableData.Index, t: string) => Codes;
export declare const indexToCode: (item: TableData.Index, t: string, prefix?: string) => Codes;
export declare const excludeInnerToCode: (item: TableData.Exclude, t: string) => Codes;
export declare const excludeToCode: (item: TableData.Exclude, t: string, prefix?: string) => Codes;
export declare const constraintToCode: (item: TableData.Constraint, t: string, m?: boolean, prefix?: string, ctx?: ColumnToCodeCtx) => Codes;
export declare const constraintInnerToCode: (item: TableData.Constraint, t: string, m?: boolean, ctx?: ColumnToCodeCtx) => Codes;
export declare const referencesArgsToCode: ({ columns, fnOrTable, foreignColumns, options, }: Exclude<TableData.Constraint['references'], undefined>, name?: string | false, m?: boolean) => Codes;
export declare const columnForeignKeysToCode: (foreignKeys: TableData.ColumnReferences[], migration: boolean | undefined) => Codes;
export declare const foreignKeyArgumentToCode: ({ fnOrTable, foreignColumns, options, }: TableData.ColumnReferences, migration: boolean | undefined) => Codes;
export declare const columnIndexesToCode: (items: Exclude<Column.Data['indexes'], undefined>) => Codes;
export declare const columnExcludesToCode: (items: Exclude<Column.Data['excludes'], undefined>) => Codes;
export declare const columnCheckToCode: (ctx: ColumnToCodeCtx, checks: Column.Data.Check[]) => string;
export declare const identityToCode: (identity: TableData.Identity, dataType?: string) => Codes;
export declare const columnCode: (type: Column, ctx: ColumnToCodeCtx, key: string, code: Code) => Code;
