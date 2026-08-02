import { ColumnsShape, Column, DbDomainArg, DbResult, EnumColumn, raw, TableData, TableDataFn, TableDataItem, Adapter, MaybeArray, QueryLogObject, RawSqlBase, RecordString, DefaultColumnTypes, DefaultSchemaConfig } from 'pqb/internal';
import { CreateTableResult } from './create-table';
import { TableChangeData, TableChanger } from './change-table';
import { RakeDbAst } from '../ast';
import { RakeDbConfig } from '../config/config';
import { ChangeDefaultPrivilegesArg } from './default-privilege';
import { DbStructure } from '../generate/db-structure';
import { ChangeRlsPolicyParams, RlsPolicyDefinition } from './rls';
import { GrantMigrationArg } from './grant';
export type DropMode = 'CASCADE' | 'RESTRICT';
export type TableOptions = {
    createIfNotExists?: boolean;
    dropIfExists?: boolean;
    dropMode?: DropMode;
    comment?: string;
    noPrimaryKey?: boolean;
    snakeCase?: boolean;
    language?: string;
};
export type MigrationColumnTypes<CT> = Omit<CT, 'enum'> & {
    enum: (name: string) => EnumColumn<DefaultSchemaConfig, unknown, readonly string[]>;
};
export type ColumnsShapeCallback<CT, Shape extends ColumnsShape = ColumnsShape> = (t: MigrationColumnTypes<CT> & {
    raw: typeof raw;
}) => Shape;
export type ChangeTableOptions = {
    snakeCase?: boolean;
    language?: string;
    comment?: string | [string, string] | null;
};
export type ChangeTableCallback<CT> = (t: TableChanger<CT>) => TableChangeData;
export type ColumnComment = {
    column: string;
    comment: string | null;
};
export interface SilentQueries extends MigrationAdapter {
    silentQuery: Adapter['query'];
    silentArrays: Adapter['arrays'];
}
export type DbMigration<CT> = DbResult<CT> & Migration<CT> & {
    adapter: SilentQueries;
};
interface MigrationInterfaceResult {
    adapter: SilentQueries;
    getDb(columnTypes: unknown): DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>;
}
/**
 * Creates a new `db` instance that is an instance of `pqb` with mixed in migration methods from the `Migration` class.
 * It overrides `query` and `array` db adapter methods to intercept SQL for the logging.
 *
 * A concrete `db` instance depends on column types, column types may vary between `change` calls,
 * therefore it returns a function that accepts column types, caches db instance per given column types, and return the result.
 *
 * @param tx - database adapter that executes inside a transaction
 * @param up - migrate or rollback
 * @param config - config of `rakeDb`
 */
export declare const createMigrationInterface: (tx: Adapter, up: boolean, config: Pick<RakeDbConfig, 'log' | 'logger'>) => MigrationInterfaceResult;
export type MigrationAdapter = Adapter;
export declare class Migration<CT = unknown> {
    adapter: MigrationAdapter;
    log?: QueryLogObject;
    up: boolean;
    options: RakeDbConfig;
    columnTypes: CT;
    private tableMethods;
    private getTableMethods;
    private tableChangeMethods;
    private getTableChangeMethods;
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
    createTable<Table extends string, Shape extends ColumnsShape>(tableName: Table, fn?: ColumnsShapeCallback<CT, Shape>, dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>): Promise<CreateTableResult<Table, Shape>>;
    /**
     * See {@link createTable}
     *
     * @param tableName - name of the table to create
     * @param options - {@link TableOptions}
     * @param fn - create table callback
     * @param dataFn - callback for creating composite indexes, primary keys, foreign keys
     */
    createTable<Table extends string, Shape extends ColumnsShape>(tableName: Table, options: TableOptions, fn?: ColumnsShapeCallback<CT, Shape>, dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>): Promise<CreateTableResult<Table, Shape>>;
    /**
     * Drop the table, create it on rollback. See {@link createTable}.
     *
     * @param tableName - name of the table to drop
     * @param fn - create table callback
     * @param dataFn - callback for creating composite indexes, primary keys, foreign keys
     */
    dropTable<Table extends string, Shape extends ColumnsShape>(tableName: Table, fn?: ColumnsShapeCallback<CT, Shape>, dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>): Promise<CreateTableResult<Table, Shape>>;
    /**
     * Drop the table, create it on rollback. See {@link createTable}.
     *
     * @param tableName - name of the table to drop
     * @param options - {@link TableOptions}
     * @param fn - create table callback
     * @param dataFn - callback for creating composite indexes, primary keys, foreign keys
     */
    dropTable<Table extends string, Shape extends ColumnsShape>(tableName: Table, options: TableOptions, fn?: ColumnsShapeCallback<CT, Shape>, dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>): Promise<CreateTableResult<Table, Shape>>;
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
    changeTable(tableName: string, options: ChangeTableOptions, fn?: ChangeTableCallback<CT>): Promise<void>;
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
    renameTable(from: string, to: string): Promise<void>;
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
    changeTableSchema(table: string, from: string, to: string): Promise<void>;
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
    addColumn(tableName: string, columnName: string, fn: (t: MigrationColumnTypes<CT>) => Column): Promise<void>;
    /**
     * Drop the schema, create it on rollback. See {@link addColumn}.
     *
     * @param tableName - name of the table to add the column to
     * @param columnName - name of the column to add
     * @param fn - function returning a type of the column
     */
    dropColumn(tableName: string, columnName: string, fn: (t: MigrationColumnTypes<CT>) => Column): Promise<void>;
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
     * @param args - index options
     */
    addIndex(tableName: string, columns: (string | TableData.Index.ColumnOrExpressionOptions)[], ...args: [options?: TableData.Index.OptionsArg]): Promise<void>;
    /**
     * Drop the schema, create it on rollback. See {@link addIndex}.
     *
     * @param tableName - name of the table to add the index for
     * @param columns - indexed columns
     * @param args - index options
     */
    dropIndex(tableName: string, columns: (string | TableData.Index.ColumnOrExpressionOptions)[], ...args: [options?: TableData.Index.OptionsArg]): Promise<void>;
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
    renameIndex(tableName: string, from: string, to: string): Promise<void>;
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
    addForeignKey(tableName: string, columns: [string, ...string[]], foreignTable: string, foreignColumns: [string, ...string[]], options?: TableData.References.Options): Promise<void>;
    /**
     * Drop the schema, create it on rollback. See {@link addForeignKey}.
     *
     * @param tableName - table name
     * @param columns - column names in the table
     * @param foreignTable - other table name
     * @param foreignColumns - column names in the other table
     * @param options - foreign key options
     */
    dropForeignKey(tableName: string, columns: [string, ...string[]], foreignTable: string, foreignColumns: [string, ...string[]], options?: TableData.References.Options): Promise<void>;
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
    addPrimaryKey(tableName: string, columns: [string, ...string[]], name?: string): Promise<void>;
    /**
     * Drop the schema, create it on rollback. See {@link addPrimaryKey}.
     *
     * @param tableName - name of the table
     * @param columns - array of the columns
     * @param name - optionally, set a primary key constraint name
     */
    dropPrimaryKey(tableName: string, columns: [string, ...string[]], name?: string): Promise<void>;
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
    addCheck(tableName: string, check: RawSqlBase): Promise<void>;
    /**
     * Drop the schema, create it on rollback. See {@link addCheck}.
     *
     * @param tableName - name of the table to add the check into
     * @param check - raw SQL for the check
     */
    dropCheck(tableName: string, check: RawSqlBase): Promise<void>;
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
    renameConstraint(tableName: string, from: string, to: string): Promise<void>;
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
    renameColumn(tableName: string, from: string, to: string): Promise<void>;
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
    createSchema(schemaName: string): Promise<void>;
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
    renameSchema(from: string, to: string): Promise<void>;
    /**
     * Drop the schema, create it on rollback. See {@link createSchema}.
     *
     * @param schemaName - name of the schema
     */
    dropSchema(schemaName: string): Promise<void>;
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
    createExtension(name: string, options?: RakeDbAst.ExtensionArg): Promise<void>;
    /**
     * Drop the extension, create it on rollback. See {@link createExtension}.
     *
     * @param name - name of the extension
     * @param options - extension options
     */
    dropExtension(name: string, options?: RakeDbAst.ExtensionArg): Promise<void>;
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
    createEnum(name: string, values: [string, ...string[]], options?: Omit<RakeDbAst.Enum, 'type' | 'action' | 'name' | 'values' | 'schema'>): Promise<void>;
    /**
     * Drop the enum, create it on rollback. See {@link createEnum}.
     *
     * @param name - name of the enum
     * @param values - possible enum values
     * @param options - enum options
     */
    dropEnum(name: string, values: [string, ...string[]], options?: Omit<RakeDbAst.Enum, 'type' | 'action' | 'name' | 'values' | 'schema'>): Promise<void>;
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
    addEnumValues(enumName: string, values: string[], options?: AddEnumValueOptions): Promise<void>;
    /**
     * See {@link addEnumValues}
     */
    dropEnumValues(enumName: string, values: string[], options?: AddEnumValueOptions): Promise<void>;
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
    renameEnumValues(enumName: string, values: RecordString): Promise<void>;
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
    changeEnumValues(enumName: string, fromValues: string[], toValues: string[]): Promise<void>;
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
    renameType(from: string, to: string): Promise<void>;
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
    changeTypeSchema(name: string, from: string, to: string): Promise<void>;
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
    createDomain(name: string, fn: DbDomainArg<CT>): Promise<void>;
    /**
     * Drop the domain, create it on rollback. See {@link dropDomain}.
     *
     * @param name - name of the domain
     * @param fn - function returning a column type. Options `nullable`, `collate`, `default`, `check` will be applied to domain
     */
    dropDomain(name: string, fn: DbDomainArg<CT>): Promise<void>;
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
    renameDomain(from: string, to: string): Promise<void>;
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
    createCollation(name: string, options: Omit<RakeDbAst.Collation, 'type' | 'action' | 'schema' | 'name'>): Promise<void>;
    /**
     * Drop the collation, create it on rollback. See {@link createCollation}.
     *
     * @param name - name of the collation, can contain a name of schema separated with a dot.
     * @param options - options to create and drop the collation.
     */
    dropCollation(name: string, options: Omit<RakeDbAst.Collation, 'type' | 'action' | 'schema' | 'name'>): Promise<void>;
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
     *       checkOption: 'LOCAL', // or 'CASCADED'
     *       securityBarrier: true,
     *       securityInvoker: true,
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
    createView(name: string, options: RakeDbAst.ViewOptions, sql: string | RawSqlBase): Promise<void>;
    /**
     * See {@link createView}
     *
     * @param name - name of the view
     * @param sql - SQL to create the view with
     */
    createView(name: string, sql: string | RawSqlBase): Promise<void>;
    /**
     * Drop the view, create it on rollback. See {@link createView}.
     *
     * @param name - name of the view
     * @param options - view options
     * @param sql - SQL to create the view with
     */
    dropView(name: string, options: RakeDbAst.ViewOptions, sql: string | RawSqlBase): Promise<void>;
    /**
     * Drop the view, create it on rollback. See {@link createView}.
     *
     * @param name - name of the view
     * @param sql - SQL to create the view with
     */
    dropView(name: string, sql: string | RawSqlBase): Promise<void>;
    /**
     * Create a materialized view, drop it on rollback.
     *
     * @param name - name of the materialized view
     * @param options - materialized view options
     * @param sql - SQL to create the materialized view with
     */
    createMaterializedView(name: string, options: RakeDbAst.MaterializedViewOptions, sql: string | RawSqlBase): Promise<void>;
    /**
     * Create a materialized view, drop it on rollback.
     *
     * @param name - name of the materialized view
     * @param sql - SQL to create the materialized view with
     */
    createMaterializedView(name: string, sql: string | RawSqlBase): Promise<void>;
    /**
     * Drop a materialized view, create it on rollback.
     *
     * @param name - name of the materialized view
     * @param options - materialized view options
     * @param sql - SQL to create the materialized view with
     */
    dropMaterializedView(name: string, options: RakeDbAst.MaterializedViewOptions, sql: string | RawSqlBase): Promise<void>;
    /**
     * Drop a materialized view, create it on rollback.
     *
     * @param name - name of the materialized view
     * @param sql - SQL to create the materialized view with
     */
    dropMaterializedView(name: string, sql: string | RawSqlBase): Promise<void>;
    /**
     * Refresh a materialized view.
     *
     * @param name - name of the materialized view
     * @param options - refresh options
     */
    refreshMaterializedView(name: string, options?: RakeDbAst.RefreshMaterializedViewOptions): Promise<void>;
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
    tableExists(tableName: string): Promise<boolean>;
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
    columnExists(tableName: string, columnName: string): Promise<boolean>;
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
    constraintExists(constraintName: string): Promise<boolean>;
    createRole(name: string, params?: Partial<DbStructure.Role>): Promise<void>;
    dropRole(name: string, params?: Partial<DbStructure.Role>): Promise<void>;
    renameRole(from: string, to: string): Promise<void>;
    changeRole(name: string, params: {
        from?: Partial<DbStructure.Role>;
        to: Partial<DbStructure.Role>;
    }): Promise<void>;
    changeDefaultPrivileges(params: ChangeDefaultPrivilegesArg): Promise<void>;
    enableRls(tableName: string): Promise<void>;
    disableRls(tableName: string): Promise<void>;
    forceRls(tableName: string): Promise<void>;
    noForceRls(tableName: string): Promise<void>;
    createPolicy(tableName: string, policyName: string, params: RlsPolicyDefinition): Promise<void>;
    dropPolicy(tableName: string, policyName: string, params: RlsPolicyDefinition): Promise<void>;
    changePolicy(tableName: string, policyName: string, params: ChangeRlsPolicyParams): Promise<void>;
    grant(params: GrantMigrationArg): Promise<void>;
    revoke(params: GrantMigrationArg): Promise<void>;
}
export declare const renameType: (migration: Migration, from: string, to: string, kind: RakeDbAst.RenameType['kind']) => Promise<void>;
interface AddEnumValueOptions {
    ifNotExists?: boolean;
    before?: string;
    after?: string;
}
export declare const addOrDropEnumValues: (migration: Migration, up: boolean, enumName: string, values: string[], options?: AddEnumValueOptions) => Promise<void>;
export declare const changeEnumValues: (migration: Migration, enumName: string, fromValues: string[], toValues: string[]) => Promise<void>;
export {};
