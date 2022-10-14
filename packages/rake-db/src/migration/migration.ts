import { ColumnsShape, ColumnTypes, TransactionAdapter } from 'pqb';
import { createTable } from './createTable';
import { changeTable, TableChangeData, TableChanger } from './changeTable';

export type TableOptions = { comment?: string };
export type ColumnsShapeCallback = (t: ColumnTypes) => ColumnsShape;

export type ChangeTableOptions = { comment?: string | [string, string] | null };
export type ChangeTableCallback = (t: TableChanger) => TableChangeData;

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

    return createTable(this, tableName, options, fn);
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
