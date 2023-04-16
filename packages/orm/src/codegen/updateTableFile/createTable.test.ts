import { updateTableFile } from './updateTableFile';
import { asMock, ast, makeTestWritten, tablePath } from '../testUtils';
import { resolve, dirname } from 'path';
import fs from 'fs/promises';
import { columnTypes } from 'pqb';
import { pathToLog, raw } from 'orchid-core';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

const t = columnTypes;

const baseTablePath = resolve('baseTable.ts');
const baseTableName = 'BaseTable';
const log = jest.fn();
const params = {
  tablePath,
  logger: { ...console, log },
  baseTable: {
    filePath: baseTablePath,
    name: baseTableName,
  },
};

const path = tablePath('fooBar');
const testWrittenOnly = makeTestWritten(path);
const testWritten = (content: string) => {
  testWrittenOnly(content);
  expect(log).toBeCalledWith(`Created ${pathToLog(path)}`);
};

const template = ({
  schema,
  columns,
  noPrimaryKey,
}: {
  schema?: string;
  columns: string;
  noPrimaryKey?: boolean;
}) => `import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  ${schema ? `schema = '${schema}';\n  ` : ''}readonly table = 'foo_bar';${
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

    expect(asMock(fs.mkdir)).toBeCalledWith(dirname(tablePath('fooBar')), {
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

  it('should add table with primary key, indexes, foreign keys, checks, constraints', async () => {
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
            options: {
              name: 'indexName',
              unique: true,
              nullsNotDistinct: true,
            },
          },
        ],
        constraints: [
          {
            references: {
              columns: ['one', 'two'],
              fnOrTable: 'fooBar',
              foreignColumns: ['three', 'four'],
              options: { name: 'foreignKeyName' },
            },
          },
          {
            check: raw('check'),
          },
          {
            name: 'constraint',
            references: {
              columns: ['one', 'two'],
              fnOrTable: 'fooBar',
              foreignColumns: ['three', 'four'],
            },
            check: raw('check'),
          },
        ],
      },
    });

    testWritten(
      template({
        columns: `{
    id: t.identity().primaryKey(),
    ...t.primaryKey(['one', 'two'], { name: 'name' }),
    ...t.index(['one', 'two'], {
      name: 'indexName',
      unique: true,
      nullsNotDistinct: true,
    }),
    ...t.foreignKey(
      ['one', 'two'],
      'fooBar',
      ['three', 'four'],
      {
        name: 'foreignKeyName',
      },
    ),
    ...t.check(t.raw('check')),
    ...t.constraint({
      name: 'constraint',
      references: [
        ['one', 'two'],
        'fooBar',
        ['three', 'four'],
      ],
      check: t.raw('check'),
    }),
  }`,
      }),
    );
  });

  it('should add table with columns', async () => {
    await updateTableFile({
      ...params,
      ast: {
        ...ast.addTable,
        shape: {
          column: t.name('name').integer(),
          domain: t.domain('domainName').as(t.integer()),
          custom: t.type('customType').as(t.integer()),
        },
      },
    });

    testWritten(
      template({
        columns: `{
    column: t.name('name').integer(),
    domain: t.domain('domainName').as(t.integer()),
    custom: t.type('customType').as(t.integer()),
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
    id: t.identity().primaryKey(),
  }`,
      }),
    );
  });

  it('should create file with wx flag', async () => {
    asMock(fs.writeFile).mockRejectedValue(
      Object.assign(new Error(), { code: 'EEXIST' }),
    );

    await updateTableFile({ ...params, ast: ast.addTable });

    const [, , options] = asMock(fs.writeFile).mock.calls[0];
    expect(options).toEqual({ flag: 'wx' });
  });
});
