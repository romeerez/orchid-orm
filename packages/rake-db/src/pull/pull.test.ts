import { DbStructure } from './dbStructure';
import { pullDbStructure } from './pull';
import { processRakeDbConfig } from '../common';
import { writeMigrationFile } from '../commands/generate';
import { asMock } from '../test-utils';

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

let schemas: string[] = [];
db.getSchemas = async () => schemas;

let tables: DbStructure.Table[] = [];
db.getTables = async () => tables;

let primaryKeys: DbStructure.PrimaryKey[] = [];
db.getPrimaryKeys = async () => primaryKeys;

let columns: DbStructure.Column[] = [];
db.getColumns = async () => columns;

describe('pull', () => {
  beforeEach(() => {
    schemas = [];
    tables = [];
    primaryKeys = [];
    columns = [];

    asMock(writeMigrationFile).mockClear();
  });

  it('should get db structure, convert it to ast, generate migrations', async () => {
    schemas = ['schema1', 'schema2'];

    tables = [
      {
        schemaName: 'schema',
        name: 'table1',
      },
      {
        schemaName: 'public',
        name: 'table2',
      },
    ];

    primaryKeys = [
      {
        schemaName: 'schema',
        tableName: 'table1',
        name: 'table1_pkey',
        columnNames: ['id'],
      },
    ];

    columns = [
      {
        schemaName: 'schema',
        tableName: 'table1',
        name: 'id',
        type: 'int4',
        default: `nextval('table1_id_seq'::regclass)`,
        isNullable: false,
      },
      {
        schemaName: 'schema',
        tableName: 'table1',
        name: 'createdAt',
        type: 'timestamp',
        dateTimePrecision: 6,
        isNullable: false,
        default: 'now()',
      },
      {
        schemaName: 'schema',
        tableName: 'table1',
        name: 'updatedAt',
        type: 'timestamp',
        dateTimePrecision: 6,
        isNullable: false,
        default: 'now()',
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
        name: 'created_at',
        type: 'timestamp',
        dateTimePrecision: 6,
        isNullable: false,
        default: 'now()',
      },
      {
        schemaName: 'public',
        tableName: 'table2',
        name: 'updated_at',
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

    const call = asMock(writeMigrationFile).mock.calls[0];
    expect(call[0]).toBe(config);
    expect(call[1]).toBe('pull');
    expect(call[2]).toBe(
      `import { change } from 'rake-db';

change(async (db) => {
  await db.createSchema('schema1');
  await db.createSchema('schema2');
});

change(async (db) => {
  await db.createTable('schema.table1', (t) => ({
    id: t.serial().primaryKey(),
    ...t.timestamps(),
  }));
});

change(async (db) => {
  await db.createTable('table2', (t) => ({
    text: t.text(),
    ...t.timestampsSnakeCase(),
  }));
});
`,
    );
  });

  it('should add simple timestamps when snakeCase: true', async () => {
    tables = [
      {
        schemaName: 'public',
        name: 'table',
      },
    ];

    columns = [
      {
        schemaName: 'public',
        tableName: 'table',
        name: 'created_at',
        type: 'timestamp',
        dateTimePrecision: 6,
        isNullable: false,
        default: 'now()',
      },
      {
        schemaName: 'public',
        tableName: 'table',
        name: 'updated_at',
        type: 'timestamp',
        dateTimePrecision: 6,
        isNullable: false,
        default: 'now()',
      },
    ];

    const config = processRakeDbConfig({
      migrationsPath: 'migrations',
      snakeCase: true,
    });

    await pullDbStructure(
      {
        databaseURL: 'file:path',
      },
      config,
    );

    const call = asMock(writeMigrationFile).mock.calls[0];
    expect(call[0]).toBe(config);
    expect(call[1]).toBe('pull');
    expect(call[2]).toBe(
      `import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('table', (t) => ({
    ...t.timestamps(),
  }));
});
`,
    );
  });
});
