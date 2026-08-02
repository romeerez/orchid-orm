import { Column, TableData, TableDataMethods, EmptyObject, NonUniqDataItem, RawSqlBase } from 'pqb/internal';
import { ChangeTableCallback, ChangeTableOptions, DropMode, Migration, MigrationColumnTypes } from './migration';
import { RakeDbAst } from '../ast';
import { TableMethods } from './table-methods';
type Add = typeof add;
declare function add(item: Column, options?: {
    dropMode?: DropMode;
}): SpecialChange;
declare function add(emptyObject: EmptyObject): SpecialChange;
declare function add(items: Record<string, Column>, options?: {
    dropMode?: DropMode;
}): Record<string, RakeDbAst.ChangeTableItem.Column>;
interface Change extends RakeDbAst.ChangeTableItem.Change, ChangeOptions {
}
type ChangeOptions = RakeDbAst.ChangeTableItem.ChangeUsing;
interface SpecialChange {
    type: SpecialChange;
}
interface OneWayChange {
    type: 'change';
    name?: string;
    to: RakeDbAst.ColumnChange;
    using?: RakeDbAst.ChangeTableItem.ChangeUsing;
}
interface ColumnForeignKeyChangeInput {
    columnForeignKey: TableData.ColumnReferences;
}
interface ColumnPrimaryKeyChangeInput {
    columnPrimaryKey: {
        name?: string;
    };
}
interface ColumnIndexChangeInput {
    columnIndex: TableData.ColumnIndex;
}
interface ColumnExcludeChangeInput {
    columnExclude: TableData.ColumnExclude;
}
type ChangeInput = Column | OneWayChange | NonUniqDataItem | ColumnForeignKeyChangeInput | ColumnPrimaryKeyChangeInput | ColumnIndexChangeInput | ColumnExcludeChangeInput;
export interface TableChangeMethods extends TableMethods, TableDataMethods<string> {
    name(name: string): TableChangeMethods;
    add: Add;
    drop: Add;
    primaryKey<Columns extends [string, ...string[]], Name extends string>(columns: Columns, name?: Name): {
        tableDataItem: true;
        columns: Columns;
        name: string extends Name ? never : Name;
    };
    primaryKey(name?: string): ColumnPrimaryKeyChangeInput;
    index(columns: (string | TableData.Index.ColumnOrExpressionOptions)[], options?: TableData.Index.OptionsArg): NonUniqDataItem;
    index(options?: TableData.Index.ColumnArg): ColumnIndexChangeInput;
    unique<Columns extends [
        string | TableData.Index.ColumnOrExpressionOptions,
        ...(string | TableData.Index.ColumnOrExpressionOptions)[]
    ], Name extends string>(columns: Columns, options?: TableData.Index.UniqueOptionsArg<Name>): {
        tableDataItem: true;
        columns: Columns extends (string | TableData.Index.ColumnOptionsForColumn<string>)[] ? {
            [I in keyof Columns]: 'column' extends keyof Columns[I] ? Columns[I]['column'] : Columns[I];
        } : never;
        name: string extends Name ? never : Name;
    };
    unique(options?: TableData.Index.UniqueColumnArg): ColumnIndexChangeInput;
    exclude(columns: TableData.Exclude.ColumnOrExpressionOptions[], options?: TableData.Exclude.Options): NonUniqDataItem;
    exclude(with_: string, options?: TableData.Exclude.ColumnArg): ColumnExcludeChangeInput;
    foreignKey<Shape>(columns: [string, ...string[]], fnOrTable: () => Column.ForeignKey.TableParam & {
        columns?: {
            shape: Shape;
        };
        instance?: () => {
            columns: {
                shape: Shape;
            };
        };
    }, foreignColumns: [keyof Shape, ...(keyof Shape)[]], options?: TableData.References.Options): NonUniqDataItem;
    foreignKey(columns: [string, ...string[]], fnOrTable: string, foreignColumns: [string, ...string[]], options?: TableData.References.Options): NonUniqDataItem;
    foreignKey(fnOrTable: string, foreignColumn: string, options?: TableData.References.Options): ColumnForeignKeyChangeInput;
    change(from: ChangeInput, to: ChangeInput, using?: ChangeOptions): Change;
    default(value: unknown | RawSqlBase): OneWayChange;
    nullable(): OneWayChange;
    nonNullable(): OneWayChange;
    comment(comment: string | null): OneWayChange;
    rename(name: string): RakeDbAst.ChangeTableItem.Rename;
}
export declare const makeTableChangeMethods: (tableMethods: TableMethods) => TableChangeMethods;
export type TableChanger<CT> = MigrationColumnTypes<CT> & TableChangeMethods;
export type TableChangeData = Record<string, RakeDbAst.ChangeTableItem.Column | RakeDbAst.ChangeTableItem.Rename | Change | SpecialChange | Column.Pick.Data>;
export declare const changeTable: <CT>(migration: Migration<CT>, tableChangeMethods: TableChangeMethods, up: boolean, tableName: string, options: ChangeTableOptions, fn?: ChangeTableCallback<CT>) => Promise<void>;
export {};
