import { updateTableFile } from './updateTableFile';
import { asMock, ast, makeTestWritten, tablePath } from '../testUtils';
import path from 'path';
import fs from 'fs/promises';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const baseTablePath = path.resolve('baseTable.ts');
const baseTableName = 'BaseTable';
const params = { baseTablePath, baseTableName, tablePath };

const testWritten = makeTestWritten(tablePath('renamedTable'));

describe('renameTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should only change `table` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({}));
}`);

    await updateTableFile({
      ...params,
      ast: ast.renameTable,
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'renamedTable';
  columns = this.setColumns((t) => ({}));
}`);
  });
});
