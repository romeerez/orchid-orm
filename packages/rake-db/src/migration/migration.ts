import {
  ColumnsShape,
  ColumnType,
  ColumnTypes,
  ForeignKeyOptions,
  IndexColumnOptions,
  IndexOptions,
  logParamToLogObject,
  MaybeArray,
  QueryArraysResult,
  QueryInput,
  QueryLogObject,
  QueryResult,
  QueryResultRow,
  Sql,
  TransactionAdapter,
  TypeParsers,
  raw,
  TextColumn,
  AdapterOptions,
} from 'pqb';
import { createTable } from './createTable';
import { changeTable, TableChangeData, TableChanger } from './changeTable';
import {
  RakeDbConfig,
  quoteWithSchema,
  getSchemaAndTableFromName,
} from '../common';
import { createJoinTable } from './createJoinTable';
import { RakeDbAst } from '../ast';

export type DropMode = 'CASCADE' | 'RESTRICT';

export type TableOptions = {
  dropMode?: DropMode;
  comment?: string;
  noPrimaryKey?: boolean;
};

type TextColumnCreator = () => TextColumn;

export type MigrationColumnTypes = Omit<ColumnTypes, 'text' | 'string'> & {
  text: TextColumnCreator;
  string: TextColumnCreator;
};

export type ColumnsShapeCallback = (
  t: MigrationColumnTypes & { raw: typeof raw },
) => ColumnsShape;

export type ChangeTableOptions = { comment?: string | [string, string] | null };
export type ChangeTableCallback = (t: TableChanger) => TableChangeData;

export type ColumnComment = { column: string; comment: string | null };

export type JoinTableOptions = {
  tableName?: string;
  comment?: string;
  dropMode?: DropMode;
};

export type ExtensionOptions = {
  schema?: string;
  version?: string;
  cascade?: boolean;
};

export class Migration extends TransactionAdapter {
  public log?: QueryLogObject;

  constructor(
    tx: TransactionAdapter,
    public up: boolean,
    public options: RakeDbConfig,
    public adapterOptions: AdapterOptions,
    public appCodeUpdaterCache: object,
  ) {
    super(tx, tx.client, tx.types);
    this.log = logParamToLogObject(options.logger || console, options.log);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends QueryResultRow = any>(
    query: QueryInput,
    types: TypeParsers = this.types,
    log = this.log,
  ): Promise<QueryResult<T>> {
    return wrapWithLog(log, query, () => super.query(query, types));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    query: QueryInput,
    types: TypeParsers = this.types,
    log = this.log,
  ): Promise<QueryArraysResult<R>> {
    return wrapWithLog(log, query, () => super.arrays(query, types));
  }

  createTable(
    tableName: string,
    options: TableOptions,
    fn: ColumnsShapeCallback,
  ): Promise<void>;
  createTable(tableName: string, fn: ColumnsShapeCallback): Promise<void>;
  createTable(
    tableName: string,
    cbOrOptions: ColumnsShapeCallback | TableOptions,
    cb?: ColumnsShapeCallback,
  ): Promise<void> {
    const options = typeof cbOrOptions === 'function' ? {} : cbOrOptions;
    const fn = (cb || cbOrOptions) as ColumnsShapeCallback;

    return createTable(this, this.up, tableName, options, fn);
  }

  dropTable(
    tableName: string,
    options: TableOptions,
    fn: ColumnsShapeCallback,
  ): Promise<void>;
  dropTable(tableName: string, fn: ColumnsShapeCallback): Promise<void>;
  dropTable(
    tableName: string,
    cbOrOptions: ColumnsShapeCallback | TableOptions,
    cb?: ColumnsShapeCallback,
  ) {
    const options = typeof cbOrOptions === 'function' ? {} : cbOrOptions;
    const fn = (cb || cbOrOptions) as ColumnsShapeCallback;

    return createTable(this, !this.up, tableName, options, fn);
  }

  createJoinTable(
    tables: string[],
    options?: JoinTableOptions,
    fn?: ColumnsShapeCallback,
  ): Promise<void>;
  createJoinTable(tables: string[], fn?: ColumnsShapeCallback): Promise<void>;
  async createJoinTable(
    tables: string[],
    cbOrOptions?: ColumnsShapeCallback | JoinTableOptions,
    cb?: ColumnsShapeCallback,
  ): Promise<void> {
    const options = typeof cbOrOptions === 'function' ? {} : cbOrOptions || {};
    const fn = (cb || cbOrOptions) as ColumnsShapeCallback | undefined;

    return createJoinTable(this, this.up, tables, options, fn);
  }

  dropJoinTable(
    tables: string[],
    options?: JoinTableOptions,
    fn?: ColumnsShapeCallback,
  ): Promise<void>;
  dropJoinTable(tables: string[], fn?: ColumnsShapeCallback): Promise<void>;
  async dropJoinTable(
    tables: string[],
    cbOrOptions?: ColumnsShapeCallback | JoinTableOptions,
    cb?: ColumnsShapeCallback,
  ): Promise<void> {
    const options = typeof cbOrOptions === 'function' ? {} : cbOrOptions || {};
    const fn = (cb || cbOrOptions) as ColumnsShapeCallback | undefined;

    return createJoinTable(this, !this.up, tables, options, fn);
  }

  changeTable(
    tableName: string,
    options: ChangeTableOptions,
    fn?: ChangeTableCallback,
  ): Promise<void>;
  changeTable(tableName: string, fn: ChangeTableCallback): Promise<void>;
  changeTable(
    tableName: string,
    cbOrOptions: ChangeTableCallback | ChangeTableOptions,
    cb?: ChangeTableCallback,
  ) {
    const [fn, options] =
      typeof cbOrOptions === 'function' ? [cbOrOptions, {}] : [cb, cbOrOptions];

    return changeTable(this, this.up, tableName, options, fn);
  }

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

    await this.query(
      `ALTER TABLE ${quoteWithSchema({
        schema: ast.fromSchema,
        name: ast.from,
      })} RENAME TO ${quoteWithSchema({
        schema: ast.toSchema,
        name: ast.to,
      })}`,
    );

    await runCodeUpdater(this, ast);
  }

  addColumn(
    tableName: string,
    columnName: string,
    fn: (t: MigrationColumnTypes) => ColumnType,
  ) {
    return addColumn(this, this.up, tableName, columnName, fn);
  }

  dropColumn(
    tableName: string,
    columnName: string,
    fn: (t: MigrationColumnTypes) => ColumnType,
  ) {
    return addColumn(this, !this.up, tableName, columnName, fn);
  }

  addIndex(
    tableName: string,
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ) {
    return addIndex(this, this.up, tableName, columns, options);
  }

  dropIndex(
    tableName: string,
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ) {
    return addIndex(this, !this.up, tableName, columns, options);
  }

  addForeignKey(
    tableName: string,
    columns: [string, ...string[]],
    foreignTable: string,
    foreignColumns: [string, ...string[]],
    options?: ForeignKeyOptions,
  ) {
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

  dropForeignKey(
    tableName: string,
    columns: [string, ...string[]],
    foreignTable: string,
    foreignColumns: [string, ...string[]],
    options?: ForeignKeyOptions,
  ) {
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

  addPrimaryKey(
    tableName: string,
    columns: string[],
    options?: { name?: string },
  ) {
    return addPrimaryKey(this, this.up, tableName, columns, options);
  }

  dropPrimaryKey(
    tableName: string,
    columns: string[],
    options?: { name?: string },
  ) {
    return addPrimaryKey(this, !this.up, tableName, columns, options);
  }

  renameColumn(tableName: string, from: string, to: string) {
    return this.changeTable(tableName, (t) => ({
      [from]: t.rename(to),
    }));
  }

  createSchema(schemaName: string) {
    return createSchema(this, this.up, schemaName);
  }

  dropSchema(schemaName: string) {
    return createSchema(this, !this.up, schemaName);
  }

  createExtension(
    name: string,
    options: ExtensionOptions & { ifNotExists?: boolean } = {},
  ) {
    return createExtension(this, this.up, name, options);
  }

  dropExtension(
    name: string,
    options: { ifExists?: boolean; cascade?: boolean } = {},
  ) {
    return createExtension(this, !this.up, name, options);
  }

  async tableExists(tableName: string) {
    return queryExists(this, {
      text: `SELECT 1 FROM "information_schema"."tables" WHERE "table_name" = $1`,
      values: [tableName],
    });
  }

  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    return queryExists(this, {
      text: `SELECT 1 FROM "information_schema"."columns" WHERE "table_name" = $1 AND "column_name" = $2`,
      values: [tableName, columnName],
    });
  }

  async constraintExists(constraintName: string): Promise<boolean> {
    return queryExists(this, {
      text: `SELECT 1 FROM "information_schema"."table_constraints" WHERE "constraint_name" = $1`,
      values: [constraintName],
    });
  }
}

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

const addColumn = (
  migration: Migration,
  up: boolean,
  tableName: string,
  columnName: string,
  fn: (t: MigrationColumnTypes) => ColumnType,
) => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    [columnName]: t.add(fn(t)),
  }));
};

const addIndex = (
  migration: Migration,
  up: boolean,
  tableName: string,
  columns: MaybeArray<string | IndexColumnOptions>,
  options?: IndexOptions,
) => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.index(columns, options)),
  }));
};

const addForeignKey = (
  migration: Migration,
  up: boolean,
  tableName: string,
  columns: [string, ...string[]],
  foreignTable: string,
  foreignColumns: [string, ...string[]],
  options?: ForeignKeyOptions,
) => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.foreignKey(columns, foreignTable, foreignColumns, options)),
  }));
};

const addPrimaryKey = (
  migration: Migration,
  up: boolean,
  tableName: string,
  columns: string[],
  options?: { name?: string },
) => {
  return changeTable(migration, up, tableName, {}, (t) => ({
    ...t.add(t.primaryKey(columns, options)),
  }));
};

const createSchema = async (
  migration: Migration,
  up: boolean,
  name: string,
) => {
  const ast: RakeDbAst.Schema = {
    type: 'schema',
    action: up ? 'create' : 'drop',
    name,
  };

  await migration.query(
    `${ast.action === 'create' ? 'CREATE' : 'DROP'} SCHEMA "${name}"`,
  );

  await runCodeUpdater(migration, ast);
};

const createExtension = async (
  migration: Migration,
  up: boolean,
  name: string,
  options: ExtensionOptions & {
    checkExists?: boolean;
  },
) => {
  const ast: RakeDbAst.Extension = {
    type: 'extension',
    action: up ? 'create' : 'drop',
    name,
    ...options,
  };

  let query;
  if (ast.action === 'drop') {
    query = `DROP EXTENSION${ast.ifNotExists ? ' IF EXISTS' : ''} "${
      ast.name
    }"${ast.cascade ? ' CASCADE' : ''}`;
  } else {
    query = `CREATE EXTENSION${ast.ifExists ? ' IF NOT EXISTS' : ''} "${
      ast.name
    }"${ast.schema ? ` SCHEMA "${ast.schema}"` : ''}${
      ast.version ? ` VERSION '${ast.version}'` : ''
    }${ast.cascade ? ' CASCADE' : ''}`;
  }

  await migration.query(query);

  await runCodeUpdater(migration, ast);
};

const queryExists = (
  db: Migration,
  sql: { text: string; values: unknown[] },
) => {
  return db.query(sql).then(({ rowCount }) => rowCount > 0);
};

export const runCodeUpdater = (migration: Migration, ast: RakeDbAst) => {
  return migration.options.appCodeUpdater?.({
    ast,
    options: migration.adapterOptions,
    cache: migration.appCodeUpdaterCache,
  });
};
