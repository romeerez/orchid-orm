import { ColumnsShape } from './columnsSchema';
import { Query } from '../query/query';
import {
  ColumnDataBase,
  ColumnNameOfTable,
  ColumnTypeBase,
  ForeignKeyTable,
  MaybeArray,
  ErrorMessage,
  PrimaryKeyColumn,
  pushColumnData,
  QueryBaseCommon,
  RawSQLArgs,
  RawSQLBase,
  setColumnData,
  ValidationContext,
} from 'orchid-core';
import { TableData } from './columnTypes';
import { raw, RawSQL } from '../sql/rawSql';
import { BaseOperators } from './operators';
import { SearchWeight } from '../sql';

// type of data for ColumnType
export type ColumnData = ColumnDataBase & {
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
};

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
      fn(): new () => { table: Table; columns: ColumnsShape };
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
export type ForeignKeyOptions = {
  name?: string;
  match?: ForeignKeyMatch;
  onUpdate?: ForeignKeyAction;
  onDelete?: ForeignKeyAction;
  dropMode?: DropMode;
};

// Index options of a single column, is used in migrations.
export type IndexColumnOptions = (
  | { column: string }
  | { expression: string }
) & {
  collate?: string;
  opclass?: string;
  order?: string;
  // weight for a column in a search index
  weight?: SearchWeight;
};

// Options of the index, is used in migrations.
export type IndexOptions = {
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
  language?: string | RawSQLBase;
  // set the column with language for the tsVector
  languageColumn?: string;
  // create a tsVector index
  tsVector?: boolean;
};

// Options for the `index` method of a column.
export type SingleColumnIndexOptions = IndexColumnOptions & IndexOptions;

export type ColumnFromDbParams = {
  isNullable?: boolean;
  default?: string;
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
};

const knownDefaults: Record<string, string> = {
  current_timestamp: 'now()',
  'transaction_timestamp()': 'now()',
};

export const simplifyColumnDefault = (value?: string) => {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return new RawSQL(knownDefaults[lower] || value);
  }
  return;
};

export const instantiateColumn = (
  klass: new (...args: never[]) => ColumnType,
  params: ColumnFromDbParams,
): ColumnType => {
  const column = new (klass as unknown as new () => ColumnType)();

  Object.assign(column.data, {
    ...params,
    default: simplifyColumnDefault(params.default),
  });
  return column as unknown as ColumnType;
};

export abstract class ColumnType<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
  OutputType = Type,
  QueryType = Type,
> extends ColumnTypeBase<
  Type,
  Ops,
  InputType,
  OutputType,
  QueryType,
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
  primaryKey<T extends ColumnTypeBase>(this: T): PrimaryKeyColumn<T> {
    return setColumnData(
      this,
      'isPrimaryKey',
      true,
    ) as unknown as PrimaryKeyColumn<T>;
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
    T extends ColumnType,
    Table extends ForeignKeyTable,
    Column extends ColumnNameOfTable<Table>,
  >(
    this: T,
    fn: () => Table,
    column: Column,
    options?: ForeignKeyOptions,
  ): Omit<T, 'foreignKeyData'> & {
    foreignKeyData: ForeignKey<InstanceType<Table>['table'], [Column]>;
  };
  foreignKey<T extends ColumnType, Table extends string, Column extends string>(
    this: T,
    table: Table,
    column: Column,
    options?: ForeignKeyOptions,
  ): Omit<T, 'foreignKeyData'> & {
    foreignKeyData: ForeignKey<Table, [Column]>;
  };
  foreignKey(
    fnOrTable: (() => ForeignKeyTable) | string,
    column: string,
    options: ForeignKeyOptions = {},
  ) {
    const item =
      typeof fnOrTable === 'string'
        ? { table: fnOrTable, columns: [column], ...options }
        : { fn: fnOrTable, columns: [column], ...options };
    return pushColumnData(this, 'foreignKeys', item);
  }

  toSQL() {
    return this.dataType;
  }

  index<T extends ColumnType>(
    this: T,
    options: Omit<SingleColumnIndexOptions, 'column'> = {},
  ): T {
    return pushColumnData(this, 'indexes', options);
  }

  /**
   * `searchIndex` is designed for full text search.
   *
   * It can accept the same options as a regular `index`, but it is `USING GIN` by default, and it is concatenating columns into a `tsvector`.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.string(),
   *     body: t.string(),
   *     ...t.searchIndex(['title', 'body']),
   *   }));
   * });
   * ```
   *
   * Produces the following index ('english' is a default language, see [full text search](/guide/text-search.html#language) for changing it):
   *
   * ```sql
   * CREATE INDEX "table_title_body_idx" ON "table" USING GIN (to_tsvector('english', concat_ws(' ', "title", "body")))
   * ```
   *
   * Also, it works well with a generated `tsvector` column:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.string(),
   *     body: t.string(),
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
  searchIndex<T extends ColumnType>(
    this: T,
    options?: Omit<SingleColumnIndexOptions, 'tsVector'>,
  ): T {
    return pushColumnData(this, 'indexes', {
      ...options,
      ...(this.dataType === 'tsvector' ? { using: 'GIN' } : { tsVector: true }),
    });
  }

  unique<T extends ColumnType>(
    this: T,
    options: Omit<SingleColumnIndexOptions, 'column' | 'unique'> = {},
  ): T {
    return pushColumnData(this, 'indexes', { ...options, unique: true });
  }

  comment<T extends ColumnType>(this: T, comment: string): T {
    return setColumnData(this, 'comment', comment);
  }

  validationDefault<T extends ColumnType>(this: T, value: T['inputType']): T {
    return setColumnData(this, 'validationDefault', value as unknown);
  }

  compression<T extends ColumnType>(this: T, compression: string): T {
    return setColumnData(this, 'compression', compression);
  }

  collate<T extends ColumnType>(this: T, collate: string): T {
    return setColumnData(this, 'collate', collate);
  }

  modifyQuery<T extends ColumnType>(this: T, cb: (q: Query) => void): T {
    return setColumnData(
      this,
      'modifyQuery',
      cb as (q: QueryBaseCommon) => void,
    );
  }

  transform<T extends ColumnType, Transformed>(
    this: T,
    fn: (input: T['inputType'], ctx: ValidationContext) => Transformed,
  ): Omit<T, 'inputType'> & { inputType: Transformed } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['transform', fn]];
    return cloned as Omit<T, 'inputType'> & { inputType: Transformed };
  }

  to<T extends ColumnType, ToType extends ColumnType>(
    this: T,
    fn: (input: T['inputType']) => ToType['inputType'] | undefined,
    type: ToType,
  ): ToType {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['to', fn, type], ...cloned.chain];
    return cloned as ToType;
  }

  refine<T extends ColumnType, RefinedOutput extends T['inputType']>(
    this: T,
    check: (arg: T['inputType']) => unknown,
    params?: ErrorMessage,
  ): T & { type: RefinedOutput } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['refine', check, cloned]];

    if (typeof params === 'string' || params?.message) {
      cloned.data = {
        ...this.data,
        errors: {
          ...this.data.errors,
          refine: typeof params === 'string' ? params : params.message,
        },
      };
    }

    return cloned as T & { type: RefinedOutput };
  }

  superRefine<T extends ColumnType, RefinedOutput extends T['inputType']>(
    this: T,
    check: (arg: T['inputType'], ctx: ValidationContext) => unknown,
  ): T & { type: RefinedOutput } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['superRefine', check]];
    return cloned as T & { type: RefinedOutput };
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
  generated<T extends ColumnType>(this: T, ...args: RawSQLArgs): T {
    return setColumnData(this, 'generated', raw(...args));
  }
}
