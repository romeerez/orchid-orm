import { updateTableFile } from './updateTableFile';
import {
  asMock,
  ast,
  makeTestWritten,
  tablePath,
  updateTableFileParams,
} from '../testUtils';
import { dirname } from 'path';
import fs from 'fs/promises';
import { columnTypes } from 'pqb';
import { pathToLog, raw } from 'orchid-core';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

const t = columnTypes;

const params = updateTableFileParams;

const path = tablePath('fooBar');
const testWrittenOnly = makeTestWritten(path);
const testWritten = (content: string) => {
  testWrittenOnly(content);
  expect(params.logger.log).toBeCalledWith(`Created ${pathToLog(path)}`);
};

const template = ({
  imports,
  schema,
  columns,
  noPrimaryKey,
  relations,
}: {
  imports?: string[];
  schema?: string;
  columns: string;
  noPrimaryKey?: boolean;
  relations?: string;
}) => `import { BaseTable } from '../baseTable';${
  imports ? `\n${imports.join('\n')}` : ''
}

export class FooBarTable extends BaseTable {
  ${schema ? `schema = '${schema}';\n  ` : ''}readonly table = 'foo_bar';${
  noPrimaryKey ? '\n  noPrimaryKey = true;' : ''
}
  columns = this.setColumns((t) => (${columns}));${
  relations
    ? `
  
  relations = {
    ${relations.trim()}
  };`
    : ''
}
}
`;

describe('createTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    params.clearTables();
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

    expect(params.tables).toEqual({
      [ast.addTable.name]: {
        key: 'fooBar',
        name: 'FooBarTable',
        path: tablePath('fooBar'),
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

  describe('relations', () => {
    describe('belongsTo', () => {
      it('should add relation if table has a foreign key to another table', async () => {
        params.tables.other = {
          key: 'other',
          name: 'OtherTable',
          path: params.tablePath('other'),
        };

        await updateTableFile({
          ...params,
          ast: {
            ...ast.addTable,
            shape: {
              otherId: t.integer().foreignKey('other', 'id'),
            },
          },
        });

        expect(params.relations).toEqual({
          other: {
            path: params.tables.other.path,
            relations: [
              {
                kind: 'hasMany',
                columns: ['id'],
                className: 'FooBarTable',
                path: params.tablePath('fooBar'),
                foreignColumns: ['otherId'],
              },
            ],
          },
        });

        testWritten(
          template({
            imports: [`import { OtherTable } from './other.table';`],
            columns: `{
    otherId: t.integer().foreignKey('other', 'id'),
  }`,
            relations: `
    other: this.belongsTo(() => OtherTable, {
      primaryKey: 'id',
      foreignKey: 'otherId',
    }),`,
          }),
        );
      });
    });
  });
});
