import fs from 'fs/promises';
import { asMock, ast, makeTestWritten, tablePath } from '../testUtils';
import { updateTableFile } from './updateTableFile';
import path from 'path';
import { columnTypes, newTableData, TableData } from 'pqb';
import { RakeDbAst } from 'rake-db';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const baseTablePath = path.resolve('baseTable.ts');
const baseTableName = 'BaseTable';
const params = { baseTablePath, baseTableName, tablePath };
const t = columnTypes;

const testWritten = makeTestWritten(tablePath('table'));

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
  table = 'table';
}

describe('updateTableFile', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add a single column into empty columns list', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({}));
}`);

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'add', item: t.text(1, 10) },
        },
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text(1, 10),
  }));
}`);
  });

  it('should add a single column', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }));
}`);

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'add', item: t.text(1, 10) },
        },
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(1, 10),
  }));
}`);
  });

  it('should add multiple column', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }));
}`);

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

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(1, 10),
    active: t.boolean(),
  }));
}`);
  });

  it('should insert ending comma before adding', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey()
  }));
}`);

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

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(1, 10),
    active: t.boolean(),
  }));
}`);
  });

  it('should drop column', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    active: t.boolean(),
  }));
}`);

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'drop', item: t.text(1, 10) },
        },
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    active: t.boolean(),
  }));
}`);
  });

  it('should drop column at the end', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }));
}`);

    await updateTableFile({
      ...params,
      ast: {
        ...ast.changeTable,
        shape: {
          name: { type: 'drop', item: t.text(1, 10) },
        },
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }));
}`);
  });

  it('should change column type', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.integer(),
  }));
}`);

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

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text(1, 10),
  }));
}`);
  });

  it('should change properties', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
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
  }));
}`);

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
        },
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
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
  }));
}`);
  });

  describe('primaryKey', () => {
    const result = `import { BaseTable } from '../baseTable';
 
export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    ...t.primaryKey(['one', 'two'], { name: 'name' }),
  }));
}`;

    const add = {
      ...tableData,
      primaryKey: {
        columns: ['one', 'two'],
        options: { name: 'name' },
      },
    };

    it('should change primaryKey', async () => {
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';
 
export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    ...t.primaryKey(['foo', 'bar'], { name: 'baz' }),
  }));
}`);

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
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';
 
export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
  }));
}`);

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
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text().index({ order: 'one' }).index({ collate: 'en_US' })
  }));
}`);

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          shape: {
            name: {
              type: 'change',
              from: { indexes: [{ order: 'one' }, { collate: 'en_US' }] },
              to: { indexes: [{ order: 'two' }, { collate: 'en_UK' }] },
            },
          },
        },
      });

      testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text().index({
      order: 'two',
    }).index({
      collate: 'en_UK',
    }),
  }));
}`);
    });

    it('should add column indexes', async () => {
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text(),
  }));
}`);

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          shape: {
            name: {
              type: 'change',
              from: {},
              to: { indexes: [{ order: 'two' }, { collate: 'fr_FR' }] },
            },
          },
        },
      });

      testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text().index({
      order: 'two',
    }).index({
      collate: 'fr_FR',
    }),
  }));
}`);
    });

    const result = `import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
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
  }));
}`;

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
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    ...t.index('1'),
    ...t.index(['2', '3']),
    ...t.index(['4', { column: '5', order: 'order' }], { name: 'indexName' }),
  }));
}`);

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
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
  }));
}`);

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

  describe('foreignKeys', () => {
    it('should change column foreignKeys', async () => {
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text().foreignKey('a', 'b').foreignKey('c', 'd')
  }));
}`);

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

      testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text().foreignKey('e', 'f').foreignKey('g', 'h'),
  }));
}`);
    });

    it('should add column indexes', async () => {
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text(),
  }));
}`);

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

      testWritten(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    name: t.text().foreignKey('e', 'f').foreignKey('g', 'h'),
  }));
}`);
    });

    const result = `import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    ...t.foreignKey(
      ['7'],
      'table',
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
  }));
}`;

    const add = {
      ...tableData,
      foreignKeys: [
        {
          columns: ['7'],
          fnOrTable: 'table',
          foreignColumns: ['8'],
          options: {
            name: 'first',
            match: 'PARTIAL',
          },
        },
        {
          columns: ['9', '10'],
          fnOrTable: () => Table,
          foreignColumns: ['11', '12'],
          options: {
            name: 'second',
            match: 'SIMPLE',
            onUpdate: 'NO ACTION',
          },
        },
      ],
    };

    it('should change foreignKeys', async () => {
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
    ...t.foreignKey(
      ['1'],
      () => Table,
      ['2'],
    ),
    ...t.foreignKey(
      ['3', '4'],
      'table',
      ['5', '6'],
      {
        name: 'foreignKeyName',
        match: 'FULL',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    ),
  }));
}`);

      await updateTableFile({
        ...params,
        ast: {
          ...ast.changeTable,
          drop: {
            ...tableData,
            foreignKeys: [
              {
                columns: ['1'],
                fnOrTable: () => Table,
                foreignColumns: ['2'],
                options: {},
              },
              {
                columns: ['3', '4'],
                fnOrTable: 'table',
                foreignColumns: ['5', '6'],
                options: {
                  name: 'foreignKeyName',
                  match: 'FULL',
                  onUpdate: 'CASCADE',
                  onDelete: 'CASCADE',
                  dropMode: 'CASCADE',
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
      asMock(fs.readFile)
        .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class Table extends BaseTable {
  table = 'table';
  columns = this.setColumns((t) => ({
  }));
}`);

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
});
