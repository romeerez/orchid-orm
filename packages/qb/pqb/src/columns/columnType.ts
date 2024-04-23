import { Query } from '../query/query';
import {
  ColumnDataBase,
  ColumnNameOfTable,
  ColumnsShapeBase,
  ColumnTypeBase,
  ColumnTypeSchemaArg,
  emptyObject,
  ForeignKeyTable,
  MaybeArray,
  PickColumnBaseData,
  PrimaryKeyColumn,
  pushColumnData,
  QueryBaseCommon,
  RawSQLBase,
  setColumnData,
  StaticSQLArgs,
} from 'orchid-core';
import { TableData } from './columnTypes';
import { raw } from '../sql/rawSql';
import { SearchWeight } from '../sql';
import { BaseOperators } from './operators';

// type of data for ColumnType
export interface ColumnData extends ColumnDataBase {
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
  validationDefault?: unknown;
  indexes?: Omit<SingleColumnIndexOptions, 'column'>[];
  comment?: string;
  collate?: string;
  compression?: string;
  foreignKeys?: ForeignKey<string, string[]>[];
  identity?: TableData.Identity;
  // raw SQL for a generated column
  generated?: RawSQLBase;
}

/**
 * - MATCH FULL will not allow one column of a multicolumn foreign key to be null unless all foreign key columns are null;
 * if they are all null, the row is not required to have a match in the referenced table.
 * - MATCH SIMPLE (default) allows any of the foreign key columns to be null; if any of them are null, the row is not required to have a match in the referenced table.
 * - MATCH PARTIAL - PG docs say it's not implemented.
 */
export type ForeignKeyMatch = 'FULL' | 'PARTIAL' | 'SIMPLE';

/**
 * - NO ACTION Produce an error indicating that the deletion or update would create a foreign key constraint violation. If the constraint is deferred, this error will be produced at constraint check time if there still exist any referencing rows. This is the default action.
 * - RESTRICT Produce an error indicating that the deletion or update would create a foreign key constraint violation. This is the same as NO ACTION except that the check is not deferrable.
 * - CASCADE Delete any rows referencing the deleted row, or update the values of the referencing column(s) to the new values of the referenced columns, respectively.
 * - SET NULL Set all the referencing columns, or a specified subset of the referencing columns, to null. A subset of columns can only be specified for ON DELETE actions.
 * - SET DEFAULT Set all the referencing columns, or a specified subset of the referencing columns, to their default values. A subset of columns can only be specified for ON DELETE actions. (There must be a row in the referenced table matching the default values, if they are not null, or the operation will fail.)
 */
export type ForeignKeyAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';

// Foreign key type contains a foreign table (by function or a name), columns of this table, and foreign key options.
export type ForeignKey<Table extends string, Columns extends string[]> = (
  | {
      fn(): new () => {
        schema?: string;
        table: Table;
        columns: ColumnsShapeBase;
      };
    }
  | {
      table: Table;
    }
) & {
  columns: Columns;
} & ForeignKeyOptions;

// Used in migrations to also drop related entities if is set to CASCADE
export type DropMode = 'CASCADE' | 'RESTRICT';

// Used in migrations to make foreign key SQL
export interface ForeignKeyOptions {
  name?: string;
  match?: ForeignKeyMatch;
  onUpdate?: ForeignKeyAction;
  onDelete?: ForeignKeyAction;
  dropMode?: DropMode;
}

export interface IndexColumnOptionsForColumn {
  collate?: string;
  opclass?: string;
  order?: string;
  // weight for a column in a search index
  weight?: SearchWeight;
}

// Index options of a single column, is used in migrations.
export type IndexColumnOptions = ({ column: string } | { expression: string }) &
  IndexColumnOptionsForColumn;

// Options of the index, is used in migrations.
export interface IndexOptions {
  name?: string;
  unique?: boolean;
  nullsNotDistinct?: boolean;
  using?: string;
  include?: MaybeArray<string>;
  with?: string;
  tablespace?: string;
  where?: string;
  dropMode?: 'CASCADE' | 'RESTRICT';
  // set the language for the tsVector, 'english' is a default
  language?: string;
  // set the column with language for the tsVector
  languageColumn?: string;
  // create a tsVector index
  tsVector?: boolean;
}

export interface SingleColumnIndexOptionsForColumn
  extends IndexColumnOptionsForColumn,
    IndexOptions {}

// Options for the `index` method of a column.
export type SingleColumnIndexOptions = IndexColumnOptions & IndexOptions;

export interface ColumnFromDbParams {
  isNullable?: boolean;
  default?: string;
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
  compression?: string;
  collation?: string;
}

export interface PickColumnData {
  data: ColumnData;
}

export abstract class ColumnType<
  Schema extends ColumnTypeSchemaArg = ColumnTypeSchemaArg,
  Type = unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputSchema = any,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
  OutputType = Type,
  OutputSchema = InputSchema,
  QueryType = InputType,
  QuerySchema = InputSchema,
> extends ColumnTypeBase<
  Schema,
  Type,
  InputSchema,
  Ops,
  InputType,
  OutputType,
  OutputSchema,
  QueryType,
  QuerySchema,
  ColumnData
> {
  /**
   * Mark the column as a primary key.
   * This column type becomes an argument of the `.find` method.
   * So if the primary key is of `integer` type (`identity` or `serial`), `.find` will accept the number,
   * or if the primary key is of `UUID` type, `.find` will expect a string.
   *
   * Using `primaryKey` on a `uuid` column will automatically add a [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) default.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     id: t.uuid().primaryKey(),
   *   }));
   * }
   *
   * // primary key can be used by `find` later:
   * db.table.find('97ba9e78-7510-415a-9c03-23d440aec443');
   * ```
   */
  primaryKey<T extends PickColumnBaseData>(this: T): PrimaryKeyColumn<T> {
    return setColumnData(this, 'isPrimaryKey', true) as never;
  }

  /**
   * Set the foreignKey for the column.
   *
   * In `snakeCase` mode, columns of both tables are translated to a snake_case.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     otherId: t.integer().foreignKey('otherTableName', 'columnName'),
   *   }));
   * });
   * ```
   *
   * In the ORM specify a function returning a table class instead of a name:
   *
   * ```ts
   * export class SomeTable extends BaseTable {
   *   readonly table = 'someTable';
   *   columns = this.setColumns((t) => ({
   *     otherTableId: t.integer().foreignKey(() => OtherTable, 'id'),
   *   }));
   * }
   *
   * export class OtherTable extends BaseTable {
   *   readonly table = 'otherTable';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *   }));
   * }
   * ```
   *
   * Optionally you can pass the third argument to `foreignKey` with options:
   *
   * ```ts
   * type ForeignKeyOptions = {
   *   // name of the constraint
   *   name?: string;
   *   // see database docs for MATCH in FOREIGN KEY
   *   match?: 'FULL' | 'PARTIAL' | 'SIMPLE';
   *
   *   onUpdate?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
   *   onDelete?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
   * };
   * ```
   *
   * ## composite foreign key
   *
   * Set foreign key from multiple columns in the current table to corresponding columns in the other table.
   *
   * The first argument is an array of columns in the current table, the second argument is another table name, the third argument is an array of columns in another table, and the fourth argument is for options.
   *
   * Options are the same as in a single-column foreign key.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.integer(),
   *     name: t.string(),
   *     ...t.foreignKey(
   *       ['id', 'name'],
   *       'otherTable',
   *       ['foreignId', 'foreignName'],
   *       {
   *         name: 'constraintName',
   *         match: 'FULL',
   *         onUpdate: 'RESTRICT',
   *         onDelete: 'CASCADE',
   *       },
   *     ),
   *   }));
   * });
   * ```
   *
   * @param fn - function returning a table class
   * @param column - column in the foreign table to connect with
   * @param options - {@link ForeignKeyOptions}
   */
  foreignKey<
    T,
    Table extends ForeignKeyTable,
    Column extends ColumnNameOfTable<Table>,
  >(
    this: T,
    fn: () => Table,
    column: Column,
    options?: ForeignKeyOptions,
  ): {
    [K in keyof T]: T extends 'foreignKeyData'
      ? ForeignKey<InstanceType<Table>['table'], [Column]>
      : T[K];
  };
  foreignKey<T, Table extends string, Column extends string>(
    this: T,
    table: Table,
    column: Column,
    options?: ForeignKeyOptions,
  ): {
    [K in keyof T]: K extends 'foreignKeyData'
      ? ForeignKey<Table, [Column]>
      : T[K];
  };
  foreignKey(
    fnOrTable: (() => ForeignKeyTable) | string,
    column: string,
    options: ForeignKeyOptions = emptyObject,
  ) {
    const item =
      typeof fnOrTable === 'string'
        ? { table: fnOrTable, columns: [column], ...options }
        : { fn: fnOrTable, columns: [column], ...options };
    return pushColumnData(this, 'foreignKeys', item);
  }

  toSQL(): string {
    return this.dataType;
  }

  index<T extends PickColumnData>(
    this: T,
    options: SingleColumnIndexOptionsForColumn = {},
  ): T {
    return pushColumnData(this, 'indexes', options);
  }

  /**
   * `searchIndex` is designed for [full text search](/guide/text-search).
   *
   * It can accept the same options as a regular `index`, but it is `USING GIN` by default, and it is concatenating columns into a `tsvector` database type.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex(['title', 'body']),
   *   }));
   * });
   * ```
   *
   * Produces the following index ('english' is a default language, see [full text search](/guide/text-search.html#language) for changing it):
   *
   * ```sql
   * CREATE INDEX "table_title_body_idx" ON "table" USING GIN (to_tsvector('english', "title" || ' ' || "body"))
   * ```
   *
   * You can set different search weights (`A` to `D`) on different columns inside the index:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex([
   *       { column: 'title', weight: 'A' },
   *       { column: 'body', weight: 'B' },
   *     ]),
   *   }));
   * });
   * ```
   *
   * When the table has localized columns,
   * you can define different indexes for different languages by setting the `language` parameter:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     titleEn: t.text(),
   *     bodyEn: t.text(),
   *     titleFr: t.text(),
   *     bodyFr: t.text(),
   *     ...t.searchIndex(['titleEn', 'bodyEn'], { language: 'english' }),
   *     ...t.searchIndex(['titleFr', 'bodyFr'], { language: 'french' }),
   *   }));
   * });
   * ```
   *
   * Alternatively, different table records may correspond to a single language,
   * then you can define a search index that relies on a language column by using `languageColumn` parameter:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     lang: t.type('regconfig'),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex(['title', 'body'], { languageColumn: 'lang' }),
   *   }));
   * });
   * ```
   *
   * It can be more efficient to use a [generated](/guide/migration-column-methods.html#generated-column) column instead of indexing text column in the way described above,
   * and to set a `searchIndex` on it:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
   *   }));
   * });
   * ```
   *
   * Produces the following index:
   *
   * ```sql
   * CREATE INDEX "table_generatedTsVector_idx" ON "table" USING GIN ("generatedTsVector")
   * ```
   *
   * @param options - index options
   */
  searchIndex<T extends Pick<ColumnType, 'data' | 'dataType'>>(
    this: T,
    options?: Omit<IndexOptions, 'tsVector'>,
  ): T {
    return pushColumnData(this, 'indexes', {
      ...options,
      ...(this.dataType === 'tsvector' ? { using: 'GIN' } : { tsVector: true }),
    });
  }

  unique<T extends PickColumnData>(
    this: T,
    options: Omit<SingleColumnIndexOptionsForColumn, 'unique'> = {},
  ): T {
    return pushColumnData(this, 'indexes', { ...options, unique: true });
  }

  comment<T extends PickColumnData>(this: T, comment: string): T {
    return setColumnData(this, 'comment', comment);
  }

  compression<T extends PickColumnData>(this: T, compression: string): T {
    return setColumnData(this, 'compression', compression);
  }

  collate<T extends PickColumnData>(this: T, collate: string): T {
    return setColumnData(this, 'collate', collate);
  }

  modifyQuery<T extends PickColumnData>(this: T, cb: (q: Query) => void): T {
    return setColumnData(
      this,
      'modifyQuery',
      cb as (q: QueryBaseCommon) => void,
    );
  }

  /**
   * Define a generated column. `generated` accepts a raw SQL.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     two: t.integer().generated`1 + 1`,
   *   }));
   * });
   * ```
   *
   * @param args - raw SQL
   */
  generated<T extends PickColumnData>(this: T, ...args: StaticSQLArgs): T {
    return setColumnData(this, 'generated', raw(...args));
  }
}
