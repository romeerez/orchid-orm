import { astToMigration } from './astToMigration';
import { makeColumnTypes, raw, TableData, defaultSchemaConfig } from 'pqb';
import { RakeDbAst } from '../ast';
import { processRakeDbConfig } from '../config';

const columnTypes = makeColumnTypes(defaultSchemaConfig);
const t = {
  ...columnTypes,
  text: (min = 0, max = Infinity) => columnTypes.text(min, max),
};

const config = processRakeDbConfig({
  migrationsPath: 'migrations',
});

const act = (ast: RakeDbAst[]) => astToMigration('public', config, ast);

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
  noPrimaryKey: 'error',
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
  deps: [],
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
    const result = act([]);

    expect(result).toBe(undefined);
  });

  it('should put schema, extension, enum to first change, tables to separate changes, foreignKeys in last change', () => {
    const result = act([
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

  await db.createTable('schema.other', (t) => ({
    id: t.identity().primaryKey(),
  }));

  await db.addForeignKey(
    'table',
    ['otherId'],
    'otherTable',
    ['id'],
  );
});

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    id: t.uuid().primaryKey(),
    enum: t.enum('mood'),
  }));
});
`,
    );
  });

  it('should create schema', () => {
    const result = act([schema]);

    expectResult(result, template(`  await db.createSchema('schemaName');`));
  });

  it('should create extension', () => {
    const result = act([
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

  describe('enum', () => {
    it('should create enum', () => {
      const result = act([
        {
          ...enumType,
          schema: 'schema',
        },
      ]);

      expectResult(
        result,
        template(
          `  await db.createEnum('schema.mood', ['sad', 'ok', 'happy']);`,
        ),
      );
    });

    it.each(['add', 'drop'] as const)('should %s enum values', (action) => {
      const result = act([
        {
          type: 'enumValues',
          action,
          schema: 'schema',
          name: 'mood',
          values: ['ok', 'happy'],
        },
      ]);

      expectResult(
        result,
        template(
          `  await db.${action}EnumValues('schema.mood', ['ok', 'happy']);`,
        ),
      );
    });

    it('should rename enum values', () => {
      const result = act([
        {
          type: 'renameEnumValues',
          schema: 'schema',
          name: 'enum',
          values: { a: 'b', c: 'd' },
        },
      ]);

      expectResult(
        result,
        template(
          `  await db.renameEnumValues('schema.enum', { a: 'b', c: 'd' });`,
        ),
      );
    });
  });

  describe('table', () => {
    it('should create table', () => {
      const result = act([table]);

      expectResult(
        result,
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.identity().primaryKey(),
  }));`),
      );
    });

    it('should add columns with indexes and foreignKeys', () => {
      const result = act([
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
      const result = act([
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

    it('should change table comment', () => {
      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          comment: ['from', 'two'],
          shape: {},
          add: {},
          drop: {},
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable(
    'schema.table',
    { comment: ["from","two"] },
    (t) => ({}),
  );
});
`,
      );
    });

    it('should add, drop, change columns', () => {
      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          shape: {
            add: {
              type: 'add',
              item: t.integer(),
            },
            drop: {
              type: 'drop',
              item: t.text(),
            },
            change: {
              type: 'change',
              name: 'name',
              from: { column: t.boolean() },
              to: { column: t.timestamp() },
              using: {
                usingUp: t.sql`up`,
                usingDown: t.sql`down`,
              },
            },
          },
          add: {},
          drop: {},
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('schema.table', (t) => ({
    add: t.add(t.integer()),
    drop: t.drop(t.text()),
    change: t.name('name').change(t.boolean(), t.timestamp(), {
      usingUp: t.sql\`up\`,
      usingDown: t.sql\`down\`,
    }),
  }));
});
`,
      );
    });

    it('should add timestamps', () => {
      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          shape: {
            createdAt: {
              type: 'add',
              item: t.timestamp().default(raw({ raw: 'now()' })),
            },
            updatedAt: {
              type: 'add',
              item: t.timestamp().default(raw({ raw: 'now()' })),
            },
          },
          add: {},
          drop: {},
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('schema.table', (t) => ({
    ...t.add(t.timestamps()),
  }));
});
`,
      );
    });

    it('should drop timestamps', () => {
      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          shape: {
            createdAt: {
              type: 'drop',
              item: t.timestamp().default(raw({ raw: 'now()' })),
            },
            updatedAt: {
              type: 'drop',
              item: t.timestamp().default(raw({ raw: 'now()' })),
            },
          },
          add: {},
          drop: {},
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('schema.table', (t) => ({
    ...t.drop(t.timestamps()),
  }));
});
`,
      );
    });

    it('should add and drop primary key', () => {
      const primaryKey: TableData.PrimaryKey = {
        columns: ['one', 'two'],
        options: { name: 'pkey' },
      };

      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          shape: {},
          add: {
            primaryKey,
          },
          drop: {
            primaryKey,
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('schema.table', (t) => ({
    ...t.drop(t.primaryKey(['one', 'two'], { name: 'pkey' })),
    ...t.add(t.primaryKey(['one', 'two'], { name: 'pkey' })),
  }));
});
`,
      );
    });

    it('should add and drop index', () => {
      const index: TableData.Index = {
        columns: [
          {
            column: 'column',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            weight: 'A',
          },
          { expression: 'expression' },
        ],
        options: {
          name: 'idx',
          unique: true,
          nullsNotDistinct: true,
          using: 'using',
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          dropMode: 'CASCADE',
          language: 'language',
          languageColumn: 'languageColumn',
          tsVector: true,
        },
      };

      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          shape: {},
          add: {
            indexes: [index],
          },
          drop: {
            indexes: [index],
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('schema.table', (t) => ({
    ...t.drop(
      t.searchIndex(
        [
          {
            column: 'column',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            weight: 'A',
          },
          'expression',
        ],
        {
          name: 'idx',
          unique: true,
          nullsNotDistinct: true,
          using: 'using',
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          dropMode: 'CASCADE',
          language: 'language',
          languageColumn: 'languageColumn',
        },
      ),
    ),
    ...t.add(
      t.searchIndex(
        [
          {
            column: 'column',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            weight: 'A',
          },
          'expression',
        ],
        {
          name: 'idx',
          unique: true,
          nullsNotDistinct: true,
          using: 'using',
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          dropMode: 'CASCADE',
          language: 'language',
          languageColumn: 'languageColumn',
        },
      ),
    ),
  }));
});
`,
      );
    });

    it('should add and drop constraint', () => {
      const constraint: TableData.Constraint = {
        name: 'constraintName',
        check: raw({ raw: 'sql' }),
        identity: {
          always: true,
        },
        references: {
          columns: ['one', 'two'],
          fnOrTable: 'otherTable',
          foreignColumns: ['three', 'four'],
          options: {
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        },
        dropMode: 'CASCADE',
      };

      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          shape: {},
          add: {
            constraints: [constraint],
          },
          drop: {
            constraints: [constraint],
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('schema.table', (t) => ({
    ...t.drop(
      t.constraint({
        name: 'constraintName',
        references: [
          ['one', 'two'],
          'otherTable',
          ['three', 'four'],
          {
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        ],
        check: t.sql({ raw: 'sql' }),
      }),
    ),
    ...t.add(
      t.constraint({
        name: 'constraintName',
        references: [
          ['one', 'two'],
          'otherTable',
          ['three', 'four'],
          {
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        ],
        check: t.sql({ raw: 'sql' }),
      }),
    ),
  }));
});
`,
      );
    });

    it('should rename a column', () => {
      const result = act([
        {
          type: 'changeTable',
          name: 'table',
          shape: {
            from: {
              type: 'rename',
              name: 'to',
            },
          },
          add: {},
          drop: {},
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    from: t.rename('to'),
  }));
});
`,
      );
    });
  });

  describe('foreignKey', () => {
    it('should add standalone foreignKey', () => {
      const result = act([
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
      const result = act([
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
      const result = act([
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
      const result = act([check]);

      expectResult(
        result,
        template(`  await db.addCheck('table', t.sql({ raw: 'sql' }));`),
      );
    });
  });

  describe('constraint', () => {
    it('should add table constraint', () => {
      const result = act([
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
      const result = act([domain]);

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
      const result = act([collation]);

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
      const result = act([
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
      const result = act([view]);

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
      const result = act([
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
