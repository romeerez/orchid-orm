import { RakeDbAst } from 'rake-db';
import { columnTypes } from 'pqb';
import path from 'path';
import fs from 'fs/promises';

export const asMock = (fn: unknown) => fn as jest.Mock;
export const tablePath = (table: string) =>
  path.resolve(`tables/${table}.table.ts`);

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
