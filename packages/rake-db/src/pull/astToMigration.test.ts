import { astToMigration } from './astToMigration';
import { makeColumnTypes, raw, TableData, defaultSchemaConfig } from 'pqb';
import { RakeDbAst } from '../ast';
import { processRakeDbConfig } from '../common';

const t = makeColumnTypes(defaultSchemaConfig);

const template = (content: string) => `import { change } from '../dbScript';

change(async (db) => {
${content}
});
`;

const schema: RakeDbAst.Schema = {
  type: 'schema',
  action: 'create',
  name: 'schemaName',
};

const extension: RakeDbAst.Extension = {
  type: 'extension',
  action: 'create',
  name: 'extensionName',
};

const enumType: RakeDbAst.Enum = {
  type: 'enum',
  action: 'create',
  name: 'mood',
  values: ['sad', 'ok', 'happy'],
};

const table: RakeDbAst.Table = {
  type: 'table',
  action: 'create',
  schema: 'schema',
  name: 'table',
  noPrimaryKey: 'ignore',
  indexes: [],
  constraints: [],
  shape: {
    id: t.identity().primaryKey(),
  },
};

const domain: RakeDbAst.Domain = {
  type: 'domain',
  action: 'create',
  schema: 'schema',
  name: 'domainName',
  baseType: t.integer(),
  notNull: true,
  collation: 'C',
  default: raw({ raw: '123' }),
  check: raw({ raw: 'VALUE = 42' }),
};

const collation: RakeDbAst.Collation = {
  type: 'collation',
  action: 'create',
  schema: 'schema',
  name: 'collationName',
  locale: 'locale',
  lcCollate: 'lcCollate',
  lcCType: 'lcCType',
  provider: 'provider',
  deterministic: true,
  version: '123',
};

const foreignKey: RakeDbAst.Constraint & { references: TableData.References } =
  {
    type: 'constraint',
    action: 'create',
    tableName: 'table',
    references: {
      columns: ['otherId'],
      fnOrTable: 'otherTable',
      foreignColumns: ['id'],
      options: {},
    },
  };

const check: RakeDbAst.Constraint & { check: TableData.Check } = {
  type: 'constraint',
  action: 'create',
  tableName: 'table',
  check: raw({ raw: 'sql' }),
};

const config = processRakeDbConfig({
  migrationsPath: 'migrations',
});

const view: RakeDbAst.View = {
  type: 'view',
  action: 'create',
  schema: 'custom',
  name: 'view',
  shape: {
    id: t.integer(),
  },
  sql: raw({ raw: 'sql' }),
  options: {
    recursive: true,
    with: {
      checkOption: 'LOCAL',
      securityBarrier: true,
      securityInvoker: true,
    },
  },
};

const expectResult = (
  result: ((importPath: string) => string) | undefined,
  expected: string,
) => {
  expect(result?.('../dbScript')).toBe(expected);
};

describe('astToMigration', () => {
  beforeEach(jest.clearAllMocks);

  it('should return undefined when ast is empty', () => {
    const result = astToMigration(config, []);

    expect(result).toBe(undefined);
  });

  it('should put schema, extension, enum to first change, tables to separate changes, foreignKeys in last change', () => {
    const result = astToMigration(config, [
      schema,
      extension,
      enumType,
      {
        ...table,
        shape: {
          id: t.uuid().primaryKey(),
          enum: t.enum(enumType.name, enumType.values),
        },
      },
      { ...table, name: 'other' },
      foreignKey,
    ]);

    expectResult(
      result,
      `import { change } from '../dbScript';

change(async (db) => {
  await db.createSchema('schemaName');

  await db.createExtension('extensionName');

  await db.createEnum('mood', ['sad', 'ok', 'happy']);
});

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    id: t.uuid().primaryKey(),
    enum: t.enum('mood'),
  }));
});

change(async (db) => {
  await db.createTable('schema.other', (t) => ({
    id: t.identity().primaryKey(),
  }));
});

change(async (db) => {
  await db.addForeignKey(
    'table',
    ['otherId'],
    'otherTable',
    ['id'],
  );
});
`,
    );
  });

  it('should create schema', () => {
    const result = astToMigration(config, [schema]);

    expectResult(result, template(`  await db.createSchema('schemaName');`));
  });

  it('should create extension', () => {
    const result = astToMigration(config, [
      {
        ...extension,
        schema: 'schema',
        version: '123',
      },
    ]);

    expectResult(
      result,
      template(`  await db.createExtension('extensionName', {
    schema: 'schema',
    version: '123',
  });`),
    );
  });

  it('should create enum', () => {
    const result = astToMigration(config, [
      {
        ...enumType,
        schema: 'schema',
      },
    ]);

    expectResult(
      result,
      template(`  await db.createEnum('schema.mood', ['sad', 'ok', 'happy']);`),
    );
  });

  describe('table', () => {
    it('should create table', () => {
      const result = astToMigration(config, [table]);

      expectResult(
        result,
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.identity().primaryKey(),
  }));`),
      );
    });

    it('should add columns with indexes and foreignKeys', () => {
      const result = astToMigration(config, [
        {
          ...table,
          shape: {
            someId: t
              .integer()
              .unique({ name: 'indexName', nullsNotDistinct: true })
              .foreignKey('otherTable', 'otherId', {
                name: 'fkey',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              }),
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    someId: t.integer().foreignKey('otherTable', 'otherId', {
      name: 'fkey',
      match: 'FULL',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    }).unique({
      name: 'indexName',
      nullsNotDistinct: true,
    }),
  }));
});
`,
      );
    });

    it('should add composite primaryKeys, indexes, foreignKeys', () => {
      const result = astToMigration(config, [
        {
          ...table,
          shape: {
            id: t.identity().primaryKey(),
          },
          primaryKey: { columns: ['id', 'name'], options: { name: 'pkey' } },
          indexes: [
            {
              columns: [{ column: 'id' }, { column: 'name' }],
              options: { name: 'index', unique: true, nullsNotDistinct: true },
            },
          ],
          constraints: [
            {
              references: {
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
            },
          ],
        },
      ]);

      expectResult(
        result,
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.identity().primaryKey(),
    ...t.primaryKey(['id', 'name'], { name: 'pkey' }),
    ...t.index(['id', 'name'], {
      name: 'index',
      unique: true,
      nullsNotDistinct: true,
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

  describe('foreignKey', () => {
    it('should add standalone foreignKey', () => {
      const result = astToMigration(config, [
        {
          ...foreignKey,
          tableSchema: 'custom',
          name: 'fkey',
          references: {
            ...foreignKey.references,
            options: {
              match: 'FULL',
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            },
          },
        },
      ]);

      expectResult(
        result,
        template(`  await db.addForeignKey(
    'custom.table',
    ['otherId'],
    'otherTable',
    ['id'],
    {
      name: 'fkey',
      match: 'FULL',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
  );`),
      );
    });
  });

  describe('check', () => {
    it('should add column check', () => {
      const result = astToMigration(config, [
        {
          ...table,
          shape: {
            id: table.shape.id.check(raw({ raw: 'column > 10' })),
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    id: t.identity().primaryKey().check(t.sql({ raw: 'column > 10' })),
  }));
});
`,
      );
    });

    it('should add table check', () => {
      const result = astToMigration(config, [
        {
          ...table,
          constraints: [
            {
              check: raw({ raw: 'sql' }),
            },
          ],
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    id: t.identity().primaryKey(),
    ...t.check(t.sql({ raw: 'sql' })),
  }));
});
`,
      );
    });

    it('should add check', () => {
      const result = astToMigration(config, [check]);

      expectResult(
        result,
        template(`  await db.addCheck('table', t.sql({ raw: 'sql' }));`),
      );
    });
  });

  describe('constraint', () => {
    it('should add table constraint', () => {
      const result = astToMigration(config, [
        {
          ...foreignKey,
          tableSchema: 'custom',
          name: 'constraint',
          check: raw({ raw: 'sql' }),
          references: {
            ...foreignKey.references,
            options: {
              match: 'FULL',
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            },
          },
        },
      ]);

      expectResult(
        result,
        template(`  await db.addConstraint('custom.table', {
    name: 'constraint',
    references: [
      ['otherId'],
      'otherTable',
      ['id'],
      {
        match: 'FULL',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    ],
    check: t.sql({ raw: 'sql' }),
  });`),
      );
    });
  });

  describe('domain', () => {
    it('should add domain', () => {
      const result = astToMigration(config, [domain]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createDomain('schema.domainName', (t) => t.integer(), {
    notNull: true,
    collation: 'C',
    default: db.sql({ raw: '123' }),
    check: db.sql({ raw: 'VALUE = 42' }),
  });
});
`,
      );
    });
  });

  describe('collation', () => {
    it('should add collation', () => {
      const result = astToMigration(config, [collation]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createCollation('schema.collationName', {
    locale: 'locale',
    lcCollate: 'lcCollate',
    lcCType: 'lcCType',
    provider: 'provider',
    deterministic: true,
    version: '123',
  });
});
`,
      );
    });
  });

  describe('identity', () => {
    it('should add identity columns', () => {
      const result = astToMigration(config, [
        {
          ...table,
          shape: {
            identity: t.smallint().identity(),
            identityAlways: t.identity({
              always: true,
              incrementBy: 2,
              startWith: 3,
              min: 4,
              max: 5,
              cache: 6,
              cycle: true,
            }),
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    identity: t.smallint().identity(),
    identityAlways: t.identity({
      always: true,
      incrementBy: 2,
      startWith: 3,
      min: 4,
      max: 5,
      cache: 6,
    }),
  }));
});
`,
      );
    });
  });

  describe('view', () => {
    it('should create view', () => {
      const result = astToMigration(config, [view]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createView('custom.view', {
    recursive: true,
    checkOption: 'LOCAL',
    securityBarrier: true,
    securityInvoker: true,
  }, \`sql\`);
});
`,
      );
    });

    it('should create view with sql values', () => {
      const result = astToMigration(config, [
        { ...view, sql: raw({ raw: '$a' }).values({ a: 1 }) },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createView('custom.view', {
    recursive: true,
    checkOption: 'LOCAL',
    securityBarrier: true,
    securityInvoker: true,
  }, db.sql({ raw: '$a' }).values({"a":1}));
});
`,
      );
    });
  });
});
