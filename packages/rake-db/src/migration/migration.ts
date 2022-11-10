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
  QueryLogOptions,
  QueryResult,
  QueryResultRow,
  Sql,
  TransactionAdapter,
  TypeParsers,
  raw,
} from 'pqb';
import { createJoinTable, createTable } from './createTable';
import { changeTable, TableChangeData, TableChanger } from './changeTable';
import { quoteTable } from '../common';

export type DropMode = 'CASCADE' | 'RESTRICT';

export type TableOptions = { dropMode?: DropMode; comment?: string };
export type ColumnsShapeCallback = (
  t: ColumnTypes & { raw: typeof raw },
) => ColumnsShape;

export type ChangeTableOptions = { comment?: string | [string, string] | null };
export type ChangeTableCallback = (t: TableChanger) => TableChangeData;

export type ColumnIndex = {
  columns: IndexColumnOptions[];
  options: IndexOptions;
};
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
    options: QueryLogOptions,
  ) {
    super(tx.pool, tx.client, tx.types);
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
    const [table, newName] = this.up ? [from, to] : [to, from];
    await this.query(`ALTER TABLE ${quoteTable(table)} RENAME TO "${newName}"`);
  }

  addColumn(
    tableName: string,
    columnName: string,
    fn: (t: ColumnTypes) => ColumnType,
  ) {
    return addColumn(this, this.up, tableName, columnName, fn);
  }

  dropColumn(
    tableName: string,
    columnName: string,
    fn: (t: ColumnTypes) => ColumnType,
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
    return createExtension(this, this.up, name, {
      ...options,
      checkExists: options.ifNotExists,
    });
  }

  dropExtension(
    name: string,
    options: { ifExists?: boolean; cascade?: boolean } = {},
  ) {
    return createExtension(this, !this.up, name, {
      ...options,
      checkExists: options.ifExists,
    });
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
  fn: (t: ColumnTypes) => ColumnType,
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

const createSchema = (
  migration: Migration,
  up: boolean,
  schemaName: string,
) => {
  if (up) {
    return migration.query(`CREATE SCHEMA "${schemaName}"`);
  } else {
    return migration.query(`DROP SCHEMA "${schemaName}"`);
  }
};

const createExtension = (
  migration: Migration,
  up: boolean,
  name: string,
  options: ExtensionOptions & {
    checkExists?: boolean;
  },
) => {
  if (!up) {
    return migration.query(
      `DROP EXTENSION${options.checkExists ? ' IF EXISTS' : ''} "${name}"${
        options.cascade ? ' CASCADE' : ''
      }`,
    );
  }

  return migration.query(
    `CREATE EXTENSION${options.checkExists ? ' IF NOT EXISTS' : ''} "${name}"${
      options.schema ? ` SCHEMA "${options.schema}"` : ''
    }${options.version ? ` VERSION '${options.version}'` : ''}${
      options.cascade ? ' CASCADE' : ''
    }`,
  );
};

const queryExists = (
  db: Migration,
  sql: { text: string; values: unknown[] },
) => {
  return db.query(sql).then(({ rowCount }) => rowCount > 0);
};
