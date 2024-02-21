import { introspectDbSchema } from './dbStructure';
import { pullDbStructure } from './pull';
import { AppCodeUpdater, processRakeDbConfig, RakeDbConfig } from '../common';
import { makeFileTimeStamp, writeMigrationFile } from '../commands/generate';
import {
  check,
  collation,
  column,
  createdAtColumn,
  domain,
  enumType,
  foreignKey,
  idColumn,
  identityColumn,
  intColumn,
  table,
  textColumn,
  updatedAtColumn,
} from './pull.test-utils';
import { saveMigratedVersion } from '../migration/manageMigratedVersions';
import {
  makeColumnTypes,
  DefaultColumnTypes,
  defaultSchemaConfig,
  DefaultSchemaConfig,
} from 'pqb';
import { asMock } from 'test-utils';
import { ColumnSchemaConfig } from 'orchid-core';

jest.mock('./dbStructure');

jest.mock('../commands/generate', () => ({
  makeFileTimeStamp: jest.fn(),
  writeMigrationFile: jest.fn(),
}));

jest.mock('../migration/manageMigratedVersions', () => ({
  saveMigratedVersion: jest.fn(),
}));

const structure = {
  schemas: [],
  tables: [],
  views: [],
  indexes: [],
  constraints: [],
  triggers: [],
  extensions: [],
  enums: [],
  domains: [],
  collations: [],
} as Awaited<ReturnType<typeof introspectDbSchema>>;

asMock(makeFileTimeStamp).mockReturnValue('timestamp');

const appCodeUpdater: AppCodeUpdater = {
  process: jest.fn(),
  afterAll: jest.fn(),
};
const warn = jest.fn();
const log = jest.fn();

const options = { databaseURL: 'file:path' };

class BaseTable {
  static getFilePath() {
    return 'path';
  }
  static exportAs = 'BaseTable';
  types!: DefaultColumnTypes<DefaultSchemaConfig>;
  snakeCase?: boolean;
}
BaseTable.prototype.types = makeColumnTypes(defaultSchemaConfig);

const makeConfig = (config: Partial<RakeDbConfig<ColumnSchemaConfig>> = {}) =>
  processRakeDbConfig({
    baseTable: BaseTable,
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
  expect(call[3]('../dbScript')).toBe(expected);
};

describe('pull', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    for (const key in structure) {
      structure[key as keyof typeof structure].length = 0;
    }

    asMock(introspectDbSchema).mockResolvedValue(structure);
  });

  it('should log success message', async () => {
    structure.tables = [
      {
        schemaName: 'schema',
        name: 'table',
        columns: [],
      },
    ];

    await pullDbStructure(options, makeConfig());

    expect(log).toBeCalledWith('Database pulled successfully');
  });

  it('should write migration file with correct arguments', async () => {
    structure.tables = [table];

    await pullDbStructure(options, config);

    const call = asMock(writeMigrationFile).mock.calls[0];
    expect(call[0]).toBe(config);
    expect(call[1]).toBe('timestamp');
    expect(call[2]).toBe('pull');
  });

  it('should get db structure, convert it to ast, generate migrations', async () => {
    structure.schemas = ['schema1', 'schema2'];

    structure.domains = [
      {
        ...domain,
        schemaName: 'schema',
      },
    ];

    structure.collations = [
      {
        ...collation,
        schema: 'schema',
      },
    ];

    structure.tables = [
      {
        schemaName: 'schema',
        name: 'table1',
        columns: [
          {
            ...identityColumn,
            name: 'id',
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
            ...textColumn,
            schemaName: 'schema',
            tableName: 'table1',
            name: 'jsonArray',
            type: 'jsonb',
            typeSchema: 'schema',
            default: "'[]'",
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
        ],
      },
      {
        schemaName: 'public',
        name: 'table2',
        columns: [
          {
            ...identityColumn,
            name: 'id',
            tableName: 'table2',
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
        ],
      },
    ];

    structure.constraints = [
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
      `import { change } from '../dbScript';

change(async (db) => {
  await db.createSchema('schema1');
  await db.createSchema('schema2');

  await db.createCollation('schema.collation', {
    locale: 'locale',
    provider: 'icu',
    deterministic: true,
    version: '123',
  });

  await db.createDomain('schema.domain', (t) => t.integer());
});

change(async (db) => {
  await db.createTable('schema.table1', (t) => ({
    id: t.identity().primaryKey(),
    columnName: t.name('column_name').integer(),
    domainColumn: t.array(t.domain('domain').as(t.integer())),
    customTypeColumn: t.type('customType'),
    jsonArray: t.json().default(t.sql({ raw: '\\'[]\\'' })),
    ...t.timestamps(),
  }));
});

change(async (db) => {
  await db.createTable('table2', (t) => ({
    id: t.identity().primaryKey(),
    text: t.text().check(t.sql({ raw: 'length(text) > 5' })),
    ...t.timestampsSnakeCase(),
    ...t.check(t.sql({ raw: 'table check' })),
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
      check: t.sql({ raw: 'column > 10' }),
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
    expect(appCodeUpdater.process).toBeCalledTimes(6);
    expect(appCodeUpdater.afterAll).toBeCalledTimes(1);

    expect(warn).toBeCalledWith(`Found unsupported types:
- customType is used for column schema.table1.customTypeColumn
Append \`as\` method manually to this column to treat it as other column type`);
  });

  it('should pluralize warning when many columns have unknown types', async () => {
    structure.tables = [
      {
        ...table,
        columns: [
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
        ],
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
    structure.tables = [
      {
        ...table,
        columns: [
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
        ],
      },
    ];

    const config = makeConfig({ snakeCase: true });

    await pullDbStructure(options, config);

    expectWritten(
      `import { change } from '../dbScript';

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

    expect(appCodeUpdater.process).toBeCalledTimes(1);
    expect(appCodeUpdater.afterAll).toBeCalledTimes(1);
  });

  it('should handle enum', async () => {
    structure.tables = [
      {
        ...table,
        columns: [
          {
            ...textColumn,
            type: enumType.name,
            typeSchema: enumType.schemaName,
          },
        ],
      },
    ];
    structure.enums = [enumType];

    await pullDbStructure(
      {
        databaseURL: 'file:path',
      },
      makeConfig(),
    );

    expectWritten(`import { change } from '../dbScript';

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
