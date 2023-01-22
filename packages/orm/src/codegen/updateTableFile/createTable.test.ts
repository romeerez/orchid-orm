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

const template = ({
  schema,
  columns,
  noPrimaryKey,
}: {
  schema?: string;
  columns: string;
  noPrimaryKey?: boolean;
}) => `import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  ${schema ? `schema = '${schema}';\n  ` : ''}table = 'table';${
  noPrimaryKey ? '\n  noPrimaryKey = true;' : ''
}
  columns = this.setColumns((t) => (${columns}));
}
`;

describe('createTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add table', async () => {
    await updateTableFile({
      ...params,
      ast: {
        ...ast.addTable,
        schema: 'schema',
        shape: {},
      },
    });

    expect(asMock(fs.mkdir)).toBeCalledWith(path.dirname(tablePath('table')), {
      recursive: true,
    });

    testWritten(
      template({
        schema: 'schema',
        columns: `{

  }`,
      }),
    );
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

    testWritten(
      template({
        columns: `{
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
  }`,
      }),
    );
  });

  it('should add noPrimaryKey prop when noPrimaryKey is `ignore` in ast', async () => {
    await updateTableFile({
      ...params,
      ast: { ...ast.addTable, noPrimaryKey: 'ignore' },
    });

    testWritten(
      template({
        noPrimaryKey: true,
        columns: `{
    id: t.serial().primaryKey(),
  }`,
      }),
    );
  });
});
