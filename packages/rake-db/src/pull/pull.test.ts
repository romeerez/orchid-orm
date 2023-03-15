import { DbStructure } from './dbStructure';
import { pullDbStructure } from './pull';
import { processRakeDbConfig } from '../common';
import { makeFileTimeStamp, writeMigrationFile } from '../commands/generate';
import { asMock } from '../test-utils';
import {
  createdAtColumn,
  idColumn,
  table,
  textColumn,
  updatedAtColumn,
} from './testUtils';
import { saveMigratedVersion } from '../migration/manageMigratedVersions';

jest.mock('./dbStructure', () => {
  const { DbStructure } = jest.requireActual('./dbStructure');
  for (const key of Object.getOwnPropertyNames(DbStructure.prototype)) {
    (DbStructure.prototype as unknown as Record<string, () => unknown[]>)[key] =
      () => [];
  }

  return { DbStructure };
});

jest.mock('../commands/generate', () => ({
  makeFileTimeStamp: jest.fn(),
  writeMigrationFile: jest.fn(),
}));

jest.mock('../migration/manageMigratedVersions', () => ({
  saveMigratedVersion: jest.fn(),
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

    jest.clearAllMocks();
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
        ...idColumn,
        schemaName: 'schema',
        tableName: 'table1',
      },
      {
        ...createdAtColumn,
        schemaName: 'schema',
        tableName: 'table1',
      },
      {
        ...updatedAtColumn,
        schemaName: 'schema',
        tableName: 'table1',
      },
      {
        ...textColumn,
        tableName: 'table2',
      },
      {
        ...createdAtColumn,
        tableName: 'table2',
        name: 'created_at',
      },
      {
        ...updatedAtColumn,
        tableName: 'table2',
        name: 'updated_at',
      },
    ];

    asMock(makeFileTimeStamp).mockReturnValue('timestamp');

    const appCodeUpdater = jest.fn();

    const config = processRakeDbConfig({
      migrationsPath: 'migrations',
      appCodeUpdater,
    });

    await pullDbStructure(
      {
        databaseURL: 'file:path',
      },
      config,
    );

    const call = asMock(writeMigrationFile).mock.calls[0];
    expect(call[0]).toBe(config);
    expect(call[1]).toBe('timestamp');
    expect(call[2]).toBe('pull');
    expect(call[3]).toBe(
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

    expect(saveMigratedVersion).toBeCalledWith(
      expect.any(Object),
      'timestamp',
      config,
    );

    // 4 = 2 schemas + 2 tables
    expect(appCodeUpdater).toBeCalledTimes(4);
  });

  it('should add simple timestamps when snakeCase: true', async () => {
    tables = [table];

    columns = [
      {
        ...createdAtColumn,
        name: 'created_at',
      },
      {
        ...updatedAtColumn,
        name: 'updated_at',
      },
    ];

    asMock(makeFileTimeStamp).mockReturnValue('timestamp');

    const appCodeUpdater = jest.fn();

    const config = processRakeDbConfig({
      migrationsPath: 'migrations',
      snakeCase: true,
      appCodeUpdater,
    });

    await pullDbStructure(
      {
        databaseURL: 'file:path',
      },
      config,
    );

    const call = asMock(writeMigrationFile).mock.calls[0];
    expect(call[0]).toBe(config);
    expect(call[1]).toBe('timestamp');
    expect(call[2]).toBe('pull');
    expect(call[3]).toBe(
      `import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('table', (t) => ({
    ...t.timestamps(),
  }));
});
`,
    );

    expect(saveMigratedVersion).toBeCalledWith(
      expect.any(Object),
      'timestamp',
      config,
    );

    expect(appCodeUpdater).toBeCalledTimes(1);
  });
});
