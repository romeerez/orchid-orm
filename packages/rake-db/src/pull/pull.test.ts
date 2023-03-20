import { DbStructure } from './dbStructure';
import { pullDbStructure } from './pull';
import { processRakeDbConfig } from '../common';
import { makeFileTimeStamp, writeMigrationFile } from '../commands/generate';
import { asMock } from '../test-utils';
import {
  check,
  column,
  createdAtColumn,
  domain,
  idColumn,
  intColumn,
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

let domains: DbStructure.Domain[] = [];
db.getDomains = async () => domains;

let tables: DbStructure.Table[] = [];
db.getTables = async () => tables;

let primaryKeys: DbStructure.PrimaryKey[] = [];
db.getPrimaryKeys = async () => primaryKeys;

let columns: DbStructure.Column[] = [];
db.getColumns = async () => columns;

let checks: DbStructure.Check[] = [];
db.getChecks = async () => checks;

describe('pull', () => {
  beforeEach(() => {
    schemas = [];
    domains = [];
    tables = [];
    primaryKeys = [];
    columns = [];
    checks = [];

    jest.clearAllMocks();
  });

  it('should get db structure, convert it to ast, generate migrations', async () => {
    schemas = ['schema1', 'schema2'];

    domains = [
      {
        ...domain,
        schemaName: 'schema',
      },
    ];

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
        ...idColumn,
        schemaName: 'schema',
        tableName: 'table1',
        name: 'column_name',
        default: undefined,
      },
      {
        ...idColumn,
        schemaName: 'schema',
        tableName: 'table1',
        name: 'domainColumn',
        type: domain.name,
        typeSchema: 'schema',
        isArray: true,
      },
      {
        ...idColumn,
        schemaName: 'schema',
        tableName: 'table1',
        name: 'customTypeColumn',
        type: 'customType',
        typeSchema: 'schema',
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

    checks = [
      {
        ...check,
        tableName: 'table2',
        columnNames: ['text'],
        expression: 'length(text) > 5',
      },
    ];

    asMock(makeFileTimeStamp).mockReturnValue('timestamp');

    const appCodeUpdater = jest.fn();
    const warn = jest.fn();
    const log = jest.fn();

    const config = processRakeDbConfig({
      migrationsPath: 'migrations',
      appCodeUpdater,
      logger: {
        ...console,
        warn,
        log,
      },
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

  await db.createDomain('schema.domain', (t) => t.integer());
});

change(async (db) => {
  await db.createTable('schema.table1', (t) => ({
    id: t.serial().primaryKey(),
    columnName: t.name('column_name').integer(),
    domainColumn: t.array(t.domain('domain').as(t.integer())),
    customTypeColumn: t.type('customType'),
    ...t.timestamps(),
  }));
});

change(async (db) => {
  await db.createTable('table2', (t) => ({
    text: t.text().check(t.raw('length(text) > 5')),
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

    // 5 = 2 schemas + 1 domain + 2 tables
    expect(appCodeUpdater).toBeCalledTimes(5);

    expect(warn).toBeCalledWith(`Found unsupported types:
- customType is used for column schema.table1.customTypeColumn
Append \`as\` method manually to this column to treat it as other column type`);

    expect(log).toBeCalledWith('Database pulled successfully');
  });

  it('should pluralize warning when many columns have unknown types', async () => {
    tables = [table];

    columns = [
      {
        ...column,
        name: 'column1',
        type: 'unknown1',
      },
      {
        ...column,
        name: 'column2',
        type: 'unknown2',
      },
    ];

    asMock(makeFileTimeStamp).mockReturnValue('timestamp');

    const warn = jest.fn();
    const log = jest.fn();

    const config = processRakeDbConfig({
      migrationsPath: 'migrations',
      logger: {
        ...console,
        warn,
        log,
      },
    });

    await pullDbStructure(
      {
        databaseURL: 'file:path',
      },
      config,
    );

    expect(warn).toBeCalledWith(`Found unsupported types:
- unknown1 is used for column public.table.column1
- unknown2 is used for column public.table.column2
Append \`as\` method manually to these columns to treat them as other column type`);

    expect(log).toBeCalledWith('Database pulled successfully');
  });

  it(`should add simple timestamps and do not add name('snake_case'), but add name('camelCase') when snakeCase: true`, async () => {
    tables = [table];

    columns = [
      {
        ...intColumn,
        name: 'snake_case',
        default: undefined,
      },
      {
        ...intColumn,
        name: 'camelCase',
        default: undefined,
      },
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

    const log = jest.fn();

    const config = processRakeDbConfig({
      migrationsPath: 'migrations',
      snakeCase: true,
      appCodeUpdater,
      logger: {
        ...console,
        log,
      },
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
    snakeCase: t.integer(),
    camelCase: t.name('camelCase').integer(),
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

    expect(log).toBeCalledWith('Database pulled successfully');
  });
});
