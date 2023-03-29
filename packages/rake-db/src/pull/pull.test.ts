import { DbStructure } from './dbStructure';
import { pullDbStructure } from './pull';
import { processRakeDbConfig, RakeDbConfig } from '../common';
import { makeFileTimeStamp, writeMigrationFile } from '../commands/generate';
import { asMock } from '../test-utils';
import {
  check,
  column,
  createdAtColumn,
  domain,
  enumType,
  foreignKey,
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

let enums: DbStructure.Enum[] = [];
db.getEnums = async () => enums;

let constraints: DbStructure.Constraint[] = [];
db.getConstraints = async () => constraints;

let columns: DbStructure.Column[] = [];
db.getColumns = async () => columns;

asMock(makeFileTimeStamp).mockReturnValue('timestamp');

const appCodeUpdater = jest.fn();
const warn = jest.fn();
const log = jest.fn();

const options = { databaseURL: 'file:path' };

const makeConfig = (config: Partial<RakeDbConfig> = {}) =>
  processRakeDbConfig({
    appCodeUpdater,
    logger: {
      ...console,
      warn,
      log,
    },
    ...config,
  });

const config = makeConfig();

const expectWritten = (expected: string) => {
  const call = asMock(writeMigrationFile).mock.calls[0];
  expect(call[3]).toBe(expected);
};

describe('pull', () => {
  beforeEach(() => {
    schemas = [];
    domains = [];
    tables = [];
    enums = [];
    constraints = [];
    columns = [];

    jest.clearAllMocks();
  });

  it('should log success message', async () => {
    tables = [
      {
        schemaName: 'schema',
        name: 'table',
      },
    ];

    await pullDbStructure(options, makeConfig());

    expect(log).toBeCalledWith('Database pulled successfully');
  });

  it('should write migration file with correct arguments', async () => {
    tables = [table];

    await pullDbStructure(options, config);

    const call = asMock(writeMigrationFile).mock.calls[0];
    expect(call[0]).toBe(config);
    expect(call[1]).toBe('timestamp');
    expect(call[2]).toBe('pull');
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

    columns = [
      {
        ...idColumn,
        default: idColumn.default?.replace('table', 'table1'),
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
        default: 'Current_Timestamp',
      },
      {
        ...updatedAtColumn,
        schemaName: 'schema',
        tableName: 'table1',
        default: 'transaction_timestamp()',
      },
      {
        ...idColumn,
        tableName: 'table2',
        default: idColumn.default?.replace('table', 'table2'),
      },
      {
        ...textColumn,
        tableName: 'table2',
      },
      {
        ...createdAtColumn,
        tableName: 'table2',
        name: 'created_at',
        default: 'Current_Timestamp',
      },
      {
        ...updatedAtColumn,
        tableName: 'table2',
        name: 'updated_at',
        default: 'transaction_timestamp()',
      },
    ];

    constraints = [
      {
        schemaName: 'schema',
        tableName: 'table1',
        name: 'table1_pkey',
        primaryKey: ['id'],
      },
      {
        schemaName: 'public',
        tableName: 'table2',
        name: 'table2_pkey',
        primaryKey: ['id'],
      },
      {
        ...check,
        tableName: 'table2',
        check: {
          columns: ['text'],
          expression: 'length(text) > 5',
        },
      },
      {
        ...check,
        tableName: 'table2',
        check: {
          columns: ['one', 'two'],
          expression: 'table check',
        },
      },
      {
        ...foreignKey,
        tableName: 'table2',
        references: {
          ...foreignKey.references,
          columns: ['id', 'text'],
          foreignSchema: 'schema',
          foreignTable: 'table1',
          foreignColumns: ['id', 'name'],
        },
      },
      {
        ...foreignKey,
        ...check,
        tableName: 'table2',
        references: {
          ...foreignKey.references,
          columns: ['id', 'text'],
          foreignSchema: 'schema',
          foreignTable: 'table1',
          foreignColumns: ['id', 'name'],
        },
      },
    ];

    await pullDbStructure(options, config);

    expectWritten(
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
    id: t.serial().primaryKey(),
    text: t.text().check(t.raw('length(text) > 5')),
    ...t.timestampsSnakeCase(),
    ...t.check(t.raw('table check')),
    ...t.foreignKey(
      ['id', 'text'],
      'schema.table1',
      ['id', 'name'],
      {
        name: 'fkey',
        match: 'FULL',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    ),
    ...t.constraint({
      name: 'table_column_check',
      references: [
        ['id', 'text'],
        'schema.table1',
        ['id', 'name'],
        {
          match: 'FULL',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
      ],
      check: t.raw('column > 10'),
    }),
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

    await pullDbStructure(options, config);

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

    const config = makeConfig({ snakeCase: true });

    await pullDbStructure(options, config);

    expectWritten(
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
  });

  it('should handle enum', async () => {
    tables = [table];
    enums = [enumType];
    columns = [
      {
        ...textColumn,
        type: enumType.name,
        typeSchema: enumType.schemaName,
      },
    ];

    await pullDbStructure(
      {
        databaseURL: 'file:path',
      },
      makeConfig(),
    );

    expectWritten(`import { change } from 'rake-db';

change(async (db) => {
  await db.createEnum('mood', ['sad', 'ok', 'happy']);
});

change(async (db) => {
  await db.createTable('table', (t) => ({
    text: t.enum('mood'),
  }));
});
`);
  });
});
