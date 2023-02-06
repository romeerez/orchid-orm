import { appCodeUpdater } from './appCodeUpdater';
import { asMock, ast } from './testUtils';
import { updateMainFile } from './updateMainFile';
import path from 'path';
import { updateTableFile } from './updateTableFile/updateTableFile';
import { createBaseTableFile } from './createBaseTableFile';

jest.mock('./updateMainFile', () => ({
  updateMainFile: jest.fn(),
}));

jest.mock('./updateTableFile/updateTableFile', () => ({
  updateTableFile: jest.fn(),
}));

jest.mock('./createBaseTableFile', () => ({
  createBaseTableFile: jest.fn(() => Promise.resolve()),
}));

describe('appCodeUpdater', () => {
  beforeEach(jest.clearAllMocks);

  const params = {
    tablePath: (table: string) => `tables/${table}.ts`,
    baseTablePath: 'baseTable.ts',
    baseTableName: 'BaseTable',
    mainFilePath: 'db.ts',
  };

  const fn = appCodeUpdater(params);

  it('should call table and file updaters with proper arguments', async () => {
    await fn({
      ast: ast.addTable,
      options: {},
      basePath: __dirname,
      cache: {},
    });

    const mainFilePath = path.resolve(__dirname, params.mainFilePath);
    const tablePath = path.resolve(__dirname, params.tablePath('table'));

    const main = asMock(updateMainFile).mock.calls[0];
    expect(main[0]).toBe(mainFilePath);
    expect(main[1]('table')).toBe(tablePath);
    expect(main[2]).toBe(ast.addTable);

    const [table] = asMock(updateTableFile).mock.calls[0];
    expect(table.tablePath('table')).toBe(tablePath);
    expect(table.baseTablePath).toBe(
      path.resolve(__dirname, params.baseTablePath),
    );
    expect(table.baseTableName).toBe(params.baseTableName);
    expect(table.mainFilePath).toBe(mainFilePath);

    const [base] = asMock(createBaseTableFile).mock.calls[0];
    expect(base.baseTablePath).toBe(
      path.resolve(__dirname, params.baseTablePath),
    );
    expect(base.baseTableName).toBe(params.baseTableName);
  });

  it('should call createBaseTable only on first call', async () => {
    const cache = {};
    expect(createBaseTableFile).not.toBeCalled();

    await fn({ ast: ast.addTable, options: {}, basePath: __dirname, cache });

    expect(createBaseTableFile).toBeCalledTimes(1);

    await fn({ ast: ast.addTable, options: {}, basePath: __dirname, cache });

    expect(createBaseTableFile).toBeCalledTimes(1);
  });
});
