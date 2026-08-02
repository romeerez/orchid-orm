import { Column } from './columns/column';
import { RawSqlBase, SqlFn } from './query/expressions/raw-sql';
import { Expression } from './query/expressions/expression';
import { EmptyTuple, MaybeArray } from './utils';
import { SearchWeight } from './query';
export interface TableData {
    primaryKey?: TableData.PrimaryKey;
    indexes?: TableData.Index[];
    excludes?: TableData.Exclude[];
    constraints?: TableData.Constraint[];
}
export declare namespace TableData {
    export type DropMode = 'CASCADE' | 'RESTRICT';
    export interface PrimaryKey {
        columns: string[];
        name?: string;
    }
    export interface ColumnIndex {
        options: Index.ColumnOptionsData;
    }
    export interface ColumnExclude extends ColumnIndex {
        with: string;
    }
    export interface Index {
        columns: Index.ColumnOrExpressionOptions[];
        options: Index.Options;
    }
    export interface Exclude {
        columns: Exclude.ColumnOrExpressionOptions[];
        options: Exclude.Options;
    }
    export interface Constraint {
        name?: string;
        check?: Check;
        identity?: Identity;
        references?: References;
        dropMode?: TableData.DropMode;
    }
    export type Check = RawSqlBase;
    export interface ColumnReferences {
        fnOrTable: TableData.References.FnOrTable;
        foreignColumns: string[];
        options?: References.Options;
    }
    export interface References extends ColumnReferences {
        columns: string[];
    }
    export interface Identity extends SequenceBaseOptions {
        always?: boolean;
    }
    interface SequenceBaseOptions {
        increment?: number;
        start?: number;
        min?: number;
        max?: number;
        cache?: number;
        cycle?: boolean;
    }
    export interface SequenceOptions extends SequenceBaseOptions {
        dataType?: 'smallint' | 'integer' | 'bigint';
        ownedBy?: string;
    }
    export namespace Index {
        export interface ColumnOptions {
            collate?: string;
            opclass?: string;
            order?: string;
            weight?: SearchWeight;
        }
        /**
         * Controls when Postgres checks a unique constraint.
         */
        export type UniqueDeferrable = false | 'immediate' | 'deferred';
        export interface BaseUniqueOptionsArg<Name extends string = string> {
            name?: Name;
            nullsNotDistinct?: boolean;
            using?: string;
            include?: MaybeArray<string>;
            with?: string;
            tablespace?: string;
            where?: string;
            dropMode?: DropMode;
        }
        export interface UniqueOptionsArg<Name extends string = string> extends BaseUniqueOptionsArg<Name> {
            /**
             * Makes this unique definition a deferrable Postgres constraint.
             */
            deferrable?: UniqueDeferrable;
        }
        export interface NonUniqueIndexOptionsArg<Name extends string = string> extends BaseUniqueOptionsArg<Name> {
            unique?: false;
            deferrable?: never;
        }
        export interface UniqueIndexOptionsArg<Name extends string = string> extends UniqueOptionsArg<Name> {
            unique: true;
        }
        export type OptionsArg<Name extends string = string> = NonUniqueIndexOptionsArg<Name> | UniqueIndexOptionsArg<Name>;
        export type TsVectorArg = OptionsArg & TsVectorOptions;
        export interface Options extends UniqueOptionsArg, TsVectorOptions {
            unique?: boolean;
        }
        export interface UniqueColumnArg<Name extends string = string> extends ColumnOptions, UniqueOptionsArg<Name> {
            expression?: string;
        }
        export interface NonUniqueColumnArg<Name extends string = string> extends ColumnOptions, BaseUniqueOptionsArg<Name> {
            expression?: string;
            unique?: false;
            deferrable?: never;
        }
        export interface UniqueIndexColumnArg<Name extends string = string> extends UniqueColumnArg<Name> {
            unique: true;
        }
        export interface ColumnOptionsData extends ColumnOptions, Options {
            expression?: string;
        }
        export type ColumnArg<Name extends string = string> = NonUniqueColumnArg<Name> | UniqueIndexColumnArg<Name>;
        interface TsVectorOptions {
            language?: string;
            languageColumn?: string;
            tsVector?: boolean;
        }
        export type TsVectorColumnArg = ColumnArg & TsVectorOptions;
        export interface ExpressionOptions extends ColumnOptions {
            expression: string;
        }
        export interface ColumnOptionsForColumn<Column extends PropertyKey> extends ColumnOptions {
            column: Column;
        }
        export type ColumnOrExpressionOptions<Column extends PropertyKey = string> = ColumnOptionsForColumn<Column> | ExpressionOptions;
        export {};
    }
    export namespace Exclude {
        export interface Options {
            name?: string;
            using?: string;
            include?: MaybeArray<string>;
            with?: string;
            tablespace?: string;
            where?: string;
            dropMode?: DropMode;
        }
        export interface ArgColumnOptions {
            collate?: string;
            opclass?: string;
            order?: string;
        }
        export interface ColumnArg extends Options, ArgColumnOptions {
        }
        interface ColumnBaseOptions extends ArgColumnOptions {
            with: string;
        }
        interface ColumnOptions<Column extends PropertyKey> extends ColumnBaseOptions {
            column: Column;
        }
        interface ExpressionOptions extends ColumnBaseOptions {
            expression: string;
        }
        export type ColumnOrExpressionOptions<Column extends PropertyKey = string> = ColumnOptions<Column> | ExpressionOptions;
        export {};
    }
    export namespace References {
        type FnOrTable = (() => Column.ForeignKey.TableParam) | string;
        /**
         * - MATCH FULL will not allow one column of a multicolumn foreign key to be null unless all foreign key columns are null;
         * if they are all null, the row is not required to have a match in the referenced table.
         * - MATCH SIMPLE (default) allows any of the foreign key columns to be null; if any of them are null, the row is not required to have a match in the referenced table.
         * - MATCH PARTIAL - PG docs say it's not implemented.
         */
        type Match = 'FULL' | 'PARTIAL' | 'SIMPLE';
        /**
         * - NO ACTION Produce an error indicating that the deletion or update would create a foreign key constraint violation. If the constraint is deferred, this error will be produced at constraint check time if there still exist any referencing rows. This is the default action.
         * - RESTRICT Produce an error indicating that the deletion or update would create a foreign key constraint violation. This is the same as NO ACTION except that the check is not deferrable.
         * - CASCADE Delete any rows referencing the deleted row, or update the values of the referencing column(s) to the new values of the referenced columns, respectively.
         * - SET NULL Set all the referencing columns, or a specified subset of the referencing columns, to null. A subset of columns can only be specified for ON DELETE actions.
         * - SET DEFAULT Set all the referencing columns, or a specified subset of the referencing columns, to their default values. A subset of columns can only be specified for ON DELETE actions. (There must be a row in the referenced table matching the default values, if they are not null, or the operation will fail.)
         */
        type Action = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
        interface BaseOptions {
            match?: Match;
            onUpdate?: Action;
            onDelete?: Action;
            dropMode?: TableData.DropMode;
        }
        interface Options extends BaseOptions {
            name?: string;
        }
    }
    export {};
}
export type TableDataInput = {
    primaryKey?: TableData.PrimaryKey;
    index?: TableData.Index;
    exclude?: TableData.Exclude;
    constraint?: TableData.Constraint;
};
export interface TableDataItem {
    tableDataItem: true;
    columns: unknown;
}
export interface NonUniqDataItem extends TableDataItem {
    columns: EmptyTuple;
}
export interface UniqueTableDataItem<Shape extends Column.QueryColumns = Column.QueryColumns> {
    columns: (keyof Shape)[];
    name: string;
}
export interface TableDataMethods<Key extends PropertyKey> {
    primaryKey<Columns extends [Key, ...Key[]], Name extends string>(columns: Columns, name?: Name): {
        tableDataItem: true;
        columns: Columns;
        name: string extends Name ? never : Name;
    };
    unique<Columns extends [
        Key | TableData.Index.ColumnOrExpressionOptions<Key>,
        ...(Key | TableData.Index.ColumnOrExpressionOptions<Key>)[]
    ], Name extends string>(columns: Columns, options?: TableData.Index.UniqueOptionsArg<Name>): {
        tableDataItem: true;
        columns: Columns extends (Key | TableData.Index.ColumnOptionsForColumn<Key>)[] ? {
            [I in keyof Columns]: 'column' extends keyof Columns[I] ? Columns[I]['column'] : Columns[I];
        } : never;
        name: string extends Name ? never : Name;
    };
    index(columns: (Key | TableData.Index.ColumnOrExpressionOptions<Key>)[], options?: TableData.Index.OptionsArg): NonUniqDataItem;
    searchIndex(columns: (Key | TableData.Index.ColumnOrExpressionOptions<Key>)[], options?: TableData.Index.TsVectorArg): NonUniqDataItem;
    /**
     * Defines an `EXCLUDE` constraint for multiple columns.
     *
     * The first argument is an array of columns and/or SQL expressions:
     *
     * ```ts
     * interface ExcludeColumnOptions {
     *   // column name OR expression is required
     *   column: string;
     *   // SQL expression, like 'tstzrange("startDate", "endDate")'
     *   expression: string;
     *
     *   // required: operator for the EXCLUDE constraint to work
     *   with: string;
     *
     *   collate?: string;
     *   opclass?: string; // for example, varchar_ops
     *   order?: string; // ASC, DESC, ASC NULLS FIRST, DESC NULLS LAST
     * }
     * ```
     *
     * The second argument is an optional object with options for the whole exclude constraint:
     *
     * ```ts
     * interface ExcludeOptions {
     *   // algorithm to use such as GIST, GIN
     *   using?: string;
     *   // EXCLUDE creates an index under the hood, include columns to the index
     *   include?: MaybeArray<string>;
     *   // see "storage parameters" in the Postgres document for creating an index, for example, 'fillfactor = 70'
     *   with?: string;
     *   // The tablespace in which to create the constraint. If not specified, default_tablespace is consulted, or temp_tablespaces for indexes on temporary tables.
     *   tablespace?: string;
     *   // WHERE clause to filter records for the constraint
     *   where?: string;
     *   // for dropping the index at a down migration
     *   dropMode?: DropMode;
     * }
     * ```
     *
     * Example:
     *
     * ```ts
     * import { change } from '../dbScript';
     *
     * change(async (db) => {
     *   await db.createTable(
     *     'table',
     *     (t) => ({
     *       id: t.identity().primaryKey(),
     *       roomId: t.integer(),
     *       startAt: t.timestamp(),
     *       endAt: t.timestamp(),
     *     }),
     *     (t) => [
     *       t.exclude(
     *         [
     *           { column: 'roomId', with: '=' },
     *           { expression: 'tstzrange("startAt", "endAt")', with: '&&' },
     *         ],
     *         {
     *           using: 'GIST',
     *         },
     *       ),
     *     ],
     *   );
     * });
     * ```
     */
    exclude(columns: TableData.Exclude.ColumnOrExpressionOptions<Key>[], options?: TableData.Exclude.Options): NonUniqDataItem;
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
    check(check: RawSqlBase, name?: string): NonUniqDataItem;
    sql: SqlFn;
}
export type TableDataItemsUniqueColumns<Shape extends Column.QueryColumns, T extends MaybeArray<TableDataItem>> = MaybeArray<TableDataItem> extends T ? never : T extends UniqueTableDataItem<Shape> ? ItemUniqueColumns<Shape, T> : T extends unknown[] ? {
    [Item in T[number] as PropertyKey]: Item extends UniqueTableDataItem<Shape> ? ItemUniqueColumns<Shape, Item> : never;
}[PropertyKey] : never;
type ItemUniqueColumns<Shape extends Column.QueryColumns, T extends UniqueTableDataItem<Shape>> = {
    [Column in T['columns'][number]]: UniqueQueryTypeOrExpression<Shape[Column]['__queryType']>;
};
export type TableDataItemsUniqueColumnTuples<Shape extends Column.QueryColumns, T extends MaybeArray<TableDataItem>> = MaybeArray<TableDataItem> extends T ? never : T extends UniqueTableDataItem<Shape> ? T['columns'] : T extends TableDataItem[] ? Exclude<T[number]['columns'], []> : never;
export type UniqueQueryTypeOrExpression<T> = T | Expression<Column.Pick.QueryColumnOfType<T>>;
export type TableDataItemsUniqueConstraints<T extends MaybeArray<TableDataItem>> = MaybeArray<TableDataItem> extends T ? never : T extends UniqueTableDataItem ? T['name'] : T extends UniqueTableDataItem[] ? T[number]['name'] : never;
export type TableDataFn<Shape, Data extends MaybeArray<TableDataItem>> = (t: TableDataMethods<keyof Shape>) => Data;
export declare const tableDataMethods: TableDataMethods<string>;
export declare const parseTableData: (dataFn?: TableDataFn<unknown, any>) => TableData;
export declare const parseTableDataInput: (tableData: TableData, item: TableDataInput) => void;
export {};
