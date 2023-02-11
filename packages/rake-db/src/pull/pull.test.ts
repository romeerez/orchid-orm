import { DbStructure } from './dbStructure';
import { pullDbStructure } from './pull';
import { processRakeDbConfig } from '../common';
import { writeMigrationFile } from '../commands/generate';

jest.mock('./dbStructure', () => {
  const { DbStructure } = jest.requireActual('./dbStructure');
  for (const key of Object.getOwnPropertyNames(DbStructure.prototype)) {
    (DbStructure.prototype as unknown as Record<string, () => unknown[]>)[key] =
      () => [];
  }

  return { DbStructure };
});

jest.mock('../commands/generate', () => ({
  writeMigrationFile: jest.fn(),
}));

const db = DbStructure.prototype;

describe('pull', () => {
  it('should get db structure, convert it to ast, generate migrations', async () => {
    db.getSchemas = async () => ['schema1', 'schema2'];
    db.getTables = async () => [
      {
        schemaName: 'schema',
        name: 'table1',
      },
      {
        schemaName: 'public',
        name: 'table2',
      },
    ];
    db.getPrimaryKeys = async () => [
      {
        schemaName: 'schema',
        tableName: 'table1',
        name: 'table1_pkey',
        columnNames: ['id'],
      },
    ];
    db.getColumns = async () => [
      {
        schemaName: 'schema',
        tableName: 'table1',
        name: 'id',
        type: 'int4',
        default: `nextval('table1_id_seq'::regclass)`,
        isNullable: false,
      },
      {
        schemaName: 'public',
        tableName: 'table2',
        name: 'text',
        type: 'text',
        isNullable: false,
      },
      {
        schemaName: 'public',
        tableName: 'table2',
        name: 'createdAt',
        type: 'timestamp',
        dateTimePrecision: 6,
        isNullable: false,
        default: 'now()',
      },
      {
        schemaName: 'public',
        tableName: 'table2',
        name: 'updatedAt',
        type: 'timestamp',
        dateTimePrecision: 6,
        isNullable: false,
        default: 'now()',
      },
    ];

    const config = processRakeDbConfig({
      migrationsPath: 'migrations',
    });

    await pullDbStructure(
      {
        databaseURL: 'file:path',
      },
      config,
    );

    expect(writeMigrationFile).toBeCalledWith(
      config,
      'pull',
      `import { change } from 'rake-db';

change(async (db) => {
  await db.createSchema('schema1');
  await db.createSchema('schema2');
});

change(async (db) => {
  await db.createTable('schema.table1', (t) => ({
    id: t.serial().primaryKey(),
  }));
});

change(async (db) => {
  await db.createTable('table2', (t) => ({
    text: t.text(),
    ...t.timestamps(),
  }));
});
`,
    );
  });
});
