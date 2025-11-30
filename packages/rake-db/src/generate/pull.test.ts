import { introspectDbSchema } from './dbStructure';
import { pullDbStructure } from './pull';
import { makeFileVersion, writeMigrationFile } from '../commands/newMigration';
import { saveMigratedVersion } from '../migration/manageMigratedVersions';
import {
  makeColumnTypes,
  DefaultColumnTypes,
  defaultSchemaConfig,
  DefaultSchemaConfig,
  ColumnSchemaConfig,
} from 'pqb';
import { asMock, TestAdapter } from 'test-utils';
import { processRakeDbConfig, RakeDbConfig } from '../config';
import { dbStructureMockFactory } from './dbStructure.mockFactory';

jest.mock('./dbStructure');

jest.mock('../commands/newMigration', () => ({
  makeFileVersion: jest.fn(),
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
  excludes: [],
  constraints: [],
  triggers: [],
  extensions: [],
  enums: [],
  domains: [],
  collations: [],
} as Awaited<ReturnType<typeof introspectDbSchema>>;

asMock(makeFileVersion).mockReturnValue('timestamp');

const warn = jest.fn();
const log = jest.fn();

const options = { databaseURL: 'file:path' };
const adapter = new TestAdapter(options);

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
    logger: {
      ...console,
      warn,
      log,
    },
    import: (path) => import(path),
    ...config,
  });

const config = makeConfig();

const expectWritten = (expected: string) => {
  const call = asMock(writeMigrationFile).mock.calls[0];
  expect(`import { change } from '../dbScript';\n${call[3]}`).toBe(expected);
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
    structure.tables = [dbStructureMockFactory.table()];

    await pullDbStructure(adapter, makeConfig());

    expect(log).toBeCalledWith('Database pulled successfully');
  });

  it('should write migration file with correct arguments', async () => {
    structure.tables = [dbStructureMockFactory.table()];

    await pullDbStructure(adapter, config);

    const call = asMock(writeMigrationFile).mock.calls[0];
    expect(call[0]).toBe(config);
    expect(call[1]).toBe('timestamp');
    expect(call[2]).toBe('pull');
  });

  it('should get db structure, convert it to ast, generate migrations', async () => {
    structure.schemas = ['schema1', 'schema2'];

    structure.domains = [
      dbStructureMockFactory.domain({ schemaName: 'schema' }),
    ];

    structure.collations = [
      dbStructureMockFactory.collation({
        schemaName: 'schema',
      }),
    ];

    structure.tables = [
      dbStructureMockFactory.table({
        schemaName: 'schema',
        name: 'table1',
        columns: [
          dbStructureMockFactory.identityColumn({
            name: 'id',
          }),
          dbStructureMockFactory.idColumn({
            name: 'column_name',
            default: undefined,
          }),
          dbStructureMockFactory.domainColumn({
            name: 'domainColumn',
            typeSchema: 'schema',
            arrayDims: 1,
          }),
          dbStructureMockFactory.intColumn({
            name: 'customTypeColumn',
            type: 'customType',
            typeSchema: 'schema',
          }),
          dbStructureMockFactory.intColumn({
            name: 'jsonArray',
            type: 'jsonb',
            typeSchema: 'schema',
            default: "'[]'",
          }),
          dbStructureMockFactory.createdAtColumn({
            default: 'Current_Timestamp',
          }),
          dbStructureMockFactory.updatedAtColumn({
            default: 'transaction_timestamp()',
          }),
        ],
      }),
      dbStructureMockFactory.table({
        name: 'table2',
        columns: [
          dbStructureMockFactory.identityColumn({
            name: 'id',
          }),
          dbStructureMockFactory.textColumn({ tableName: 'table2' }),
          dbStructureMockFactory.createdAtColumn({
            name: 'created_at',
            default: 'Current_Timestamp',
          }),
          dbStructureMockFactory.updatedAtColumn({
            name: 'updated_at',
            default: 'transaction_timestamp()',
          }),
        ],
      }),
    ];

    structure.constraints = [
      dbStructureMockFactory.primaryKey({
        schemaName: 'schema',
        tableName: 'table1',
        primaryKey: ['id'],
      }),
      ...dbStructureMockFactory.constraints({ tableName: 'table2' }, [
        dbStructureMockFactory.primaryKey({
          primaryKey: ['id'],
        }),
        dbStructureMockFactory.check({
          check: {
            columns: ['text'],
            expression: 'length(text) > 5',
          },
        }),
        dbStructureMockFactory.check({
          check: {
            columns: ['one', 'two'],
            expression: 'table check',
          },
        }),
        dbStructureMockFactory.foreignKey('table2', 'table1', {
          references: {
            columns: ['id', 'text'],
            foreignSchema: 'schema',
            foreignColumns: ['id', 'name'],
            match: 'f',
            onUpdate: 'c',
            onDelete: 'c',
          },
        }),
      ]),
    ];

    await pullDbStructure(adapter, config);
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
    domainColumn: t.array(t.domain('schema.domain')),
    customTypeColumn: t.type('schema.customType'),
    jsonArray: t.json().default(t.sql\`'[]'\`),
    ...t.timestamps(),
  }));
});

change(async (db) => {
  await db.createTable(
    'table2',
    (t) => ({
      id: t.identity().primaryKey(),
      text: t.text().check(t.sql\`length(text) > 5\`),
      ...t.timestamps(),
    }),
    (t) => [
      t.check(t.sql({ raw: 'table check' }), 'table_column_check'),
      t.foreignKey(
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
    ],
  );
});
`,
    );

    expect(saveMigratedVersion).toBeCalledWith(
      expect.any(Object),
      'timestamp',
      'pull',
      config,
    );

    expect(warn).toBeCalledWith(`Found unsupported types:
- customType is used for column schema.table1.customTypeColumn
Append \`as\` method manually to this column to treat it as other column type`);
  });

  it('should pluralize warning when many columns have unknown types', async () => {
    structure.tables = [
      dbStructureMockFactory.table({
        columns: [
          dbStructureMockFactory.column({
            name: 'column1',
            type: 'unknown1',
          }),
          dbStructureMockFactory.column({
            name: 'column2',
            type: 'unknown2',
          }),
        ],
      }),
    ];

    await pullDbStructure(adapter, config);

    expect(warn).toBeCalledWith(`Found unsupported types:
- unknown1 is used for column public.table.column1
- unknown2 is used for column public.table.column2
Append \`as\` method manually to these columns to treat them as other column type`);

    expect(log).toBeCalledWith('Database pulled successfully');
  });

  it(`should add simple timestamps and do not add name('snake_case'), but add name('camelCase') when snakeCase: true`, async () => {
    structure.tables = [
      dbStructureMockFactory.table({
        columns: [
          dbStructureMockFactory.intColumn({
            name: 'snake_case',
          }),
          dbStructureMockFactory.intColumn({
            name: 'camelCase',
          }),
          dbStructureMockFactory.createdAtColumn({
            name: 'created_at',
          }),
          dbStructureMockFactory.updatedAtColumn({
            name: 'updated_at',
          }),
        ],
      }),
    ];

    const config = makeConfig({ snakeCase: true });

    await pullDbStructure(adapter, config);

    expectWritten(
      `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable(
    'table',
    {
      noPrimaryKey: true,
    },
    (t) => ({
      snakeCase: t.integer(),
      camelCase: t.name('camelCase').integer(),
      ...t.timestamps(),
    }),
  );
});
`,
    );

    expect(saveMigratedVersion).toBeCalledWith(
      expect.any(Object),
      'timestamp',
      'pull',
      config,
    );
  });

  it('should handle enum', async () => {
    structure.tables = [
      dbStructureMockFactory.table({
        columns: [dbStructureMockFactory.enumColumn()],
      }),
    ];
    structure.enums = [dbStructureMockFactory.enum()];

    await pullDbStructure(adapter, makeConfig());

    expectWritten(`import { change } from '../dbScript';

change(async (db) => {
  await db.createEnum('mood', ['sad', 'ok', 'happy']);
});

change(async (db) => {
  await db.createTable(
    'table',
    {
      noPrimaryKey: true,
    },
    (t) => ({
      column: t.enum('mood'),
    }),
  );
});
`);
  });
});
