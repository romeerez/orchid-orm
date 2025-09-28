import {
  ColumnsShape,
  ColumnType,
  createDbWithAdapter,
  DbDomainArg,
  DbResult,
  EnumColumn,
  logParamToLogObject,
  escapeForMigration,
  raw,
  TableData,
  TableDataFn,
  TableDataItem,
} from 'pqb';
import {
  AdapterBase,
  ColumnSchemaConfig,
  emptyObject,
  MaybeArray,
  QueryLogObject,
  RawSQLBase,
  RecordString,
  RecordUnknown,
  singleQuote,
  toSnakeCase,
} from 'orchid-core';
import { createTable, CreateTableResult } from './createTable';
import { changeTable, TableChangeData, TableChanger } from './changeTable';
import {
  getSchemaAndTableFromName,
  quoteNameFromString,
  quoteTable,
  quoteWithSchema,
} from '../common';
import { RakeDbAst } from '../ast';
import {
  columnTypeToSql,
  encodeColumnDefault,
  interpolateSqlValues,
} from './migration.utils';
import { createView } from './createView';
import { RakeDbConfig } from '../config';

// Drop mode to use when dropping various database entities.
export type DropMode = 'CASCADE' | 'RESTRICT';

// Options for creating a table.
export type TableOptions = {
  // create the table only if it not exists already
  createIfNotExists?: boolean;
  // drop the table only if it exists
  dropIfExists?: boolean;
  // Drop mode to use when dropping the table.
  dropMode?: DropMode;
  // Create a table with a database comment on it.
  comment?: string;
  // Ignore the absence of a primary key. Will throw otherwise.
  noPrimaryKey?: boolean;
  // Translate columns name into snake case
  snakeCase?: boolean;
  language?: string;
};

// Overridden column types to simplify and adapt some column types for a migration.
export type MigrationColumnTypes<CT> = Omit<CT, 'enum'> & {
  enum: (
    name: string,
  ) => EnumColumn<ColumnSchemaConfig, unknown, readonly string[]>;
};

// Create table callback
export type ColumnsShapeCallback<
  CT,
  Shape extends ColumnsShape = ColumnsShape,
> = (t: MigrationColumnTypes<CT> & { raw: typeof raw }) => Shape;

// Options for changing a table
export type ChangeTableOptions = {
  snakeCase?: boolean;
  language?: string;
  comment?: string | [string, string] | null;
};

// Callback for a table change
export type ChangeTableCallback<CT> = (t: TableChanger<CT>) => TableChangeData;

// DTO for column comments
export type ColumnComment = { column: string; comment: string | null };

// Database adapter methods to perform queries without logging
export type SilentQueries = {
  // Query without logging
  silentQuery: AdapterBase['query'];
  // Query arrays without logging
  silentArrays: AdapterBase['arrays'];
};

// Combined queryable database instance and a migration interface
export type DbMigration<CT> = DbResult<CT> &
  Migration<CT> & {
    // Add `SilentQueries` to an existing `adapter` type in the `DbResult`
    adapter: SilentQueries;
  };

/**
 * Creates a new `db` instance that is an instance of `pqb` with mixed in migration methods from the `Migration` class.
 * It overrides `query` and `array` db adapter methods to intercept SQL for the logging.
 *
 * @param tx - database adapter that executes inside a transaction
 * @param up - migrate or rollback
 * @param config - config of `rakeDb`
 */
export const createMigrationInterface = <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  tx: AdapterBase,
  up: boolean,
  config: RakeDbConfig<SchemaConfig, CT>,
): DbMigration<CT> => {
  const adapter = Object.create(tx) as MigrationAdapter;
  adapter.schema = adapter.getSchema() ?? 'public';

  const { query, arrays } = adapter;
  const log = logParamToLogObject(config.logger || console, config.log);

  adapter.query = ((text, values) => {
    return wrapWithLog(log, text, values, () =>
      query.call(adapter, text, values),
    );
  }) as typeof adapter.query;

  adapter.arrays = ((text, values) => {
    return wrapWithLog(log, text, values, () =>
      arrays.call(adapter, text, values),
    );
  }) as typeof adapter.arrays;

  Object.assign(adapter, { silentQuery: query, silentArrays: arrays });

  const db = createDbWithAdapter({
    adapter,
    columnTypes: config.columnTypes,
  }) as unknown as DbMigration<CT>;

  const { prototype: proto } = Migration;
  for (const key of Object.getOwnPropertyNames(proto)) {
    (db as unknown as RecordUnknown)[key] = proto[key as keyof typeof proto];
  }

  return Object.assign(db, {
    adapter,
    log,
    up,
    options: config,
  });
};

export interface MigrationAdapter extends AdapterBase {
  schema: string;
}

// Migration interface to use inside the `change` callback.
export class Migration<CT> {
  // Database adapter to perform queries with.
  public adapter!: MigrationAdapter;
  // The logger config.
  public log?: QueryLogObject;
  // Is migrating or rolling back.
  public up!: boolean;
  // `rakeDb` config.
  public options!: RakeDbConfig<ColumnSchemaConfig>;
  // Available column types that may be customized by a user.
  // They are pulled from a `baseTable` or a `columnTypes` option of the `rakeDb` config.
  public columnTypes!: CT;

  /**
   * `createTable` accepts a string for a table name, optional options, and a callback to specify columns.
   *
   * `dropTable` accepts the same arguments, it will drop the table when migrating and create a table when rolling back.
   *
   * To create an empty table, the callback with columns may be omitted.
   *
   * When creating a table within a specific schema, write the table name with schema name: `'schemaName.tableName'`.
   *
   * Returns object `{ table: TableInterface }` that allows to insert records right after creating a table.
   *
   * Options are:
   *
   * ```ts
   * type TableOptions = {
   *   // create the table only if it not exists already
   *   createIfNotExists?: boolean;
   *
   *   // drop the table only if it exists
   *   dropIfExists?: boolean;
   *
   *   // used when reverting a `createTable`
   *   dropMode?: 'CASCADE' | 'RESTRICT';
   *
   *   // add a database comment on the table
   *   comment?: string;
   *
   *   // by default, it will throw an error when the table has no primary key
   *   // set `noPrimaryKey` to `true` to bypass it
   *   noPrimaryKey?: boolean;
   *
   *   // override rakeDb `snakeCase` option for only this table
   *   snakeCase?: boolean;
   * };
   * ```
   *
   * Example:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db, up) => {
   *   // call `createTable` with options
   *   await db.createTable(
   *     'table',
   *     {
   *       comment: 'Table comment',
   *       dropMode: 'CASCADE',
   *       noPrimaryKey: true,
   *     },
   *     (t) => ({
   *       // ...
   *     }),
   *   );
   *
   *   // call without options
   *   const { table } = await db.createTable('user', (t) => ({
   *     id: t.identity().primaryKey(),
   *     email: t.text().unique(),
   *     name: t.text(),
   *     active: t.boolean().nullable(),
   *     ...t.timestamps(),
   *   }));
   *
   *   // create records only when migrating up
   *   if (up) {
   *     // table is a db table interface, all query methods are available
   *     await table.createMany([...data]);
   *   }
   * });
   * ```
   *
   * @param tableName - name of the table to create
   * @param fn - create table callback
   * @param dataFn - callback for creating composite indexes, primary keys, foreign keys
   */
  createTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    fn?: ColumnsShapeCallback<CT, Shape>,
    dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>,
  ): Promise<CreateTableResult<Table, Shape>>;
  /**
   * See {@link createTable}
   *
   * @param tableName - name of the table to create
   * @param options - {@link TableOptions}
   * @param fn - create table callback
   * @param dataFn - callback for creating composite indexes, primary keys, foreign keys
   */
  createTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    options: TableOptions,
    fn?: ColumnsShapeCallback<CT, Shape>,
    dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>,
  ): Promise<CreateTableResult<Table, Shape>>;
  createTable(
    tableName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    first?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    second?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    third?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return createTable(this, this.up, tableName, first, second, third);
  }

  /**
   * Drop the table, create it on rollback. See {@link createTable}.
   *
   * @param tableName - name of the table to drop
   * @param fn - create table callback
   * @param dataFn - callback for creating composite indexes, primary keys, foreign keys
   */
  dropTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    fn?: ColumnsShapeCallback<CT, Shape>,
    dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>,
  ): Promise<CreateTableResult<Table, Shape>>;
  /**
   * Drop the table, create it on rollback. See {@link createTable}.
   *
   * @param tableName - name of the table to drop
   * @param options - {@link TableOptions}
   * @param fn - create table callback
   * @param dataFn - callback for creating composite indexes, primary keys, foreign keys
   */
  dropTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    options: TableOptions,
    fn?: ColumnsShapeCallback<CT, Shape>,
    dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>,
  ): Promise<CreateTableResult<Table, Shape>>;
  dropTable(
    tableName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    first?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    second?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    third?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return createTable(this, !this.up, tableName, first, second, third);
  }

  /**
   * `changeTable` accepts a table name, optional options, and a special callback with column changes.
   *
   * When changing a table within a specific schema, write the table name with schema name: `'schemaName.tableName'`.
   *
   * Options are:
   *
   * ```ts
   * type ChangeTableOptions = {
   *   comment?:
   *     | // add a comment to the table on migrating, remove a comment on rollback
   *     string // change comment from first to second on migrating, from second to first on rollback
   *     | [string, string] // remove a comment on both migrate and rollback
   *     | null;
   *
   *   // override rakeDb `snakeCase` option for only this table
   *   snakeCase?: boolean;
   * };
   * ```
   *
   * The callback of the `changeTable` is different from `createTable` in the way that it expects columns to be wrapped in change methods such as `add`, `drop`, and `change`.
   *
   * @param tableName - name of the table to change (ALTER)
   * @param fn - change table callback
   */
  changeTable(tableName: string, fn: ChangeTableCallback<CT>): Promise<void>;
  /**
   * See {@link changeTable}
   *
   * @param tableName - name of the table to change (ALTER)
   * @param options - change table options
   * @param fn - change table callback
   */
  changeTable(
    tableName: string,
    options: ChangeTableOptions,
    fn?: ChangeTableCallback<CT>,
  ): Promise<void>;
  changeTable(
    tableName: string,
    cbOrOptions: ChangeTableCallback<CT> | ChangeTableOptions,
    cb?: ChangeTableCallback<CT>,
  ): Promise<void> {
    const [fn, options] =
      typeof cbOrOptions === 'function' ? [cbOrOptions, {}] : [cb, cbOrOptions];

    return changeTable(this, this.up, tableName, options, fn);
  }

  /**
   * Rename a table:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameTable('oldTableName', 'newTableName');
   * });
   * ```
   *
   * Prefix table name with a schema to set a different schema:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameTable('fromSchema.oldTable', 'toSchema.newTable');
   * });
   * ```
   *
   * @param from - rename the table from
   * @param to - rename the table to
   */
  renameTable(from: string, to: string): Promise<void> {
    return renameType(this, from, to, 'TABLE');
  }

  /**
   * Set a different schema to the table:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.changeTableSchema('tableName', 'fromSchema', 'toSchema');
   * });
   * ```
   *
   * @param table - table name
   * @param from - current table schema
   * @param to - desired table schema
   */
  changeTableSchema(table: string, from: string, to: string) {
    return this.renameTable(`${from}.${table}`, `${to}.${table}`);
  }

  /**
   * Add a column to the table on migrating, and remove it on rollback.
   *
   * `dropColumn` takes the same arguments, removes a column on migrate, and adds it on rollback.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.addColumn('tableName', 'columnName', (t) =>
   *     t.integer().index().nullable(),
   *   );
   * });
   * ```
   *
   * @param tableName - name of the table to add the column to
   * @param columnName - name of the column to add
   * @param fn - function returning a type of the column
   */
  addColumn(
    tableName: string,
    columnName: string,
    fn: (t: MigrationColumnTypes<CT>) => ColumnType,
  ): Promise<void> {
    return addColumn(this, this.up, tableName, columnName, fn);
  }

  /**
   * Drop the schema, create it on rollback. See {@link addColumn}.
   *
   * @param tableName - name of the table to add the column to
   * @param columnName - name of the column to add
   * @param fn - function returning a type of the column
   */
  dropColumn(
    tableName: string,
    columnName: string,
    fn: (t: MigrationColumnTypes<CT>) => ColumnType,
  ): Promise<void> {
    return addColumn(this, !this.up, tableName, columnName, fn);
  }

  /**
   * Add an index to the table on migrating, and remove it on rollback.
   *
   * `dropIndex` takes the same arguments, removes the index on migrate, and adds it on rollback.
   *
   * The first argument is the table name, other arguments are the same as in [composite index](#composite-index).
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.addIndex(
   *     'tableName',
   *     ['column1', { column: 'column2', order: 'DESC' }],
   *     {
   *       name: 'indexName',
   *     },
   *   );
   * });
   * ```
   *
   * @param tableName - name of the table to add the index for
   * @param columns - indexed columns
   * @param args - index options, or an index name and then options
   */
  addIndex(
    tableName: string,
    columns: (string | TableData.Index.ColumnOrExpressionOptions<string>)[],
    ...args:
      | [options?: TableData.Index.OptionsArg]
      | [name?: string, options?: TableData.Index.OptionsArg]
  ): Promise<void> {
    return addIndex(this, this.up, tableName, columns, args);
  }

  /**
   * Drop the schema, create it on rollback. See {@link addIndex}.
   *
   * @param tableName - name of the table to add the index for
   * @param columns - indexed columns
   * @param args - index options, or an index name and then options
   */
  dropIndex(
    tableName: string,
    columns: (string | TableData.Index.ColumnOrExpressionOptions<string>)[],
    ...args:
      | [options?: TableData.Index.OptionsArg]
      | [name?: string, options?: TableData.Index.OptionsArg]
  ): Promise<void> {
    return addIndex(this, !this.up, tableName, columns, args);
  }

  /**
   * Rename index:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   // tableName can be prefixed with a schema
   *   await db.renameIndex('tableName', 'oldIndexName', 'newIndexName');
   * });
   * ```
   *
   * @param tableName - table which this index belongs to
   * @param from - rename the index from
   * @param to - rename the index to
   */
  renameIndex(tableName: string, from: string, to: string): Promise<void> {
    return renameTableItem(this, tableName, from, to, 'INDEX');
  }

  /**
   * Add a foreign key to a table on migrating, and remove it on rollback.
   *
   * `dropForeignKey` takes the same arguments, removes the foreign key on migrate, and adds it on rollback.
   *
   * Arguments:
   *
   * - table name
   * - column names in the table
   * - other table name
   * - column names in the other table
   * - options:
   *   - `name`: constraint name
   *   - `match`: 'FULL', 'PARTIAL', or 'SIMPLE'
   *   - `onUpdate` and `onDelete`: 'NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', or 'SET DEFAULT'
   *
   * The first argument is the table name, other arguments are the same as in [composite foreign key](#composite-foreign-key).
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.addForeignKey(
   *     'tableName',
   *     ['id', 'name'],
   *     'otherTable',
   *     ['foreignId', 'foreignName'],
   *     {
   *       name: 'constraintName',
   *       match: 'FULL',
   *       onUpdate: 'RESTRICT',
   *       onDelete: 'CASCADE',
   *     },
   *   );
   * });
   * ```
   *
   * @param tableName - table name
   * @param columns - column names in the table
   * @param foreignTable - other table name
   * @param foreignColumns - column names in the other table
   * @param options - foreign key options
   */
  addForeignKey(
    tableName: string,
    columns: [string, ...string[]],
    foreignTable: string,
    foreignColumns: [string, ...string[]],
    options?: TableData.References.Options,
  ): Promise<void> {
    return addForeignKey(
      this,
      this.up,
      tableName,
      columns,
      foreignTable,
      foreignColumns,
      options,
    );
  }

  /**
   * Drop the schema, create it on rollback. See {@link addForeignKey}.
   *
   * @param tableName - table name
   * @param columns - column names in the table
   * @param foreignTable - other table name
   * @param foreignColumns - column names in the other table
   * @param options - foreign key options
   */
  dropForeignKey(
    tableName: string,
    columns: [string, ...string[]],
    foreignTable: string,
    foreignColumns: [string, ...string[]],
    options?: TableData.References.Options,
  ): Promise<void> {
    return addForeignKey(
      this,
      !this.up,
      tableName,
      columns,
      foreignTable,
      foreignColumns,
      options,
    );
  }

  /**
   * Add a primary key to a table on migrate, and remove it on rollback.
   *
   * `dropPrimaryKey` takes the same arguments, removes the primary key on migrate, and adds it on rollback.
   *
   * First argument is a table name, second argument is an array of columns.
   * The optional third argument may have a name for the primary key constraint.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.addPrimaryKey('tableName', ['id', 'name'], {
   *     name: 'tablePkeyName',
   *   });
   * });
   * ```
   *
   * @param tableName - name of the table
   * @param columns - array of the columns
   * @param name - optionally, set a primary key constraint name
   */
  addPrimaryKey(
    tableName: string,
    columns: [string, ...string[]],
    name?: string,
  ): Promise<void> {
    return addPrimaryKey(this, this.up, tableName, columns, name);
  }

  /**
   * Drop the schema, create it on rollback. See {@link addPrimaryKey}.
   *
   * @param tableName - name of the table
   * @param columns - array of the columns
   * @param name - optionally, set a primary key constraint name
   */
  dropPrimaryKey(
    tableName: string,
    columns: [string, ...string[]],
    name?: string,
  ): Promise<void> {
    return addPrimaryKey(this, !this.up, tableName, columns, name);
  }

  /**
   * Add or drop a check for multiple columns.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.addCheck('tableName', t.sql`column > 123`);
   * });
   * ```
   *
   * @param tableName - name of the table to add the check into
   * @param check - raw SQL for the check
   */
  addCheck(tableName: string, check: RawSQLBase): Promise<void> {
    return addCheck(this, this.up, tableName, check);
  }

  /**
   * Drop the schema, create it on rollback. See {@link addCheck}.
   *
   * @param tableName - name of the table to add the check into
   * @param check - raw SQL for the check
   */
  dropCheck(tableName: string, check: RawSQLBase): Promise<void> {
    return addCheck(this, !this.up, tableName, check);
  }

  /**
   * Rename a table constraint such as a primary key or a database check.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameConstraint(
   *     'tableName', // may include schema: 'schema.table'
   *     'oldConstraintName',
   *     'newConstraintName',
   *   );
   * });
   * ```
   *
   * @param tableName - name of the table containing the constraint, may include schema name, may include schema name
   * @param from - current name of the constraint
   * @param to - desired name
   */
  renameConstraint(tableName: string, from: string, to: string): Promise<void> {
    return renameTableItem(this, tableName, from, to, 'CONSTRAINT');
  }

  /**
   * Rename a column:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameColumn('tableName', 'oldColumnName', 'newColumnName');
   * });
   * ```
   *
   * @param tableName - name of the table to rename the column in
   * @param from - rename column from
   * @param to - rename column to
   */
  renameColumn(tableName: string, from: string, to: string): Promise<void> {
    return this.changeTable(tableName, (t) => ({
      [from]: t.rename(to),
    }));
  }

  /**
   * `createSchema` creates a database schema, and removes it on rollback.
   *
   * `dropSchema` takes the same arguments, removes schema on migration, and adds it on rollback.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createSchema('schemaName');
   * });
   * ```
   *
   * @param schemaName - name of the schema
   */
  createSchema(schemaName: string): Promise<void> {
    return createSchema(this, this.up, schemaName);
  }

  /**
   * Renames a database schema, renames it backwards on roll back.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameSchema('from', 'to');
   * });
   * ```
   *
   * @param from - existing schema to rename
   * @param to - desired schema name
   */
  async renameSchema(from: string, to: string): Promise<void> {
    await this.adapter.query(
      `ALTER SCHEMA "${this.up ? from : to}" RENAME TO "${
        this.up ? to : from
      }"`,
    );
  }

  /**
   * Drop the schema, create it on rollback. See {@link createSchema}.
   *
   * @param schemaName - name of the schema
   */
  dropSchema(schemaName: string): Promise<void> {
    return createSchema(this, !this.up, schemaName);
  }

  /**
   * `createExtension` creates a database extension, and removes it on rollback.
   *
   * `dropExtension` takes the same arguments, removes the extension on migrate, and adds it on rollback.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createExtension('pg_trgm');
   * });
   * ```
   *
   * @param name - name of the extension
   * @param options - extension options
   */
  createExtension(
    name: string,
    options?: RakeDbAst.ExtensionArg,
  ): Promise<void> {
    return createExtension(this, this.up, name, options);
  }

  /**
   * Drop the extension, create it on rollback. See {@link createExtension}.
   *
   * @param name - name of the extension
   * @param options - extension options
   */
  dropExtension(name: string, options?: RakeDbAst.ExtensionArg): Promise<void> {
    return createExtension(this, !this.up, name, options);
  }

  /**
   * `createEnum` creates an enum on migrate, drops it on rollback.
   *
   * `dropEnum` does the opposite.
   *
   * Third argument for options is optional.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createEnum('number', ['one', 'two', 'three']);
   *
   *   // use `schemaName.enumName` format to specify a schema
   *   await db.createEnum('customSchema.mood', ['sad', 'ok', 'happy'], {
   *     // following options are used when dropping enum
   *     dropIfExists: true,
   *     cascade: true,
   *   });
   * });
   * ```
   *
   * @param name - name of the enum
   * @param values - possible enum values
   * @param options - enum options
   */
  createEnum(
    name: string,
    values: [string, ...string[]],
    options?: Omit<
      RakeDbAst.Enum,
      'type' | 'action' | 'name' | 'values' | 'schema'
    >,
  ): Promise<void> {
    return createEnum(this, this.up, name, values, options);
  }

  /**
   * Drop the enum, create it on rollback. See {@link createEnum}.
   *
   * @param name - name of the enum
   * @param values - possible enum values
   * @param options - enum options
   */
  dropEnum(
    name: string,
    values: [string, ...string[]],
    options?: Omit<
      RakeDbAst.Enum,
      'type' | 'action' | 'name' | 'values' | 'schema'
    >,
  ): Promise<void> {
    return createEnum(this, !this.up, name, values, options);
  }

  /**
   * Use these methods to add or drop one or multiple values from an existing enum.
   *
   * `addEnumValues` will drop values when rolling back the migration.
   *
   * Dropping a value internally acts in multiple steps:
   *
   * 1. Select all columns from the database that depends on the enum;
   * 2. Alter all these columns to have text type;
   * 3. Drop the enum;
   * 4. Re-create the enum without the value given;
   * 5. Alter all columns from the first step to have the enum type;
   *
   * In the case when the value is used by some table,
   * migrating `dropEnumValue` or rolling back `addEnumValue` will throw an error with a descriptive message,
   * in such case you'd need to manually resolve the issue by deleting rows with the value, or changing such values.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.addEnumValue('numbers', 'four');
   *
   *   // you can pass options
   *   await db.addEnumValue('numbers', 'three', {
   *     // where to insert
   *     before: 'four',
   *     // skip if already exists
   *     ifNotExists: true,
   *   });
   *
   *   // enum name can be prefixed with schema
   *   await db.addEnumValue('public.numbers', 'five', {
   *     after: 'four',
   *   });
   * });
   * ```
   *
   * @param enumName - target enum name
   * @param values - array of values to add
   * @param options - optional object with options
   * @param options.before - insert before the specified value
   * @param options.after - insert after the specified value
   * @param options.ifNotExists - skip adding if already exists
   */
  addEnumValues(
    enumName: string,
    values: string[],
    options?: AddEnumValueOptions,
  ): Promise<void> {
    return addOrDropEnumValues(this, this.up, enumName, values, options);
  }

  /**
   * See {@link addEnumValues}
   */
  dropEnumValues(
    enumName: string,
    values: string[],
    options?: AddEnumValueOptions,
  ): Promise<void> {
    return addOrDropEnumValues(this, !this.up, enumName, values, options);
  }

  /**
   * Rename one or multiple enum values using this method:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   // rename value "from" to "to"
   *   await db.rename('numbers', { from: 'to' });
   *
   *   // enum name can be prefixed with schema
   *   await db.rename('public.numbers', { from: 'to' });
   * });
   * ```
   *
   * @param enumName - target enum name, can be prefixed with schema
   * @param values - object where keys are for old names, values are for new names
   */
  async renameEnumValues(
    enumName: string,
    values: RecordString,
  ): Promise<void> {
    const [schema, name] = getSchemaAndTableFromName(enumName);

    const ast: RakeDbAst.RenameEnumValues = {
      type: 'renameEnumValues',
      schema,
      name,
      values,
    };

    for (const pair of Object.entries(ast.values)) {
      const [from, to] = this.up ? pair : [pair[1], pair[0]];
      await this.adapter.query(
        `ALTER TYPE ${quoteTable(
          ast.schema,
          ast.name,
        )} RENAME VALUE "${from}" TO "${to}"`,
      );
    }
  }

  /**
   * Drops the enum and re-creates it with a new set of values.
   * Before dropping, changes all related column types to text, and after creating changes types back to the enum,
   * in the same way as [dropEnumValues](/guide/migration-writing.html#addenumvalues,-dropenumvalues) works.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.changeEnumValues(
   *     // can be prefixed with schema: 'public.numbers'
   *     'numbers',
   *     // change from:
   *     ['one', 'two'],
   *     // change to:
   *     ['three', 'four'],
   *   );
   * });
   * ```
   *
   * @param enumName - target enum name, can be prefixed with schema
   * @param fromValues - array of values before the change
   * @param toValues - array of values to set
   */
  changeEnumValues(
    enumName: string,
    fromValues: string[],
    toValues: string[],
  ): Promise<void> {
    return changeEnumValues(this, enumName, fromValues, toValues);
  }

  /**
   * Rename a type (such as enum):
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameType('oldTypeName', 'newTypeName');
   * });
   * ```
   *
   * Prefix the type name with a schema to set a different schema:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameType('fromSchema.oldType', 'toSchema.newType');
   * });
   * ```
   *
   * @param from - rename the type from
   * @param to - rename the type to
   */
  renameType(from: string, to: string): Promise<void> {
    return renameType(this, from, to, 'TYPE');
  }

  /**
   * Set a different schema to the type (such as enum):
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.changeTypeSchema('typeName', 'fromSchema', 'toSchema');
   * });
   * ```
   *
   * @param name - type name
   * @param from - current table schema
   * @param to - desired table schema
   */
  changeTypeSchema(name: string, from: string, to: string): Promise<void> {
    return this.renameType(`${from}.${name}`, `${to}.${name}`);
  }

  /**
   * Domain is a custom database type that is based on other type and can include `NOT NULL` and a `CHECK` (see [postgres tutorial](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)).
   *
   * Construct a column type in the function as the second argument.
   *
   * Specifiers [nullable](/guide/common-column-methods.html#nullable), [default](/guide/common-column-methods.html#default), [check](/guide/migration-column-methods.html#check), [collate](/guide/migration-column-methods.html#collate)
   * will be saved to the domain type on database level.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createDomain('domainName', (t) =>
   *     t.integer().check(t.sql`value = 42`),
   *   );
   *
   *   // use `schemaName.domainName` format to specify a schema
   *   await db.createDomain('schemaName.domainName', (t) =>
   *     t
   *       .text()
   *       .nullable()
   *       .collate('C')
   *       .default('default text')
   *       .check(t.sql`length(value) > 10`),
   *   );
   * });
   * ```
   *
   * @param name - name of the domain
   * @param fn - function returning a column type. Options `nullable`, `collate`, `default`, `check` will be applied to domain
   */
  createDomain(name: string, fn: DbDomainArg<CT>): Promise<void> {
    return createDomain(this, this.up, name, fn);
  }

  /**
   * Drop the domain, create it on rollback. See {@link dropDomain}.
   *
   * @param name - name of the domain
   * @param fn - function returning a column type. Options `nullable`, `collate`, `default`, `check` will be applied to domain
   */
  dropDomain(name: string, fn: DbDomainArg<CT>): Promise<void> {
    return createDomain(this, !this.up, name, fn);
  }

  /**
   * To rename a domain:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.renameDomain('oldName', 'newName');
   *
   *   // to move domain to a different schema
   *   await db.renameDomain('oldSchema.domain', 'newSchema.domain');
   * });
   * ```
   *
   * @param from - old domain name (can include schema)
   * @param to - new domain name (can include schema)
   */
  renameDomain(from: string, to: string): Promise<void> {
    return renameType(this, from, to, 'DOMAIN');
  }

  /**
   * Create and drop a database collation, (see [Postgres docs](https://www.postgresql.org/docs/current/sql-createcollation.html)).
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createCollation('myCollation', {
   *     // This is a shortcut for setting lcCollate and lcCType at once.
   *     locale: 'en-u-kn-true',
   *
   *     // set `lcType` and `lcCType` only if the `locale` is not set.
   *     // lcType: 'C',
   *     // lcCType: 'C',
   *
   *     // provider can be 'icu' or 'libc'. 'libc' is a default.
   *     provider: 'icu',
   *
   *     // true by default, false is only supported with 'icu' provider.
   *     deterministic: true,
   *
   *     // Is intended to by used by `pg_upgrade`. Normally, it should be omitted.
   *     version: '1.2.3',
   *
   *     // For `CREATE IF NOT EXISTS` when creating.
   *     createIfNotExists: true,
   *
   *     // For `DROP IF EXISTS` when dropping.
   *     dropIfExists: true,
   *
   *     // For `DROP ... CASCADE` when dropping.
   *     cascase: true,
   *   });
   * });
   * ```
   *
   * Instead of specifying the collation options, you can specify a collation to copy options from.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createCollation('myCollation', {
   *     fromExisting: 'otherCollation',
   *   });
   * });
   * ```
   *
   * To create a collation withing a specific database schema, prepend it to the collation name:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createCollation('schemaName.myCollation', {
   *     // `fromExisting` also can accept a collation name with a schema.
   *     fromExisting: 'schemaName.otherCollation',
   *   });
   * });
   * ```
   *
   * @param name - name of the collation, can contain a name of schema separated with a dot.
   * @param options - options to create and drop the collation.
   */
  createCollation(
    name: string,
    options: Omit<RakeDbAst.Collation, 'type' | 'action' | 'schema' | 'name'>,
  ): Promise<void> {
    return createCollation(this, this.up, name, options);
  }

  /**
   * Drop the collation, create it on rollback. See {@link createCollation}.
   *
   * @param name - name of the collation, can contain a name of schema separated with a dot.
   * @param options - options to create and drop the collation.
   */
  dropCollation(
    name: string,
    options: Omit<RakeDbAst.Collation, 'type' | 'action' | 'schema' | 'name'>,
  ): Promise<void> {
    return createCollation(this, !this.up, name, options);
  }

  /**
   * Create and drop database views.
   *
   * Provide SQL as a string or via `t.sql` that can accept variables.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createView(
   *     'simpleView',
   *     `
   *     SELECT a.one, b.two
   *     FROM a
   *     JOIN b ON b."aId" = a.id
   *   `,
   *   );
   *
   *   // view can accept t.sql with variables in such way:
   *   const value = 'some value';
   *   await db.createView(
   *     'viewWithVariables',
   *     t.sql`
   *       SELECT * FROM a WHERE key = ${value}
   *     `,
   *   );
   *
   *   // view with options
   *   await db.createView(
   *     'schemaName.recursiveView',
   *     {
   *       // createOrReplace has effect when creating the view
   *       createOrReplace: true,
   *
   *       // dropIfExists and dropMode have effect when dropping the view
   *       dropIfExists: true,
   *       dropMode: 'CASCADE',
   *
   *       // for details, check Postgres docs for CREATE VIEW,
   *       // these options are matching CREATE VIEW options
   *       temporary: true,
   *       recursive: true,
   *       columns: ['n'],
   *       with: {
   *         checkOption: 'LOCAL', // or 'CASCADED'
   *         securityBarrier: true,
   *         securityInvoker: true,
   *       },
   *     },
   *     `
   *       VALUES (1)
   *       UNION ALL
   *       SELECT n + 1 FROM "schemaName"."recursiveView" WHERE n < 100;
   *     `,
   *   );
   * });
   * ```
   *
   * @param name - name of the view
   * @param options - view options
   * @param sql - SQL to create the view with
   */
  createView(
    name: string,
    options: RakeDbAst.ViewOptions,
    sql: string | RawSQLBase,
  ): Promise<void>;
  /**
   * See {@link createView}
   *
   * @param name - name of the view
   * @param sql - SQL to create the view with
   */
  createView(name: string, sql: string | RawSQLBase): Promise<void>;
  createView(name: string, ...args: unknown[]): Promise<void> {
    const [options, sql] = args.length === 2 ? args : [emptyObject, args[0]];

    return createView(
      this,
      this.up,
      name,
      options as RakeDbAst.ViewOptions,
      sql as string | RawSQLBase,
    );
  }

  /**
   * Drop the view, create it on rollback. See {@link createView}.
   *
   * @param name - name of the view
   * @param options - view options
   * @param sql - SQL to create the view with
   */
  dropView(
    name: string,
    options: RakeDbAst.ViewOptions,
    sql: string | RawSQLBase,
  ): Promise<void>;
  /**
   * Drop the view, create it on rollback. See {@link createView}.
   *
   * @param name - name of the view
   * @param sql - SQL to create the view with
   */
  dropView(name: string, sql: string | RawSQLBase): Promise<void>;
  dropView(name: string, ...args: unknown[]): Promise<void> {
    const [options, sql] = args.length === 2 ? args : [emptyObject, args[0]];

    return createView(
      this,
      !this.up,
      name,
      options as RakeDbAst.ViewOptions,
      sql as string | RawSQLBase,
    );
  }

  /**
   * Returns boolean to know if table exists:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   if (await db.tableExists('tableName')) {
   *     // ...do something
   *   }
   * });
   * ```
   *
   * @param tableName - name of the table
   */
  async tableExists(tableName: string): Promise<boolean> {
    return queryExists(this, {
      text: `SELECT 1 FROM "information_schema"."tables" WHERE "table_name" = $1`,
      values: [tableName],
    });
  }

  /**
   * Returns boolean to know if a column exists:
   *
   * Note that when `snakeCase` option is set to true, this method won't translate column to snake case, unlike other parts.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   if (await db.columnExists('tableName', 'columnName')) {
   *     // ...do something
   *   }
   * });
   * ```
   *
   * @param tableName - name of the table to check for the column in
   * @param columnName - name of the column
   */
  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    return queryExists(this, {
      text: `SELECT 1 FROM "information_schema"."columns" WHERE "table_name" = $1 AND "column_name" = $2`,
      values: [
        tableName,
        this.options.snakeCase ? toSnakeCase(columnName) : columnName,
      ],
    });
  }

  /**
   * Returns boolean to know if constraint exists:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   if (await db.constraintExists('constraintName')) {
   *     // ...do something
   *   }
   * });
   * ```
   *
   * @param constraintName - name of the constraint
   */
  async constraintExists(constraintName: string): Promise<boolean> {
    return queryExists(this, {
      text: `SELECT 1 FROM "information_schema"."table_constraints" WHERE "constraint_name" = $1`,
      values: [constraintName],
    });
  }
}

/**
 * If `log` object is specified, it will perform the query with logging.
 *
 * @param log - logger object
 * @param text - SQL text
 * @param values - SQL values
 * @param fn - function to call the original `query` or `arrays`
 */
const wrapWithLog = async <Result>(
  log: QueryLogObject | undefined,
  text: string,
  values: unknown[] | undefined,
  fn: () => Promise<Result>,
): Promise<Result> => {
  if (!log) {
    return fn();
  } else {
    const sql = {
      text,
      values: values || [],
    };

    const logData = log.beforeQuery(sql);

    try {
      const result = await fn();
      log.afterQuery(sql, logData);
      return result;
    } catch (err) {
      log.onError(err as Error, sql, logData);
      throw err;
    }
  }
};

/**
 * See {@link Migration.prototype.addColumn}
 */
const addColumn = <CT>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  columnName: string,
  fn: (t: MigrationColumnTypes<CT>) => ColumnType,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    [columnName]: t.add(fn(t)),
  }));
};

/**
 * See {@link Migration.prototype.addIndex}
 */
const addIndex = (
  migration: Migration<unknown>,
  up: boolean,
  tableName: string,
  columns: (string | TableData.Index.ColumnOrExpressionOptions<string>)[],
  args:
    | [options?: TableData.Index.OptionsArg]
    | [name?: string, options?: TableData.Index.OptionsArg],
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.index(columns, ...args)),
  }));
};

/**
 * See {@link Migration.prototype.addForeignKey}
 */
const addForeignKey = (
  migration: Migration<unknown>,
  up: boolean,
  tableName: string,
  columns: [string, ...string[]],
  foreignTable: string,
  foreignColumns: [string, ...string[]],
  options?: TableData.References.Options,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.foreignKey(columns, foreignTable, foreignColumns, options)),
  }));
};

/**
 * See {@link Migration.prototype.addPrimaryKey}
 */
const addPrimaryKey = (
  migration: Migration<unknown>,
  up: boolean,
  tableName: string,
  columns: [string, ...string[]],
  name?: string,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.primaryKey(columns, name)),
  }));
};

/**
 * See {@link Migration.prototype.addCheck}
 */
const addCheck = (
  migration: Migration<unknown>,
  up: boolean,
  tableName: string,
  check: RawSQLBase,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.check(check)),
  }));
};

/**
 * See {@link Migration.prototype.createSchema}
 */
const createSchema = async (
  migration: Migration<unknown>,
  up: boolean,
  name: string,
): Promise<void> => {
  const ast: RakeDbAst.Schema = {
    type: 'schema',
    action: up ? 'create' : 'drop',
    name,
  };

  await migration.adapter.query(
    `${ast.action === 'create' ? 'CREATE' : 'DROP'} SCHEMA "${name}"`,
  );
};

/**
 * See {@link Migration.createExtension}
 */
const createExtension = async (
  migration: Migration<unknown>,
  up: boolean,
  fullName: string,
  options?: RakeDbAst.ExtensionArg,
): Promise<void> => {
  const [schema, name] = getSchemaAndTableFromName(fullName);

  const ast: RakeDbAst.Extension = {
    type: 'extension',
    action: up ? 'create' : 'drop',
    schema,
    name,
    ...options,
  };

  let query;
  if (ast.action === 'drop') {
    query = `DROP EXTENSION${ast.dropIfExists ? ' IF EXISTS' : ''} "${
      ast.name
    }"${ast.cascade ? ' CASCADE' : ''}`;
  } else {
    query = `CREATE EXTENSION${
      ast.createIfNotExists ? ' IF NOT EXISTS' : ''
    } "${ast.name}"${ast.schema ? ` SCHEMA "${ast.schema}"` : ''}${
      ast.version ? ` VERSION '${ast.version}'` : ''
    }${ast.cascade ? ' CASCADE' : ''}`;
  }

  await migration.adapter.query(query);
};

/**
 * See {@link Migration.prototype.createEnum}
 */
const createEnum = async (
  migration: Migration<unknown>,
  up: boolean,
  name: string,
  values: [string, ...string[]],
  options: Omit<
    RakeDbAst.Enum,
    'type' | 'action' | 'name' | 'values' | 'schema'
  > = {},
): Promise<void> => {
  const [schema, enumName] = getSchemaAndTableFromName(name);

  const ast: RakeDbAst.Enum = {
    type: 'enum',
    action: up ? 'create' : 'drop',
    schema,
    name: enumName,
    values,
    ...options,
  };

  let query;
  const quotedName = quoteWithSchema(ast);
  if (ast.action === 'create') {
    query = `CREATE TYPE ${quotedName} AS ENUM (${values
      .map(escapeForMigration)
      .join(', ')})`;
  } else {
    query = `DROP TYPE${ast.dropIfExists ? ' IF EXISTS' : ''} ${quotedName}${
      ast.cascade ? ' CASCADE' : ''
    }`;
  }

  await migration.adapter.query(query);
};

/**
 * See {@link Migration.prototype.createDomain}
 */
const createDomain = async <CT>(
  migration: Migration<CT>,
  up: boolean,
  name: string,
  fn: DbDomainArg<CT>,
): Promise<void> => {
  const [schema, domainName] = getSchemaAndTableFromName(name);

  const ast: RakeDbAst.Domain = {
    type: 'domain',
    action: up ? 'create' : 'drop',
    schema,
    name: domainName,
    baseType: fn(migration.columnTypes),
  };

  let query;
  const values: unknown[] = [];
  const quotedName = quoteWithSchema(ast);
  if (ast.action === 'create') {
    const column = ast.baseType;
    query = `CREATE DOMAIN ${quotedName} AS ${columnTypeToSql(column)}${
      column.data.collate
        ? `
COLLATE "${column.data.collate}"`
        : ''
    }${
      column.data.default !== undefined
        ? `
DEFAULT ${encodeColumnDefault(column.data.default, values)}`
        : ''
    }${!column.data.isNullable || column.data.checks ? '\n' : ''}${[
      !column.data.isNullable && 'NOT NULL',
      column.data.checks
        ?.map((check) => `CHECK (${check.sql.toSQL({ values })})`)
        .join(' '),
    ]
      .filter(Boolean)
      .join(' ')}`;
  } else {
    query = `DROP DOMAIN ${quotedName}`;
  }

  await migration.adapter.query(
    interpolateSqlValues({
      text: query,
      values,
    }),
  );
};

/**
 * See {@link Migration.prototype.createCollation}
 */
const createCollation = async (
  migration: Migration<unknown>,
  up: boolean,
  name: string,
  options: Omit<RakeDbAst.Collation, 'type' | 'action' | 'schema' | 'name'>,
): Promise<void> => {
  const [schema, collationName] = getSchemaAndTableFromName(name);

  const ast: RakeDbAst.Collation = {
    type: 'collation',
    action: up ? 'create' : 'drop',
    schema,
    name: collationName,
    ...options,
  };

  let query;
  const quotedName = quoteWithSchema(ast);
  if (ast.action === 'create') {
    query = `CREATE COLLATION${
      ast.createIfNotExists ? ' IF NOT EXISTS' : ''
    } ${quotedName} `;

    if (ast.fromExisting) {
      query += `FROM ${quoteNameFromString(ast.fromExisting)}`;
    } else {
      const config: string[] = [];
      if (ast.locale) config.push(`locale = '${ast.locale}'`);
      if (ast.lcCollate) config.push(`lc_collate = '${ast.lcCollate}'`);
      if (ast.lcCType) config.push(`lc_ctype = '${ast.lcCType}'`);
      if (ast.provider) config.push(`provider = ${ast.provider}`);
      if (ast.deterministic !== undefined)
        config.push(`deterministic = ${ast.deterministic}`);
      if (ast.version) config.push(`version = '${ast.version}'`);

      query += `(\n  ${config.join(',\n  ')}\n)`;
    }
  } else {
    query = `DROP COLLATION${
      ast.dropIfExists ? ' IF EXISTS' : ''
    } ${quotedName}${ast.cascade ? ` CASCADE` : ''}`;
  }

  await migration.adapter.query(query);
};

/**
 * Run the query and check if it has rows.
 *
 * @param db - migration instance
 * @param sql - raw SQL object to execute
 */
const queryExists = (
  db: Migration<unknown>,
  sql: { text: string; values: unknown[] },
): Promise<boolean> => {
  return db.adapter
    .query(sql.text, sql.values)
    .then(({ rowCount }) => rowCount > 0);
};

export const renameType = async (
  migration: Migration<unknown>,
  from: string,
  to: string,
  kind: RakeDbAst.RenameType['kind'],
): Promise<void> => {
  const [fromSchema, f] = getSchemaAndTableFromName(migration.up ? from : to);
  const [toSchema, t] = getSchemaAndTableFromName(migration.up ? to : from);
  const ast: RakeDbAst.RenameType = {
    type: 'renameType',
    kind,
    fromSchema,
    from: f,
    toSchema,
    to: t,
  };

  if (ast.from !== ast.to) {
    await migration.adapter.query(
      `ALTER ${ast.kind} ${quoteTable(ast.fromSchema, ast.from)} RENAME TO "${
        ast.to
      }"`,
    );
  }

  if (ast.fromSchema !== ast.toSchema) {
    await migration.adapter.query(
      `ALTER ${ast.kind} ${quoteTable(ast.fromSchema, ast.to)} SET SCHEMA "${
        ast.toSchema ?? migration.adapter.schema
      }"`,
    );
  }
};

const renameTableItem = async (
  migration: Migration<unknown>,
  tableName: string,
  from: string,
  to: string,
  kind: RakeDbAst.RenameTableItem['kind'],
) => {
  const [schema, table] = getSchemaAndTableFromName(tableName);
  const [f, t] = migration.up ? [from, to] : [to, from];
  await migration.adapter.query(
    kind === 'INDEX'
      ? `ALTER INDEX ${quoteTable(schema, f)} RENAME TO "${t}"`
      : `ALTER TABLE ${quoteTable(
          schema,
          table,
        )} RENAME CONSTRAINT "${f}" TO "${t}"`,
  );
};

interface AddEnumValueOptions {
  // add only if not already exists
  ifNotExists?: boolean;
  // insert before other value
  before?: string;
  // insert after other value
  after?: string;
}

export const addOrDropEnumValues = async (
  migration: Migration<unknown>,
  up: boolean,
  enumName: string,
  values: string[],
  options?: AddEnumValueOptions,
): Promise<void> => {
  const [schema, name] = getSchemaAndTableFromName(enumName);
  const quotedName = quoteTable(schema, name);

  const ast: RakeDbAst.EnumValues = {
    type: 'enumValues',
    action: up ? 'add' : 'drop',
    schema,
    name,
    values,
    place: options?.before ? 'before' : options?.after ? 'after' : undefined,
    relativeTo: options?.before ?? options?.after,
    ifNotExists: options?.ifNotExists,
  };

  if (ast.action === 'add') {
    await Promise.all(
      (ast.place === 'after' ? [...ast.values].reverse() : ast.values).map(
        (value) =>
          migration.adapter.query(
            `ALTER TYPE ${quoteTable(ast.schema, ast.name)} ADD VALUE${
              ast.ifNotExists ? ' IF NOT EXISTS' : ''
            } ${singleQuote(value)}${
              ast.place && ast.relativeTo
                ? ` ${ast.place.toUpperCase()} ${singleQuote(ast.relativeTo)}`
                : ''
            }`,
          ),
      ),
    );
    return;
  }

  const { rows: valuesRows } = await migration.adapter.query<{ value: string }>(
    `SELECT unnest(enum_range(NULL::${quotedName}))::text value`,
  );
  const existingValues = valuesRows.map((r) => r.value);

  await recreateEnum(
    migration,
    ast,
    existingValues.filter((v) => !ast.values.includes(v)),
    (quotedName, table, column) =>
      `Cannot drop ${quotedName} enum values [${ast.values
        .map(singleQuote)
        .join(
          ', ',
        )}]: table ${table} has a row with such value in the column "${column}"`,
  );
};

export const changeEnumValues = async (
  migration: Migration<unknown>,
  enumName: string,
  fromValues: string[],
  toValues: string[],
): Promise<void> => {
  const [schema, name] = getSchemaAndTableFromName(enumName);

  if (!migration.up) {
    const values = fromValues;
    fromValues = toValues;
    toValues = values;
  }

  const ast: RakeDbAst.ChangeEnumValues = {
    type: 'changeEnumValues',
    schema,
    name,
    fromValues,
    toValues,
  };

  await recreateEnum(
    migration,
    ast,
    ast.toValues,
    (quotedName, table, column) =>
      `Cannot change ${quotedName} enum values from [${fromValues
        .map(singleQuote)
        .join(', ')}] to [${toValues
        .map(singleQuote)
        .join(
          ', ',
        )}]: table ${table} has a row with removed value in the column "${column}"`,
  );
};

const recreateEnum = async (
  migration: Migration<unknown>,
  { schema, name }: { schema?: string; name: string },
  values: string[],
  errorMessage: (quotedName: string, table: string, column: string) => string,
) => {
  const defaultSchema = migration.adapter.schema;
  const quotedName = quoteTable(schema, name);

  const relKinds = ['r', 'm']; // r is for table, m is for materialized views, TODO: not sure if materialized views are needed here.
  const { rows: tables } = await migration.adapter.query<{
    schema: string;
    table: string;
    columns: { name: string; arrayDims: number }[];
  }>(
    `SELECT n.nspname AS "schema",
  c.relname AS "table",
  json_agg(
    json_build_object('name', a.attname, 'arrayDims', a.attndims)
    ORDER BY a.attnum
  ) AS "columns"
FROM pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = relnamespace
JOIN pg_type bt ON bt.typname = ${singleQuote(name)}
JOIN pg_type t ON t.oid = bt.oid OR t.typelem = bt.oid
JOIN pg_attribute a ON a.attrelid = c.oid AND a.atttypid = t.oid
JOIN pg_namespace tn ON tn.oid = t.typnamespace AND tn.nspname = ${singleQuote(
      schema ?? defaultSchema,
    )}
WHERE c.relkind IN (${relKinds.map((c) => `'${c}'`).join(', ')})
GROUP BY n.nspname, c.relname`,
  );

  const sql = tables.map(
    (t) =>
      `ALTER TABLE ${quoteTable(t.schema, t.table)}
        ${t.columns
          .map(
            (c) =>
              `  ALTER COLUMN "${c.name}" TYPE text${'[]'.repeat(c.arrayDims)}`,
          )
          .join(',\n')}`,
  );

  sql.push(
    `DROP TYPE ${quotedName}`,
    `CREATE TYPE ${quotedName} AS ENUM (${values.map(singleQuote).join(', ')})`,
  );

  await migration.adapter.query(sql.join(';\n'));

  for (const t of tables) {
    const table = quoteTable(t.schema, t.table);
    for (const c of t.columns) {
      const type = quotedName + '[]'.repeat(c.arrayDims);

      try {
        await migration.adapter.query(
          `ALTER TABLE ${table}
  ALTER COLUMN "${c.name}" TYPE ${type} USING "${c.name}"::${type}`,
        );
      } catch (err) {
        if ((err as { code: string }).code === '22P02') {
          throw new Error(errorMessage(quotedName, table, c.name), {
            cause: err,
          });
        }
        throw err;
      }
    }
  }
};
