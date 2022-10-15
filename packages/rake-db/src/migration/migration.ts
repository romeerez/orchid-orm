import {
  ColumnsShape,
  ColumnTypes,
  IndexColumnOptions,
  IndexOptions,
  TransactionAdapter,
} from 'pqb';
import { createTable } from './createTable';
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
  ) {
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

  changeTable(
    tableName: string,
    options: ChangeTableOptions,
    fn: ChangeTableCallback,
  ): Promise<void>;
  changeTable(tableName: string, fn: ChangeTableCallback): Promise<void>;
  changeTable(
    tableName: string,
    cbOrOptions: ChangeTableCallback | ChangeTableOptions,
    cb?: ChangeTableCallback,
  ) {
    const options = typeof cbOrOptions === 'function' ? {} : cbOrOptions;
    const fn = (cb || cbOrOptions) as ChangeTableCallback;

    return changeTable(this, tableName, options, fn);
  }
}
