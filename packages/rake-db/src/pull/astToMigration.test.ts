import { astToMigration } from './astToMigration';
import { columnTypes } from 'pqb';
import { RakeDbAst } from '../ast';

const template = (content: string) => `import { change } from 'rake-db';

change(async (db) => {
${content}
});
`;

const tableAst: RakeDbAst.Table = {
  type: 'table',
  action: 'create',
  schema: 'schema',
  name: 'table',
  shape: {},
  noPrimaryKey: 'ignore',
  indexes: [],
  foreignKeys: [],
};

describe('astToMigration', () => {
  beforeEach(jest.clearAllMocks);

  it('should return undefined when ast is empty', () => {
    const result = astToMigration([]);

    expect(result).toBe(undefined);
  });

  it('should create schema', () => {
    const result = astToMigration([
      {
        type: 'schema',
        action: 'create',
        name: 'schemaName',
      },
    ]);

    expect(result).toBe(template(`  await db.createSchema('schemaName');`));
  });

  it('should create extension', () => {
    const result = astToMigration([
      {
        type: 'extension',
        action: 'create',
        name: 'extensionName',
        schema: 'schema',
        version: '123',
      },
    ]);

    expect(result).toBe(
      template(`  await db.createExtension('extensionName', {
    schema: 'schema',
    version: '123',
  })`),
    );
  });

  describe('table', () => {
    it('should create table', () => {
      const result = astToMigration([
        {
          ...tableAst,
          shape: {
            id: columnTypes.serial().primaryKey(),
          },
        },
      ]);

      expect(result).toBe(
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.serial().primaryKey(),
  }));`),
      );
    });

    it('should add columns with indexes and foreignKeys', () => {
      const result = astToMigration([
        {
          ...tableAst,
          shape: {
            someId: columnTypes
              .integer()
              .unique({ name: 'indexName' })
              .foreignKey('otherTable', 'otherId', {
                name: 'fkey',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              }),
          },
        },
      ]);

      expect(result).toBe(`import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    someId: t.integer().foreignKey('otherTable', 'otherId', {
      name: 'fkey',
      match: 'FULL',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    }).unique({
      name: 'indexName',
    }),
  }));
});
`);
    });

    it('should add composite primaryKeys, indexes, foreignKeys', () => {
      const result = astToMigration([
        {
          ...tableAst,
          shape: {
            id: columnTypes.serial().primaryKey(),
          },
          primaryKey: { columns: ['id', 'name'], options: { name: 'pkey' } },
          indexes: [
            {
              columns: [{ column: 'id' }, { column: 'name' }],
              options: { name: 'index', unique: true },
            },
          ],
          foreignKeys: [
            {
              columns: ['id', 'name'],
              fnOrTable: 'otherTable',
              foreignColumns: ['otherId', 'otherName'],
              options: {
                name: 'fkey',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              },
            },
          ],
        },
      ]);

      expect(result).toBe(
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.serial().primaryKey(),
    ...t.primaryKey(['id', 'name'], { name: 'pkey' }),
    ...t.index(['id', 'name'], {
      name: 'index',
      unique: true,
    }),
    ...t.foreignKey(
      ['id', 'name'],
      'otherTable',
      ['otherId', 'otherName'],
      {
        name: 'fkey',
        match: 'FULL',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    ),
  }));`),
      );
    });
  });
});
