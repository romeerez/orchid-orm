import {
  ColumnNameOfTable,
  EmptyObject,
  EmptyTuple,
  Expression,
  ForeignKeyTable,
  MaybeArray,
  QueryColumn,
  QueryColumns,
  RawSQLBase,
} from 'orchid-core';
import { SearchWeight } from './sql';
import { sqlFn, SqlFn } from './sql/rawSql';
import OptionsArg = TableData.Index.OptionsArg;

export interface TableData {
  primaryKey?: TableData.PrimaryKey;
  indexes?: TableData.Index[];
  excludes?: TableData.Exclude[];
  constraints?: TableData.Constraint[];
}

export namespace TableData {
  // Used in migrations to also drop related entities if is set to CASCADE
  export type DropMode = 'CASCADE' | 'RESTRICT';

  export interface PrimaryKey {
    columns: string[];
    name?: string;
  }

  export interface ColumnIndex {
    options: Index.ColumnArg & Index.Options;
    name?: string;
  }

  export interface ColumnExclude extends ColumnIndex {
    with: string;
  }

  export interface Index {
    columns: Index.ColumnOrExpressionOptions[];
    options: Index.Options;
    name?: string;
  }

  export interface Exclude {
    columns: Exclude.ColumnOrExpressionOptions[];
    options: Exclude.Options;
    name?: string;
  }

  export interface Constraint {
    name?: string;
    check?: Check;
    identity?: Identity;
    references?: References;
    dropMode?: TableData.DropMode;
  }

  export type Check = RawSQLBase;

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
    // config for a single column or an expression in the index
    export interface ColumnOptions {
      collate?: string;
      opclass?: string;
      order?: string;
      // weight for a column in a search index
      weight?: SearchWeight;
    }

    export interface UniqueOptionsArg {
      nullsNotDistinct?: boolean;
      using?: string;
      include?: MaybeArray<string>;
      with?: string;
      tablespace?: string;
      where?: string;
      dropMode?: DropMode;
    }

    export interface OptionsArg extends UniqueOptionsArg {
      unique?: boolean;
    }

    export interface TsVectorArg extends OptionsArg, TsVectorOptions {}

    // all possible index options, excluding column/expression options
    export type Options = TsVectorArg;

    export interface UniqueColumnArg extends ColumnOptions, UniqueOptionsArg {
      expression?: string;
    }

    // argument of column's index method, may have an expression
    export interface ColumnArg extends UniqueColumnArg {
      unique?: boolean;
    }

    interface TsVectorOptions {
      // set the language for the tsVector, 'english' is a default
      language?: string;
      // set the column with language for the tsVector
      languageColumn?: string;
      // create a tsVector index
      tsVector?: boolean;
    }

    export interface TsVectorColumnArg extends ColumnArg, TsVectorOptions {}

    // for a table index that has an expression in the list
    export interface ExpressionOptions extends ColumnOptions {
      expression: string;
    }

    // for a table index that has a column in the list
    export interface ColumnOptionsForColumn<Column extends PropertyKey>
      extends ColumnOptions {
      column: Column;
    }

    // for a table index, it can have either a column or an expression in its list
    export type ColumnOrExpressionOptions<Column extends PropertyKey = string> =
      ColumnOptionsForColumn<Column> | ExpressionOptions;
  }

  export namespace Exclude {
    export interface Options {
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

    export interface ColumnArg extends Options, ArgColumnOptions {}

    interface ColumnBaseOptions extends ArgColumnOptions {
      with: string;
    }

    interface ColumnOptions<Column extends PropertyKey>
      extends ColumnBaseOptions {
      column: Column;
    }

    interface ExpressionOptions extends ColumnBaseOptions {
      expression: string;
    }

    export type ColumnOrExpressionOptions<Column extends PropertyKey = string> =
      ColumnOptions<Column> | ExpressionOptions;
  }

  export namespace References {
    export type FnOrTable = (() => ForeignKeyTable) | string;

    /**
     * - MATCH FULL will not allow one column of a multicolumn foreign key to be null unless all foreign key columns are null;
     * if they are all null, the row is not required to have a match in the referenced table.
     * - MATCH SIMPLE (default) allows any of the foreign key columns to be null; if any of them are null, the row is not required to have a match in the referenced table.
     * - MATCH PARTIAL - PG docs say it's not implemented.
     */
    export type Match = 'FULL' | 'PARTIAL' | 'SIMPLE';

    /**
     * - NO ACTION Produce an error indicating that the deletion or update would create a foreign key constraint violation. If the constraint is deferred, this error will be produced at constraint check time if there still exist any referencing rows. This is the default action.
     * - RESTRICT Produce an error indicating that the deletion or update would create a foreign key constraint violation. This is the same as NO ACTION except that the check is not deferrable.
     * - CASCADE Delete any rows referencing the deleted row, or update the values of the referencing column(s) to the new values of the referenced columns, respectively.
     * - SET NULL Set all the referencing columns, or a specified subset of the referencing columns, to null. A subset of columns can only be specified for ON DELETE actions.
     * - SET DEFAULT Set all the referencing columns, or a specified subset of the referencing columns, to their default values. A subset of columns can only be specified for ON DELETE actions. (There must be a row in the referenced table matching the default values, if they are not null, or the operation will fail.)
     */
    export type Action =
      | 'NO ACTION'
      | 'RESTRICT'
      | 'CASCADE'
      | 'SET NULL'
      | 'SET DEFAULT';

    // Used in migrations to make foreign key SQL
    export interface Options {
      name?: string;
      match?: Match;
      onUpdate?: Action;
      onDelete?: Action;
      dropMode?: TableData.DropMode;
    }
  }
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

export interface UniqueTableDataItem<
  Shape extends QueryColumns = QueryColumns,
> {
  columns: (keyof Shape)[];
  name: string;
}

export interface TableDataMethods<Key extends PropertyKey> {
  primaryKey<Columns extends [Key, ...Key[]], Name extends string>(
    columns: Columns,
    name?: Name,
  ): {
    tableDataItem: true;
    columns: Columns;
    name: string extends Name ? never : Name;
  };

  unique<
    Columns extends [
      Key | TableData.Index.ColumnOrExpressionOptions<Key>,
      ...(Key | TableData.Index.ColumnOrExpressionOptions<Key>)[],
    ],
    Name extends string,
  >(
    columns: Columns,
    ...args:
      | [options?: TableData.Index.UniqueOptionsArg]
      | [name?: Name, options?: TableData.Index.UniqueOptionsArg]
  ): {
    tableDataItem: true;
    columns: Columns extends (
      | Key
      | TableData.Index.ColumnOptionsForColumn<Key>
    )[]
      ? {
          [I in keyof Columns]: 'column' extends keyof Columns[I]
            ? Columns[I]['column']
            : Columns[I];
        }
      : never;
    name: string extends Name ? never : Name;
  };

  index(
    columns: (Key | TableData.Index.ColumnOrExpressionOptions<Key>)[],
    ...args:
      | [options?: TableData.Index.OptionsArg]
      | [name?: string, options?: TableData.Index.OptionsArg]
  ): NonUniqDataItem;

  searchIndex(
    columns: (Key | TableData.Index.ColumnOrExpressionOptions<Key>)[],
    ...args:
      | [options?: TableData.Index.TsVectorArg]
      | [name?: string, options?: TableData.Index.TsVectorArg]
  ): NonUniqDataItem;

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
  exclude(
    columns: TableData.Exclude.ColumnOrExpressionOptions<Key>[],
    ...args:
      | [options?: TableData.Exclude.Options]
      | [name?: string, options?: TableData.Exclude.Options]
  ): NonUniqDataItem;

  foreignKey<
    ForeignTable extends (() => ForeignKeyTable) | string,
    ForeignColumns extends ForeignTable extends () => ForeignKeyTable
      ? [
          ColumnNameOfTable<ReturnType<ForeignTable>>,
          ...ColumnNameOfTable<ReturnType<ForeignTable>>[],
        ]
      : [string, ...string[]],
  >(
    columns: [string, ...string[]],
    fnOrTable: ForeignTable,
    foreignColumns: ForeignColumns,
    options?: TableData.References.Options,
  ): NonUniqDataItem;

  check(check: RawSQLBase, name?: string): NonUniqDataItem;

  sql: SqlFn;
}

export type TableDataItemsUniqueColumns<
  Shape extends QueryColumns,
  T extends MaybeArray<TableDataItem>,
> = MaybeArray<TableDataItem> extends T
  ? never
  : T extends UniqueTableDataItem<Shape>
  ? ItemUniqueColumns<Shape, T>
  : T extends unknown[]
  ? {
      [Item in T[number] as PropertyKey]: Item extends UniqueTableDataItem<Shape>
        ? ItemUniqueColumns<Shape, Item>
        : never;
    }[PropertyKey]
  : never;

type ItemUniqueColumns<
  Shape extends QueryColumns,
  T extends UniqueTableDataItem<Shape>,
> = {
  [Column in T['columns'][number]]: UniqueQueryTypeOrExpression<
    Shape[Column]['queryType']
  >;
};

export type TableDataItemsUniqueColumnTuples<
  Shape extends QueryColumns,
  T extends MaybeArray<TableDataItem>,
> = MaybeArray<TableDataItem> extends T
  ? never
  : T extends UniqueTableDataItem<Shape>
  ? T['columns']
  : T extends TableDataItem[]
  ? Exclude<T[number]['columns'], []>
  : never;

export type UniqueQueryTypeOrExpression<T> =
  | T
  | Expression<QueryColumn<T, EmptyObject>>;

export type TableDataItemsUniqueConstraints<
  T extends MaybeArray<TableDataItem>,
> = MaybeArray<TableDataItem> extends T
  ? never
  : T extends UniqueTableDataItem
  ? T['name']
  : // TODO: there may be non-unique items
  T extends UniqueTableDataItem[]
  ? T[number]['name']
  : never;

export type TableDataFn<Shape, Data extends MaybeArray<TableDataItem>> = (
  t: TableDataMethods<keyof Shape>,
) => Data;

const makeIndex = (
  columns: (string | TableData.Index.ColumnOrExpressionOptions)[],
  first?: string | TableData.Index.OptionsArg,
  second?: TableData.Index.OptionsArg,
): {
  index: {
    columns: (string | TableData.Index.ColumnOrExpressionOptions)[];
    options: TableData.Index.Options;
    unique?: boolean;
    name?: string;
  };
} => {
  if (typeof first === 'string') {
    const options: OptionsArg = second ?? {};
    return {
      index: { columns, options, name: first },
    };
  } else {
    const options: OptionsArg = first ?? {};
    return {
      index: { columns, options },
    };
  }
};

export const tableDataMethods: TableDataMethods<string> = {
  primaryKey(columns, name) {
    return { primaryKey: { columns, name } } as never;
  },
  unique(columns, ...[first, second]) {
    const input = makeIndex(columns, first, second);
    input.index.options.unique = true;
    return input as never;
  },
  index: makeIndex as never,
  searchIndex(columns, ...[first, second]) {
    const input = makeIndex(columns, first, second);
    input.index.options.using ??= 'gin';
    input.index.options.tsVector = true;
    return input as never;
  },
  exclude(columns, ...[first, second]) {
    if (typeof first === 'string') {
      const options: TableData.Exclude.Options = second ?? {};
      return {
        exclude: { columns, options, name: first },
      } as never;
    } else {
      const options: TableData.Exclude.Options = first ?? {};
      return {
        exclude: { columns, options },
      } as never;
    }
  },
  foreignKey(columns, fnOrTable, foreignColumns, options) {
    return {
      constraint: {
        name: options?.name,
        references: { columns, fnOrTable, foreignColumns, options },
      },
    } as never;
  },
  check(check, name) {
    return { constraint: { check, name } } as never;
  },
  sql: sqlFn,
};

export const parseTableData = (
  dataFn?: TableDataFn<unknown, any>,
): TableData => {
  const tableData: TableData = {};
  if (dataFn) {
    const input = dataFn(tableDataMethods);
    if (Array.isArray(input)) {
      for (const item of input) {
        parseTableDataInput(tableData, item);
      }
    } else {
      parseTableDataInput(tableData, input);
    }
  }
  return tableData;
};

export const parseTableDataInput = (
  tableData: TableData,
  item: TableDataInput,
) => {
  if (item.primaryKey) {
    tableData.primaryKey = item.primaryKey;
  } else if (item.index) {
    (tableData.indexes ??= []).push(
      parseIndexOrExclude(item.index as TableData.Index),
    );
  } else if (item.exclude) {
    (tableData.excludes ??= []).push(
      parseIndexOrExclude(item.exclude as TableData.Exclude),
    );
  } else if (item.constraint) {
    (tableData.constraints ??= []).push(item.constraint);
    if (item.constraint.references?.options?.dropMode) {
      item.constraint.dropMode = item.constraint.references.options.dropMode;
    }
  }
};

const parseIndexOrExclude = <T extends TableData.Index | TableData.Exclude>(
  item: T,
): T => {
  for (let i = item.columns.length - 1; i >= 0; i--) {
    if (typeof item.columns[i] === 'string') {
      item.columns[i] = {
        column: item.columns[i] as unknown as string,
      };
    }
  }
  return item;
};
