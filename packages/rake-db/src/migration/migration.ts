import {
  ColumnsShape,
  ColumnType,
  ColumnTypes,
  ForeignKeyOptions,
  IndexColumnOptions,
  IndexOptions,
  MaybeArray,
  TransactionAdapter,
} from 'pqb';
import { createJoinTable, createTable } from './createTable';
import { changeTable, TableChangeData, TableChanger } from './changeTable';

export type DropMode = 'CASCADE' | 'RESTRICT';

export type TableOptions = { dropMode?: DropMode; comment?: string };
export type ColumnsShapeCallback = (t: ColumnTypes) => ColumnsShape;

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

export class Migration extends TransactionAdapter {
  constructor(tx: TransactionAdapter, public up: boolean) {
    super(tx.pool, tx.client, tx.types);
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
    await this.query(`ALTER TABLE "${table}" RENAME TO "${newName}"`);
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

const queryExists = (
  db: Migration,
  sql: { text: string; values: unknown[] },
) => {
  return db.query(sql).then(({ rowCount }) => rowCount > 0);
};
