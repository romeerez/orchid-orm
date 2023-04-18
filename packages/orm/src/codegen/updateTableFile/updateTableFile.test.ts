import { updateTableFile } from './updateTableFile';
import { ast, updateTableFileParams } from '../testUtils';
import { createTable } from './createTable';
import { changeTable } from './changeTable';
import { renameTable } from './renameTable';
import { handleForeignKey } from './handleForeignKey';

jest.mock('./createTable', () => ({
  createTable: jest.fn(),
}));

jest.mock('./changeTable', () => ({
  changeTable: jest.fn(),
}));

jest.mock('./renameTable', () => ({
  renameTable: jest.fn(),
}));

jest.mock('./handleForeignKey', () => ({
  handleForeignKey: jest.fn(),
}));

const params = updateTableFileParams;

describe('updateTableFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call createTable', async () => {
    const arg = {
      ...params,
      ast: ast.addTable,
    };

    await updateTableFile(arg);

    expect(createTable).toBeCalledWith(arg);
  });

  it('should call changeTable', async () => {
    const arg = {
      ...params,
      ast: ast.changeTable,
    };

    await updateTableFile(arg);

    expect(changeTable).toBeCalledWith(arg);
  });

  it('should call renameTable', async () => {
    const arg = {
      ...params,
      ast: ast.renameTable,
    };

    await updateTableFile(arg);

    expect(renameTable).toBeCalledWith(arg);
  });

  it('should call handleForeignKey', async () => {
    const arg = {
      ...params,
      ast: {
        type: 'constraint' as const,
        action: 'create' as const,
        tableName: 'table',
        references: {
          columns: ['id'],
          fnOrTable: 'otherTable',
          foreignColumns: ['otherId'],
        },
      },
    };

    await updateTableFile(arg);

    expect(handleForeignKey).toBeCalledWith({
      getTable: params.getTable,
      relations: params.relations,
      tableName: 'table',
      columns: ['id'],
      foreignTableName: 'otherTable',
      foreignColumns: ['otherId'],
    });
  });
});
