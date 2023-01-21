import { appCodeUpdater } from './appCodeUpdater';
import { asMock, ast } from './testUtils';
import { updateMainFile } from './updateMainFile';
import * as path from 'path';
import { updateTableFile } from './updateTableFile/updateTableFile';

jest.mock('./updateMainFile', () => ({
  updateMainFile: jest.fn(),
}));

jest.mock('./updateTableFile/updateTableFile', () => ({
  updateTableFile: jest.fn(),
}));

describe('appCodeUpdater', () => {
  it('should call table and file updaters with proper arguments', async () => {
    const params = {
      tablePath: (table: string) => `tables/${table}.ts`,
      baseTablePath: 'baseTable.ts',
      baseTableName: 'BaseTable',
      mainFilePath: 'db.ts',
    };

    const fn = appCodeUpdater(params);

    await fn(ast.addTable);

    const mainFilePath = path.resolve(params.mainFilePath);
    const tablePath = path.resolve(params.tablePath('table'));

    const main = asMock(updateMainFile).mock.calls[0];
    expect(main[0]).toBe(mainFilePath);
    expect(main[1]('table')).toBe(tablePath);
    expect(main[2]).toBe(ast.addTable);

    const [table] = asMock(updateTableFile).mock.calls[0];
    expect(table.tablePath('table')).toBe(tablePath);
    expect(table.baseTablePath).toBe(params.baseTablePath);
    expect(table.baseTableName).toBe(params.baseTableName);
    expect(table.mainFilePath).toBe(mainFilePath);
  });
});
