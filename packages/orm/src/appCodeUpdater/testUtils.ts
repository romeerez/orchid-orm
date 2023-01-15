import { RakeDbAst } from 'rake-db';
import { columnTypes } from 'pqb';

const makeAst = () => {
  const addTable: RakeDbAst.Table = {
    type: 'table',
    action: 'create',
    name: 'table',
    shape: {
      id: columnTypes.serial().primaryKey(),
    },
    noPrimaryKey: 'ignore',
    indexes: [],
    foreignKeys: [],
  };

  const dropTable: RakeDbAst.Table = {
    ...addTable,
    action: 'drop',
  };

  const renameTable: RakeDbAst.RenameTable = {
    type: 'renameTable',
    from: 'table',
    to: 'renamedTable',
  };

  return { addTable, dropTable, renameTable };
};

export const ast = makeAst();
