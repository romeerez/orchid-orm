import { updateTableFile } from './updateTableFile';
import { asMock, ast, makeTestWritten, tablePath } from '../testUtils';
import path from 'path';
import fs from 'fs/promises';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

const baseTablePath = path.resolve('baseTable.ts');
const baseTableName = 'BaseTable';
const params = { baseTablePath, baseTableName, tablePath };

const testWritten = makeTestWritten(tablePath('table'));

describe('createTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add table', async () => {
    await updateTableFile({
      ...params,
      ast: {
        ...ast.addTable,
        primaryKey: {
          columns: ['one', 'two'],
          options: { name: 'name' },
        },
        indexes: [
          {
            columns: [{ column: 'one' }, { column: 'two' }],
            options: { name: 'indexName', unique: true },
          },
        ],
        foreignKeys: [
          {
            columns: ['one', 'two'],
            fnOrTable: 'table',
            foreignColumns: ['three', 'four'],
            options: { name: 'foreignKeyName' },
          },
        ],
      },
    });

    expect(asMock(fs.mkdir)).toBeCalledWith(path.dirname(tablePath('table')), {
      recursive: true,
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    ...t.primaryKey(['one', 'two'], { name: 'name' }),
    ...t.index(['one', 'two'], {
      name: 'indexName',
      unique: true,
    }),
    ...t.foreignKey(
      ['one', 'two'],
      'table',
      ['three', 'four'],
      {
        name: 'foreignKeyName',
      },
    ),
  }));
}
`);
  });

  it('should add noPrimaryKey prop when noPrimaryKey is `ignore` in ast', async () => {
    await updateTableFile({
      ...params,
      ast: { ...ast.addTable, noPrimaryKey: 'ignore' },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  noPrimaryKey = true;
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }));
}
`);
  });
});
