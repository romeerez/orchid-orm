import { RakeDbAst } from 'rake-db';
import { columnTypes, QueryLogOptions } from 'pqb';
import path, { resolve } from 'path';
import fs from 'fs/promises';
import { UpdateTableFileParams } from './updateTableFile/updateTableFile';

export const asMock = (fn: unknown) => fn as jest.Mock;
export const tablePath = (table: string) =>
  path.resolve(`tables/${table}.table.ts`);

const baseTablePath = resolve('baseTable.ts');
const baseTableName = 'BaseTable';

const log = jest.fn();

export const testLogger = { ...console, log };

export const updateTableFileParams: Omit<UpdateTableFileParams, 'ast'> & {
  logger: Exclude<QueryLogOptions['logger'], undefined>;
  clearTables(): void;
} = {
  tablePath,
  logger: testLogger,
  baseTable: {
    filePath: baseTablePath,
    name: baseTableName,
  },
  async getTable(name) {
    return updateTableFileParams.tables[name];
  },
  clearTables() {
    updateTableFileParams.tables = {};
  },
  tables: {},
  relations: {},
};

const makeAst = () => {
  const addTable: RakeDbAst.Table = {
    type: 'table',
    action: 'create',
    name: 'foo_bar',
    shape: {
      id: columnTypes.identity().primaryKey(),
    },
    noPrimaryKey: 'error',
  };

  const dropTable: RakeDbAst.Table = {
    ...addTable,
    action: 'drop',
  };

  const renameTable: RakeDbAst.RenameTable = {
    type: 'renameTable',
    from: 'foo_bar',
    to: 'bip_bop',
  };

  const tableData = {
    indexes: [],
    foreignKeys: [],
  };

  const changeTable: RakeDbAst.ChangeTable = {
    type: 'changeTable',
    name: 'foo_bar',
    shape: {},
    add: tableData,
    drop: tableData,
  };

  return { addTable, dropTable, renameTable, changeTable };
};

export const ast = makeAst();

export const makeTestWritten = (path: string) => (expected: string) => {
  const [args] = asMock(fs.writeFile).mock.calls;
  expect(args[0]).toBe(path);
  expect(args[1]).toBe(expected);
};
