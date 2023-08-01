import {
  ColumnsShape,
  ColumnType,
  ForeignKeyOptions,
  IndexColumnOptions,
  IndexOptions,
  logParamToLogObject,
  QueryLogObject,
  TransactionAdapter,
  TextColumn,
  createDb,
  DbResult,
  EnumColumn,
  quote,
  Adapter,
  DefaultColumnTypes,
  raw,
} from 'pqb';
import {
  ColumnTypesBase,
  emptyObject,
  MaybeArray,
  QueryInput,
  RawSQLBase,
  singleQuote,
  Sql,
} from 'orchid-core';
import { createTable, CreateTableResult } from './createTable';
import { changeTable, TableChangeData, TableChanger } from './changeTable';
import {
  RakeDbConfig,
  quoteWithSchema,
  getSchemaAndTableFromName,
  quoteNameFromString,
} from '../common';
import { RakeDbAst } from '../ast';
import { columnTypeToSql } from './migrationUtils';
import { createView } from './createView';

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

// Simplified text column type that doesn't require `min` and `max` arguments.
type TextColumnCreator = () => TextColumn;

// Overridden column types to simplify and adapt some column types for a migration.
export type MigrationColumnTypes<CT extends ColumnTypesBase> = Omit<
  CT,
  'text' | 'string' | 'enum'
> & {
  text: TextColumnCreator;
  string: TextColumnCreator;
  citext: TextColumnCreator;
  enum: (name: string) => EnumColumn;
};

// Create table callback
export type ColumnsShapeCallback<
  CT extends ColumnTypesBase,
  Shape extends ColumnsShape = ColumnsShape,
> = (t: MigrationColumnTypes<CT> & { raw: typeof raw }) => Shape;

// Options for changing a table
export type ChangeTableOptions = {
  snakeCase?: boolean;
  language?: string;
  comment?: string | [string, string] | null;
};

// Callback for a table change
export type ChangeTableCallback<CT extends ColumnTypesBase> = (
  t: TableChanger<CT>,
) => TableChangeData;

// DTO for column comments
export type ColumnComment = { column: string; comment: string | null };

// Database adapter methods to perform queries without logging
export type SilentQueries = {
  // Query without logging
  silentQuery: Adapter['query'];
  // Query arrays without logging
  silentArrays: Adapter['arrays'];
};

// Combined queryable database instance and a migration interface
export type DbMigration<CT extends ColumnTypesBase = DefaultColumnTypes> =
  DbResult<CT> &
    Migration<CT> & {
      // Add `SilentQueries` to an existing `adapter` type in the `DbResult`
      adapter: SilentQueries;
    };

// Constraint config, it can be a foreign key or a check
type ConstraintArg = {
  // Name of the constraint
  name?: string;
  // Foreign key options
  references?: [
    columns: [string, ...string[]],
    table: string,
    foreignColumn: [string, ...string[]],
    options: Omit<ForeignKeyOptions, 'name' | 'dropMode'>,
  ];
  // Database check raw SQL
  check?: RawSQLBase;
  // Drop mode to use when dropping the constraint
  dropMode?: DropMode;
};

/**
 * Creates a new `db` instance that is an instance of `pqb` with mixed in migration methods from the `Migration` class.
 * It overrides `query` and `array` db adapter methods to intercept SQL for the logging.
 *
 * @param tx - database adapter that executes inside a transaction
 * @param up - migrate or rollback
 * @param config - config of `rakeDb`
 */
export const createMigrationInterface = <CT extends ColumnTypesBase>(
  tx: TransactionAdapter,
  up: boolean,
  config: RakeDbConfig<CT>,
): DbMigration => {
  const adapter = new TransactionAdapter(tx, tx.client, tx.types);
  const { query, arrays } = adapter;
  const log = logParamToLogObject(config.logger || console, config.log);

  adapter.query = ((q, types) => {
    return wrapWithLog(log, q, () => query.call(adapter, q, types));
  }) as typeof adapter.query;

  adapter.arrays = ((q, types) => {
    return wrapWithLog(log, q, () => arrays.call(adapter, q, types));
  }) as typeof adapter.arrays;

  Object.assign(adapter, { silentQuery: query, silentArrays: arrays });

  const db = createDb({
    adapter,
    columnTypes: config.columnTypes,
  }) as unknown as DbMigration;

  const { prototype: proto } = Migration;
  for (const key of Object.getOwnPropertyNames(proto)) {
    (db as unknown as Record<string, unknown>)[key] =
      proto[key as keyof typeof proto];
  }

  db.migratedAsts = [];

  return Object.assign(db, {
    adapter,
    log,
    up,
    options: config,
  });
};

// Migration interface to use inside the `change` callback.
export class Migration<CT extends ColumnTypesBase> {
  // Database adapter to perform queries with.
  public adapter!: TransactionAdapter;
  // The logger config.
  public log?: QueryLogObject;
  // Is migrating or rolling back.
  public up!: boolean;
  // `rakeDb` config.
  public options!: RakeDbConfig;
  // Collect objects that represents what was changed by a migration to pass it later to the `appCodeUpdater`.
  public migratedAsts!: RakeDbAst[];
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
   */
  createTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    fn?: ColumnsShapeCallback<CT, Shape>,
  ): Promise<CreateTableResult<Table, Shape>>;
  /**
   * See {@link createTable}
   *
   * @param tableName - name of the table to create
   * @param options - {@link TableOptions}
   * @param fn - create table callback
   */
  createTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    options: TableOptions,
    fn?: ColumnsShapeCallback<CT, Shape>,
  ): Promise<CreateTableResult<Table, Shape>>;
  createTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    cbOrOptions?: ColumnsShapeCallback<CT, Shape> | TableOptions,
    cb?: ColumnsShapeCallback<CT, Shape>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const options =
      !cbOrOptions || typeof cbOrOptions === 'function' ? {} : cbOrOptions;
    const fn = (cb || cbOrOptions) as ColumnsShapeCallback<CT, Shape>;

    return createTable(this, this.up, tableName, options, fn);
  }

  /**
   * Drop the table, create it on rollback. See {@link createTable}.
   *
   * @param tableName - name of the table to drop
   * @param fn - create table callback
   */
  dropTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    fn?: ColumnsShapeCallback<CT, Shape>,
  ): Promise<CreateTableResult<Table, Shape>>;
  /**
   * Drop the table, create it on rollback. See {@link createTable}.
   *
   * @param tableName - name of the table to drop
   * @param options - {@link TableOptions}
   * @param fn - create table callback
   */
  dropTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    options: TableOptions,
    fn?: ColumnsShapeCallback<CT, Shape>,
  ): Promise<CreateTableResult<Table, Shape>>;
  dropTable<Table extends string, Shape extends ColumnsShape>(
    tableName: Table,
    cbOrOptions?: ColumnsShapeCallback<CT, Shape> | TableOptions,
    cb?: ColumnsShapeCallback<CT, Shape>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const options =
      !cbOrOptions || typeof cbOrOptions === 'function' ? {} : cbOrOptions;
    const fn = (cb || cbOrOptions) as ColumnsShapeCallback<CT, Shape>;

    return createTable(this, !this.up, tableName, options, fn);
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
   * @param from - rename the table from
   * @param to - rename the table to
   */
  async renameTable(from: string, to: string): Promise<void> {
    const [fromSchema, f] = getSchemaAndTableFromName(this.up ? from : to);
    const [toSchema, t] = getSchemaAndTableFromName(this.up ? to : from);
    const ast: RakeDbAst.RenameTable = {
      type: 'renameTable',
      fromSchema,
      from: f,
      toSchema,
      to: t,
    };

    await this.adapter.query(
      `ALTER TABLE ${quoteWithSchema({
        schema: ast.fromSchema,
        name: ast.from,
      })} RENAME TO ${quoteWithSchema({
        schema: ast.toSchema,
        name: ast.to,
      })}`,
    );

    this.migratedAsts.push(ast);
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
   * Drop the schema, create it on rollback. See {@link addIndex}.
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
   * @param options - index options
   */
  addIndex(
    tableName: string,
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ): Promise<void> {
    return addIndex(this, this.up, tableName, columns, options);
  }

  /**
   * Drop the schema, create it on rollback. See {@link addIndex}.
   *
   * @param tableName - name of the table to add the index for
   * @param columns - indexed columns
   * @param options - index options
   */
  dropIndex(
    tableName: string,
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ): Promise<void> {
    return addIndex(this, !this.up, tableName, columns, options);
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
    options?: ForeignKeyOptions,
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
    options?: ForeignKeyOptions,
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
   * @param options - object with a constraint name
   */
  addPrimaryKey(
    tableName: string,
    columns: string[],
    options?: { name?: string },
  ): Promise<void> {
    return addPrimaryKey(this, this.up, tableName, columns, options);
  }

  /**
   * Drop the schema, create it on rollback. See {@link addPrimaryKey}.
   *
   * @param tableName - name of the table
   * @param columns - array of the columns
   * @param options - object with a constraint name
   */
  dropPrimaryKey(
    tableName: string,
    columns: string[],
    options?: { name?: string },
  ): Promise<void> {
    return addPrimaryKey(this, !this.up, tableName, columns, options);
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
   * Drop the schema, create it on rollback. See {@link addConstraint}.
   *
   * @param tableName - name of the table to add the check into
   * @param check - raw SQL for the check
   */
  dropCheck(tableName: string, check: RawSQLBase): Promise<void> {
    return addCheck(this, !this.up, tableName, check);
  }

  /**
   * Add or drop a constraint with check and a foreign key references.
   *
   * See foreign key details in [foreign key](/guide/migration-column-methods.html#composite-foreign-key).
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.addConstraint('tableName', {
   *     name: 'constraintName',
   *     check: db.sql`column > 123`,
   *     references: [['id', 'name'], 'otherTable', ['otherId', 'otherName']],
   *   });
   * });
   * ```
   *
   * @param tableName - name of the table to add the constraint to
   * @param constraint - constraint config object
   */
  addConstraint(tableName: string, constraint: ConstraintArg): Promise<void> {
    return addConstraint(this, this.up, tableName, constraint);
  }

  /**
   * Drop the schema, create it on rollback. See {@link addConstraint}.
   *
   * @param tableName - name of the table to add the constraint to
   * @param constraint - constraint config object
   */
  dropConstraint(tableName: string, constraint: ConstraintArg): Promise<void> {
    return addConstraint(this, !this.up, tableName, constraint);
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
    options: Omit<RakeDbAst.Extension, 'type' | 'action' | 'name'> = {},
  ): Promise<void> {
    return createExtension(this, this.up, name, options);
  }

  /**
   * Drop the extension, create it on rollback. See {@link createExtension}.
   *
   * @param name - name of the extension
   * @param options - extension options
   */
  dropExtension(
    name: string,
    options: Omit<
      RakeDbAst.Extension,
      'type' | 'action' | 'name' | 'values'
    > = {},
  ): Promise<void> {
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
   * Domain is a custom database type that allows to predefine a `NOT NULL` and a `CHECK` (see [postgres tutorial](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)).
   *
   * `createDomain` and `dropDomain` take a domain name as first argument, callback returning inner column type as a second, and optional object with parameters as third.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createDomain('domainName', (t) => t.integer(), {
   *     check: db.sql`value = 42`,
   *   });
   *
   *   // use `schemaName.domainName` format to specify a schema
   *   await db.createDomain('schemaName.domainName', (t) => t.text(), {
   *     // unlike columns, domain is nullable by default, use notNull when needed:
   *     notNull: true,
   *     collation: 'C',
   *     default: db.sql`'default text'`,
   *     check: db.sql`length(value) > 10`,
   *
   *     // cascade is used when dropping domain
   *     cascade: true,
   *   });
   * });
   * ```
   *
   * @param name - name of the domain
   * @param fn - function returning a column type for the domain
   * @param options - domain options
   */
  createDomain(
    name: string,
    fn: (t: CT) => ColumnType,
    options?: Omit<
      RakeDbAst.Domain,
      'type' | 'action' | 'schema' | 'name' | 'baseType'
    >,
  ): Promise<void> {
    return createDomain(this, this.up, name, fn, options);
  }

  /**
   * Drop the domain, create it on rollback. See {@link dropDomain}.
   *
   * @param name - name of the domain
   * @param fn - function returning a column type for the domain
   * @param options - domain options
   */
  dropDomain(
    name: string,
    fn: (t: CT) => ColumnType,
    options?: Omit<
      RakeDbAst.Domain,
      'type' | 'action' | 'schema' | 'name' | 'baseType'
    >,
  ): Promise<void> {
    return createDomain(this, !this.up, name, fn, options);
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
   * Provide SQL as a string or via `db.sql` that can accept variables.
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
   *   // view can accept db.sql with variables in such way:
   *   const value = 'some value';
   *   await db.createView(
   *     'viewWithVariables',
   *     db.sql`
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
      values: [tableName, columnName],
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
 * @param query - object with SQL text and values for a query
 * @param fn - function to call the original `query` or `arrays`
 */
const wrapWithLog = async <Result>(
  log: QueryLogObject | undefined,
  query: QueryInput,
  fn: () => Promise<Result>,
): Promise<Result> => {
  if (!log) {
    return fn();
  } else {
    const sql = (
      typeof query === 'string'
        ? { text: query, values: [] }
        : query.values
        ? query
        : { ...query, values: [] }
    ) as Sql;

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
 * See {@link Migration.addColumn}
 */
const addColumn = <CT extends ColumnTypesBase>(
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
 * See {@link Migration.addIndex}
 */
const addIndex = <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  columns: MaybeArray<string | IndexColumnOptions>,
  options?: IndexOptions,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.index(columns, options)),
  }));
};

/**
 * See {@link Migration.addForeignKey}
 */
const addForeignKey = <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  columns: [string, ...string[]],
  foreignTable: string,
  foreignColumns: [string, ...string[]],
  options?: ForeignKeyOptions,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.foreignKey(columns, foreignTable, foreignColumns, options)),
  }));
};

/**
 * See {@link Migration.addPrimaryKey}
 */
const addPrimaryKey = <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  columns: string[],
  options?: { name?: string },
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.primaryKey(columns, options)),
  }));
};

/**
 * See {@link Migration.addCheck}
 */
const addCheck = <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  check: RawSQLBase,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.check(check)),
  }));
};

/**
 * See {@link Migration.addConstraint}
 */
const addConstraint = <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  constraint: ConstraintArg,
): Promise<void> => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.constraint(constraint)),
  }));
};

/**
 * See {@link Migration.createSchema}
 */
const createSchema = async <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
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

  migration.migratedAsts.push(ast);
};

/**
 * See {@link Migration.createExtension}
 */
const createExtension = async <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  name: string,
  options: Omit<RakeDbAst.Extension, 'type' | 'action' | 'name'>,
): Promise<void> => {
  const ast: RakeDbAst.Extension = {
    type: 'extension',
    action: up ? 'create' : 'drop',
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

  migration.migratedAsts.push(ast);
};

/**
 * See {@link Migration.createEnum}
 */
const createEnum = async <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
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
      .map(quote)
      .join(', ')})`;
  } else {
    query = `DROP TYPE${ast.dropIfExists ? ' IF EXISTS' : ''} ${quotedName}${
      ast.cascade ? ' CASCADE' : ''
    }`;
  }

  await migration.adapter.query(query);

  migration.migratedAsts.push(ast);
};

/**
 * See {@link Migration.createDomain}
 */
const createDomain = async <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  name: string,
  fn: (t: CT) => ColumnType,
  options?: Omit<
    RakeDbAst.Domain,
    'type' | 'action' | 'schema' | 'name' | 'baseType'
  >,
): Promise<void> => {
  const [schema, domainName] = getSchemaAndTableFromName(name);

  const ast: RakeDbAst.Domain = {
    type: 'domain',
    action: up ? 'create' : 'drop',
    schema,
    name: domainName,
    baseType: fn(migration.columnTypes),
    ...options,
  };

  let query;
  const values: unknown[] = [];
  const quotedName = quoteWithSchema(ast);
  if (ast.action === 'create') {
    query = `CREATE DOMAIN ${quotedName} AS ${columnTypeToSql(ast.baseType)}${
      ast.collation
        ? `
COLLATION ${singleQuote(ast.collation)}`
        : ''
    }${
      ast.default
        ? `
DEFAULT ${ast.default.toSQL({ values })}`
        : ''
    }${ast.notNull || ast.check ? '\n' : ''}${[
      ast.notNull && 'NOT NULL',
      ast.check && `CHECK ${ast.check.toSQL({ values })}`,
    ]
      .filter(Boolean)
      .join(' ')}`;
  } else {
    query = `DROP DOMAIN ${quotedName}${ast.cascade ? ' CASCADE' : ''}`;
  }

  await migration.adapter.query({
    text: query,
    values,
  });

  migration.migratedAsts.push(ast);
};

/**
 * See {@link Migration.createCollation}
 */
const createCollation = async <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
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

  await migration.adapter.query({
    text: query,
  });

  migration.migratedAsts.push(ast);
};

/**
 * Run the query and check if it has rows.
 *
 * @param db - migration instance
 * @param sql - raw SQL object to execute
 */
const queryExists = <CT extends ColumnTypesBase>(
  db: Migration<CT>,
  sql: { text: string; values: unknown[] },
): Promise<boolean> => {
  return db.adapter.query(sql).then(({ rowCount }) => rowCount > 0);
};
