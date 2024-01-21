import fs from 'fs/promises';
import {
  asMock,
  ast,
  makeTestWritten,
  tablePath,
  updateTableFileParams,
} from '../testUtils';
import { updateTableFile } from './updateTableFile';
import { makeColumnTypes, newTableData, TableData, raw } from 'pqb';
import { RakeDbAst } from 'rake-db';
import { pathToLog } from 'orchid-core';
import { z } from 'zod';
import { zodSchemaConfig } from 'schema-to-zod';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const params = updateTableFileParams;

const t = makeColumnTypes(zodSchemaConfig);

const path = tablePath('fooBar');
const testWrittenOnly = makeTestWritten(path);
const testWritten = (content: string) => {
  testWrittenOnly(content);
  expect(params.logger.log).toBeCalledWith(`Updated ${pathToLog(path)}`);
};

const tableData = newTableData();

const change = (
  data: Partial<RakeDbAst.ChangeTableItem.Change>,
): RakeDbAst.ChangeTableItem.Change => ({
  type: 'change',
  from: {},
  to: {},
  ...data,
});

class Table {
  readonly table = 'foo_bar';
  columns = {};
}

const template = (
  columns?: string,
  { asIs }: { asIs?: boolean } = {},
) => `import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  readonly table = 'foo_bar';
  columns = this.setColumns((t) => ({${
    columns ? (asIs ? columns : `\n    ${columns.trim()}\n  `) : ''
  }}));
}`;

describe('updateTableFile', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add a single column into empty columns list', async () => {
    asMock(fs.readFile).mockResolvedValue(template());

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'add', item: t.text(1, 10) },
        },
      },
    });

    testWritten(template(`name: t.text(1, 10),`));
  });

  it('should add a single column', async () => {
    asMock(fs.readFile).mockResolvedValue(
      template(`id: t.identity().primaryKey(),`),
    );

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'add', item: t.text(1, 10) },
        },
      },
    });

    testWritten(
      template(`
    id: t.identity().primaryKey(),
    name: t.text(1, 10),
`),
    );
  });

  it('should add a single column with custom name', async () => {
    asMock(fs.readFile).mockResolvedValue(
      template(`id: t.identity().primaryKey(),`),
    );

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'add', item: t.name('name').text(1, 10) },
        },
      },
    });

    testWritten(
      template(`
    id: t.identity().primaryKey(),
    name: t.name('name').text(1, 10),
`),
    );
  });

  it('should add multiple columns', async () => {
    asMock(fs.readFile).mockResolvedValue(
      template(`id: t.identity().primaryKey(),`),
    );

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'add', item: t.text(1, 10) },
          active: { type: 'add', item: t.boolean() },
          domain: { type: 'add', item: t.domain('name').as(t.integer()) },
          custom: { type: 'add', item: t.type('customType').as(t.integer()) },
          json: {
            type: 'add',
            item: t.json(z.unknown()),
          },
        },
      },
    });

    testWritten(
      template(`
    id: t.identity().primaryKey(),
    name: t.text(1, 10),
    active: t.boolean(),
    domain: t.domain('name').as(t.integer()),
    custom: t.type('customType').as(t.integer()),
    json: t.json(),
`),
    );
  });

  it('should insert ending comma before adding', async () => {
    asMock(fs.readFile).mockResolvedValue(
      template(`id: t.identity().primaryKey()`),
    );

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'add', item: t.text(1, 10) },
          active: { type: 'add', item: t.boolean() },
        },
      },
    });

    testWritten(
      template(`
    id: t.identity().primaryKey(),
    name: t.text(1, 10),
    active: t.boolean(),
`),
    );
  });

  it('should drop column', async () => {
    asMock(fs.readFile).mockResolvedValue(
      template(`
    id: t.identity().primaryKey(),
    json: t.json((t) =>
      t.object({
        foo: t.string(),
      }),
    ),
    active: t.boolean(),
`),
    );

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          json: { type: 'drop', item: t.json() },
        },
      },
    });

    testWritten(
      template(`
    id: t.identity().primaryKey(),
    active: t.boolean(),
`),
    );
  });

  it('should drop column at the end', async () => {
    asMock(fs.readFile).mockResolvedValue(
      template(`
    id: t.identity().primaryKey(),
    name: t.text(),
`),
    );

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'drop', item: t.text(1, 10) },
        },
      },
    });

    testWritten(template(`id: t.identity().primaryKey(),`));
  });

  it('should change column type', async () => {
    asMock(fs.readFile).mockResolvedValue(template(`name: t.integer(),`));

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: {
            type: 'change',
            from: {},
            to: {
              column: t.text(1, 10),
              type: 'text',
            },
          },
        },
      },
    });

    testWritten(template(`name: t.text(1, 10),`));
  });

  it('should change properties', async () => {
    asMock(fs.readFile).mockResolvedValue(
      template(`
        changeCollate: t.text().collate('one'),
        addCollate: t.text(),
        dropCollate: t.text().collate('one'),
        changeDefault: t.text().default('one'),
        addDefault: t.text(),
        dropDefault: t.text().default('one'),
        addNullable: t.text(),
        dropNullable: t.text().nullable(),
        changeCompression: t.text().compression('one'),
        addCompression: t.text(),
        dropCompression: t.text().compression('one'),
        addPrimaryKey: t.text(),
        dropPrimaryKey: t.text().primaryKey(),
        addIdentity: t.integer(),
        changeIdentity: t.identity(),
        dropIdentity: t.identity(),
    `),
    );

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          changeCollate: change({ to: { collate: 'two' } }),
          addCollate: change({ to: { collate: 'two' } }),
          dropCollate: change({ from: { collate: 'two' } }),
          changeDefault: change({ to: { default: 'two' } }),
          addDefault: change({ to: { default: 'two' } }),
          dropDefault: change({ from: { default: 'two' } }),
          addNullable: change({ to: { nullable: true } }),
          dropNullable: change({ from: { nullable: true } }),
          changeCompression: change({ to: { compression: 'two' } }),
          addCompression: change({ to: { compression: 'two' } }),
          dropCompression: change({ from: { compression: 'two' } }),
          addPrimaryKey: change({ to: { primaryKey: true } }),
          dropPrimaryKey: change({ from: { primaryKey: true } }),
          addIdentity: change({
            from: { type: 'integer' },
            to: { type: 'integer', identity: {}, column: t.identity() },
          }),
          changeIdentity: change({
            from: { type: 'integer', identity: {} },
            to: {
              type: 'integer',
              identity: { always: true, startWith: 5 },
              column: t.identity(),
            },
          }),
          dropIdentity: change({
            from: { type: 'integer', identity: {} },
            to: { type: 'integer' },
          }),
        },
      },
    });

    testWritten(
      template(`
        changeCollate: t.text().collate('two'),
        addCollate: t.text().collate('two'),
        dropCollate: t.text(),
        changeDefault: t.text().default('two'),
        addDefault: t.text().default('two'),
        dropDefault: t.text(),
        addNullable: t.text().nullable(),
        dropNullable: t.text(),
        changeCompression: t.text().compression('two'),
        addCompression: t.text().compression('two'),
        dropCompression: t.text(),
        addPrimaryKey: t.text().primaryKey(),
        dropPrimaryKey: t.text(),
        addIdentity: t.identity(),
        changeIdentity: t.identity({
      always: true,
      startWith: 5,
    }),
        dropIdentity: t.integer(),
`),
    );
  });

  describe('primaryKey', () => {
    const result = template(
      `...t.primaryKey(['one', 'two'], { name: 'name' }),`,
    );

    const add = {
      ...tableData,
      primaryKey: {
        columns: ['one', 'two'],
        options: { name: 'name' },
      },
    };

    it('should change primaryKey', async () => {
      asMock(fs.readFile).mockResolvedValue(
        template(`...t.primaryKey(['foo', 'bar'], { name: 'baz' }),`),
      );

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          add,
        },
      });

      testWritten(result);
    });

    it('should add primaryKey', async () => {
      asMock(fs.readFile).mockResolvedValue(template(`\n  `, { asIs: true }));

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          add,
        },
      });

      testWritten(result);
    });
  });

  describe('indexes', () => {
    it('should change column indexes', async () => {
      asMock(fs.readFile).mockResolvedValue(
        template(
          `name: t.text().index({ order: 'one' }).index({ collate: 'en_US' })`,
        ),
      );

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          shape: {
            name: {
              type: 'change',
              from: { indexes: [{ order: 'one' }, { collate: 'en_US' }] },
              to: {
                indexes: [
                  { order: 'two' },
                  { collate: 'en_UK', unique: true, nullsNotDistinct: true },
                ],
              },
            },
          },
        },
      });

      testWritten(
        template(`
    name: t.text().index({
      order: 'two',
    }).unique({
      collate: 'en_UK',
      nullsNotDistinct: true,
    }),
`),
      );
    });

    it('should add column indexes', async () => {
      asMock(fs.readFile).mockResolvedValue(template(`name: t.text(),`));

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          shape: {
            name: {
              type: 'change',
              from: {},
              to: {
                indexes: [
                  { order: 'two' },
                  { collate: 'fr_FR', unique: true, nullsNotDistinct: true },
                ],
              },
            },
          },
        },
      });

      testWritten(
        template(`
    name: t.text().index({
      order: 'two',
    }).unique({
      collate: 'fr_FR',
      nullsNotDistinct: true,
    }),
`),
      );
    });

    const result = template(`
    ...t.index(['6']),
    ...t.index(['7', '8']),
    ...t.index(
      [
        '9',
        {
          column: '10',
          order: 'new',
        },
      ],
      {
        name: 'newName',
      },
    ),
`);

    const add = {
      ...tableData,
      indexes: [
        {
          columns: [{ column: '6' }],
          options: {},
        },
        {
          columns: [{ column: '7' }, { column: '8' }],
          options: {},
        },
        {
          columns: [{ column: '9' }, { column: '10', order: 'new' }],
          options: { name: 'newName' },
        },
      ],
    };

    it('should change indexes', async () => {
      asMock(fs.readFile).mockResolvedValue(
        template(`
    ...t.index('1'),
    ...t.index(['2', '3']),
    ...t.index(['4', { column: '5', order: 'order' }], { name: 'indexName' }),
`),
      );

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          drop: {
            ...tableData,
            indexes: [
              {
                columns: [{ column: '1' }],
                options: {},
              },
              {
                columns: [{ column: '2' }, { column: '3' }],
                options: {},
              },
              {
                columns: [{ column: '4' }, { column: '5', order: 'order' }],
                options: { name: 'indexName' },
              },
            ],
          },
          add,
        },
      });

      testWritten(result);
    });

    it('should add indexes', async () => {
      asMock(fs.readFile).mockResolvedValue(template(`\n  `, { asIs: true }));

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          add,
        },
      });

      testWritten(result);
    });

    it('should add column indexes', async () => {
      asMock(fs.readFile).mockResolvedValue(template(`name: t.text(),`));

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          shape: {
            name: {
              type: 'change',
              from: {},
              to: {
                foreignKeys: [
                  { table: 'e', columns: ['f'] },
                  { table: 'g', columns: ['h'] },
                ],
              },
            },
          },
        },
      });

      testWritten(
        template(`name: t.text().foreignKey('e', 'f').foreignKey('g', 'h'),`),
      );
    });
  });

  describe('foreignKeys', () => {
    it('should change column foreignKeys', async () => {
      asMock(fs.readFile).mockResolvedValue(
        template(`name: t.text().foreignKey('a', 'b').foreignKey('c', 'd')`),
      );

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          shape: {
            name: {
              type: 'change',
              from: {
                foreignKeys: [
                  { table: 'a', columns: ['b'] },
                  { table: 'c', columns: ['d'] },
                ],
              },
              to: {
                foreignKeys: [
                  { table: 'e', columns: ['f'] },
                  { table: 'g', columns: ['h'] },
                ],
              },
            },
          },
        },
      });

      testWritten(
        template(`name: t.text().foreignKey('e', 'f').foreignKey('g', 'h'),`),
      );
    });

    const result = template(`
    ...t.foreignKey(
      ['7'],
      'foo_bar',
      ['8'],
      {
        name: 'first',
        match: 'PARTIAL',
      },
    ),
    ...t.foreignKey(
      ['9', '10'],
      ()=>Table,
      ['11', '12'],
      {
        name: 'second',
        match: 'SIMPLE',
        onUpdate: 'NO ACTION',
      },
    ),
`);

    const add: TableData = {
      ...tableData,
      constraints: [
        {
          references: {
            columns: ['7'],
            fnOrTable: 'foo_bar',
            foreignColumns: ['8'],
            options: {
              name: 'first',
              match: 'PARTIAL',
            },
          },
        },
        {
          references: {
            columns: ['9', '10'],
            fnOrTable: () => Table,
            foreignColumns: ['11', '12'],
            options: {
              name: 'second',
              match: 'SIMPLE',
              onUpdate: 'NO ACTION',
            },
          },
        },
      ],
    };

    it('should change foreignKeys', async () => {
      asMock(fs.readFile).mockResolvedValue(
        template(`
    ...t.foreignKey(
      ['1'],
      () => Table,
      ['2'],
    ),
    ...t.foreignKey(
      ['3', '4'],
      'foo_bar',
      ['5', '6'],
      {
        name: 'foreignKeyName',
        match: 'FULL',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    ),
`),
      );

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          drop: {
            ...tableData,
            constraints: [
              {
                references: {
                  columns: ['1'],
                  fnOrTable: () => Table,
                  foreignColumns: ['2'],
                  options: {},
                },
              },
              {
                references: {
                  columns: ['3', '4'],
                  fnOrTable: 'foo_bar',
                  foreignColumns: ['5', '6'],
                  options: {
                    name: 'foreignKeyName',
                    match: 'FULL',
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                    dropMode: 'CASCADE',
                  },
                },
              },
            ],
          },
          add: add as TableData,
        },
      });

      testWritten(result);
    });

    it('should add foreignKeys', async () => {
      asMock(fs.readFile).mockResolvedValue(template(`\n  `, { asIs: true }));

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          add: add as TableData,
        },
      });

      testWritten(result);
    });
  });

  describe('check', () => {
    describe('table check', () => {
      it('should add table check', async () => {
        asMock(fs.readFile).mockResolvedValue(template(`\n  `, { asIs: true }));

        await updateTableFile({
          ...params,
          ast: {
            ...ast.changeTable,
            add: {
              constraints: [
                {
                  check: raw({ raw: 'sql' }),
                },
              ],
            },
          },
        });

        testWritten(
          template(`
  ...t.check(t.sql({ raw: 'sql' })),
        `),
        );
      });

      it('should change table check', async () => {
        asMock(fs.readFile).mockResolvedValue(
          template(`
  ...t.check(t.sql({"raw":"from"})),
`),
        );

        await updateTableFile({
          ...params,
          ast: {
            ...ast.changeTable,
            drop: {
              constraints: [
                {
                  check: raw({ raw: 'from' }),
                },
              ],
            },
            add: {
              constraints: [
                {
                  check: raw({ raw: 'to' }),
                },
              ],
            },
          },
        });

        testWritten(
          template(`
  ...t.check(t.sql({ raw: 'to' })),
        `),
        );
      });
    });

    describe('column check', () => {
      it('should add column with check', async () => {
        asMock(fs.readFile).mockResolvedValue(template());

        await updateTableFile({
          ...params,
          ast: {
            ...ast.changeTable,
            shape: {
              name: { type: 'add', item: t.text(1, 10).check(t.sql('check')) },
            },
          },
        });

        testWritten(
          template(`name: t.text(1, 10).check(t.sql({ raw: 'check' })),`),
        );
      });

      it('should change column check', async () => {
        asMock(fs.readFile).mockResolvedValue(
          template(`
    add: t.text(),
    remove: t.text().check(t.sql({"raw":"remove check"})),
`),
        );

        await updateTableFile({
          ...params,
          ast: {
            ...ast.changeTable,
            shape: {
              add: {
                type: 'change',
                from: {},
                to: {
                  check: raw({ raw: 'add check' }),
                },
              },
              remove: {
                type: 'change',
                from: {
                  check: raw({ raw: 'remove check' }),
                },
                to: {},
              },
            },
          },
        });

        testWritten(
          template(`
    add: t.text().check(t.sql({ raw: 'add check' })),
    remove: t.text(),
`),
        );
      });
    });
  });

  describe('constraint', () => {
    it('should add constraint', async () => {
      asMock(fs.readFile).mockResolvedValue(template(`\n  `, { asIs: true }));

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          add: {
            constraints: [
              {
                name: 'name',
                check: raw({ raw: 'sql' }),
                references: {
                  columns: ['a', 'b'],
                  fnOrTable: 'table',
                  foreignColumns: ['c', 'd'],
                  options: {
                    match: 'SIMPLE',
                  },
                },
              },
            ],
          },
        },
      });

      testWritten(
        template(`
  ...t.constraint({
      name: 'name',
      references: [
        ['a', 'b'],
        'table',
        ['c', 'd'],
        {
          match: 'SIMPLE',
        },
      ],
      check: t.sql({ raw: 'sql' }),
    }),
        `),
      );
    });

    it('should change constraint', async () => {
      asMock(fs.readFile).mockResolvedValue(
        template(`
  ...t.constraint({
      name: 'name',
      references: [
        ['a', 'b'],
        'table',
        ['c', 'd'],
        {
          match: 'SIMPLE',
        },
      ],
      check: t.sql({"raw":"sql"}),
    }),
`),
      );

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          drop: {
            constraints: [
              {
                name: 'name',
                check: raw({ raw: 'sql' }),
                references: {
                  columns: ['a', 'b'],
                  fnOrTable: 'table',
                  foreignColumns: ['c', 'd'],
                  options: {
                    match: 'SIMPLE',
                  },
                },
              },
            ],
          },
          add: {
            constraints: [
              {
                name: 'updated',
                check: raw({ raw: 'updated' }),
                references: {
                  columns: ['e', 'f'],
                  fnOrTable: 'updated',
                  foreignColumns: ['g', 'h'],
                  options: {
                    match: 'FULL',
                  },
                },
              },
            ],
          },
        },
      });

      testWritten(
        template(`
  ...t.constraint({
      name: 'updated',
      references: [
        ['e', 'f'],
        'updated',
        ['g', 'h'],
        {
          match: 'FULL',
        },
      ],
      check: t.sql({ raw: 'updated' }),
    }),
      `),
      );
    });
  });
});
