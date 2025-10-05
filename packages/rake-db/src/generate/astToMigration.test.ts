import { astToMigration } from './astToMigration';
import { makeColumnTypes, raw, defaultSchemaConfig, TableData } from 'pqb';
import { RakeDbAst } from '../ast';
import { processRakeDbConfig } from '../config';

const columnTypes = makeColumnTypes(defaultSchemaConfig);
const t = {
  ...columnTypes,
};

const config = processRakeDbConfig({
  migrationsPath: 'migrations',
  import: (path) => import(path),
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
  excludes: [],
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
  baseType: t
    .integer()
    .collate('C')
    .default(raw`123`)
    .check(raw`VALUE = 42`),
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

const expectResult = (code: string | undefined, expected: string) => {
  expect(`import { change } from '../dbScript';\n${code}`).toBe(expected);
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
        version: '123',
      },
    ]);

    expectResult(
      result,
      template(`  await db.createExtension('extensionName', {
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

    it('should add columns with indexes, excludes, and foreignKeys', () => {
      const result = act([
        {
          ...table,
          shape: {
            someId: t
              .integer()
              // @ts-expect-error name as argument is deprecated
              .unique('indexName', { nullsNotDistinct: true })
              // @ts-expect-error name as argument is deprecated
              .exclude('=', 'excludeName', { order: 'ASC' })
              .foreignKey('otherTable', 'otherId', {
                name: 'fkey',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              }),
            someId2: t
              .integer()
              .unique({ name: 'indexName', nullsNotDistinct: true })
              .exclude('=', { name: 'excludeName', order: 'ASC' }),
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
    }).exclude('=', {
      name: 'excludeName',
      order: 'ASC',
    }),
    someId2: t.integer().unique({
      name: 'indexName',
      nullsNotDistinct: true,
    }).exclude('=', {
      name: 'excludeName',
      order: 'ASC',
    }),
  }));
});
`,
      );
    });

    it('should add composite primaryKeys, indexes, excludes, foreignKeys', () => {
      const result = act([
        {
          ...table,
          shape: {
            id: t.identity().primaryKey(),
          },
          primaryKey: { columns: ['id', 'name'], name: 'pkey' },
          indexes: [
            {
              columns: [{ column: 'id' }, { column: 'name' }],
              options: { name: 'index', unique: true, nullsNotDistinct: true },
            },
          ],
          excludes: [
            {
              columns: [
                { column: 'id', with: '=' },
                { column: 'name', with: '!=' },
              ],
              options: {
                name: 'exclude',
                where: 'whe',
              },
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
        template(`  await db.createTable(
    'schema.table',
    (t) => ({
      id: t.identity().primaryKey(),
    }),
    (t) => [
      t.primaryKey(['id', 'name'], 'pkey'),
      t.unique(['id', 'name'], {
        name: 'index',
        nullsNotDistinct: true,
      }),
      t.exclude(
        [
          {
            column: 'id',
            with: '=',
          },
          {
            column: 'name',
            with: '!=',
          },
        ],
        {
          name: 'exclude',
          where: 'whe',
        },
      ),
      t.foreignKey(
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
    ],
  );`),
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
              item: t.timestamp().default(raw`now()`),
            },
            updatedAt: {
              type: 'drop',
              item: t.timestamp().default(raw`now()`),
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
        name: 'pkey',
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
    ...t.drop(t.primaryKey(['one', 'two'], 'pkey')),
    ...t.add(t.primaryKey(['one', 'two'], 'pkey')),
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
          using: 'using',
          nullsNotDistinct: true,
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          language: 'language',
          languageColumn: 'languageColumn',
          tsVector: true,
          dropMode: 'CASCADE',
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
          {
            expression: 'expression',
          },
        ],
        {
          unique: true,
          name: 'idx',
          using: 'using',
          nullsNotDistinct: true,
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          language: 'language',
          languageColumn: 'languageColumn',
          dropMode: 'CASCADE',
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
          {
            expression: 'expression',
          },
        ],
        {
          unique: true,
          name: 'idx',
          using: 'using',
          nullsNotDistinct: true,
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          language: 'language',
          languageColumn: 'languageColumn',
          dropMode: 'CASCADE',
        },
      ),
    ),
  }));
});
`,
      );
    });

    it('should add and drop exclude', () => {
      const item: TableData.Exclude = {
        columns: [
          {
            column: 'column',
            with: '=',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
          },
          {
            expression: 'expression',
            with: '&&',
          },
        ],
        options: {
          name: 'exc',
          using: 'using',
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          dropMode: 'CASCADE',
        },
      };

      const result = act([
        {
          type: 'changeTable',
          schema: 'schema',
          name: 'table',
          shape: {},
          add: {
            excludes: [item],
          },
          drop: {
            excludes: [item],
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('schema.table', (t) => ({
    ...t.drop(
      t.exclude(
        [
          {
            column: 'column',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            with: '=',
          },
          {
            expression: 'expression',
            with: '&&',
          },
        ],
        {
          name: 'exc',
          using: 'using',
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          dropMode: 'CASCADE',
        },
      ),
    ),
    ...t.add(
      t.exclude(
        [
          {
            column: 'column',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            with: '=',
          },
          {
            expression: 'expression',
            with: '&&',
          },
        ],
        {
          name: 'exc',
          using: 'using',
          include: ['include'],
          with: 'with',
          tablespace: 'tablespace',
          where: 'where',
          dropMode: 'CASCADE',
        },
      ),
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

    it('should create a table with a self-referencing foreign key', () => {
      const result = act([
        {
          ...table,
          shape: {
            id: t.uuid().primaryKey(),
            selfId: t
              .integer()
              .foreignKey(`${table.schema}.${table.name}`, 'id'),
          },
        },
      ]);

      expectResult(
        result,
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.uuid().primaryKey(),
    selfId: t.integer().foreignKey('schema.table', 'id'),
  }));`),
      );
    });

    it('should create a table with a self-referencing composite foreign key', () => {
      const result = act([
        {
          ...table,
          shape: {
            id: t.identity(),
            name: t.text(),
          },
          primaryKey: { columns: ['id', 'name'] },
          constraints: [
            {
              references: {
                columns: ['id', 'name'],
                fnOrTable: 'schema.table',
                foreignColumns: ['id', 'name'],
              },
            },
          ],
        },
      ]);

      expectResult(
        result,
        template(`  await db.createTable(
    'schema.table',
    (t) => ({
      id: t.identity(),
      name: t.text(),
    }),
    (t) => [
      t.primaryKey(['id', 'name']),
      t.foreignKey(
        ['id', 'name'],
        'schema.table',
        ['id', 'name'],
      ),
    ],
  );`),
      );
    });

    it('should drop a table with a self-referencing foreign key', () => {
      const result = act([
        {
          ...table,
          action: 'drop',
          shape: {
            id: t.uuid().primaryKey(),
            selfId: t
              .integer()
              .foreignKey(`${table.schema}.${table.name}`, 'id'),
          },
        },
      ]);

      expectResult(
        result,
        template(`  await db.dropTable('schema.table', (t) => ({
    id: t.uuid().primaryKey(),
    selfId: t.integer().foreignKey('schema.table', 'id'),
  }));`),
      );
    });
  });

  it('should drop a table with a self-referencing composite foreign key', () => {
    const result = act([
      {
        ...table,
        action: 'drop',
        shape: {
          id: t.identity(),
          name: t.text(),
        },
        primaryKey: { columns: ['id', 'name'] },
        constraints: [
          {
            references: {
              columns: ['id', 'name'],
              fnOrTable: 'schema.table',
              foreignColumns: ['id', 'name'],
            },
          },
        ],
      },
    ]);

    expectResult(
      result,
      template(`  await db.dropTable(
    'schema.table',
    (t) => ({
      id: t.identity(),
      name: t.text(),
    }),
    (t) => [
      t.primaryKey(['id', 'name']),
      t.foreignKey(
        ['id', 'name'],
        'schema.table',
        ['id', 'name'],
      ),
    ],
  );`),
    );
  });

  describe('check', () => {
    it('should add column check', () => {
      const result = act([
        {
          ...table,
          shape: {
            id: table.shape.id
              .check(raw({ raw: 'column > 10' }))
              .check(raw({ raw: 'column < 20' })),
          },
        },
      ]);

      expectResult(
        result,
        `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    id: t.identity().primaryKey().check(t.sql({ raw: 'column > 10' })).check(t.sql({ raw: 'column < 20' })),
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
  await db.createTable(
    'schema.table',
    (t) => ({
      id: t.identity().primaryKey(),
    }),
    (t) => t.check(t.sql({ raw: 'sql' })),
  );
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

  describe('renameConstraint', () => {
    it('should rename a constraint', () => {
      const result = act([
        {
          type: 'renameTableItem',
          kind: 'CONSTRAINT',
          tableSchema: 'schema',
          tableName: 'table',
          from: 'from',
          to: 'to',
        },
      ]);

      expectResult(
        result,
        template(`  await db.renameConstraint('schema.table', 'from', 'to');`),
      );
    });
  });

  describe('renameIndex', () => {
    it('should rename an index', () => {
      const result = act([
        {
          type: 'renameTableItem',
          kind: 'INDEX',
          tableSchema: 'schema',
          tableName: 'table',
          from: 'from',
          to: 'to',
        },
      ]);

      expectResult(
        result,
        template(`  await db.renameIndex('schema.table', 'from', 'to');`),
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
  await db.createDomain('schema.domainName', (t) => t.integer().default(t.sql\`123\`).check(t.sql\`VALUE = 42\`).collate('C'));
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
              increment: 2,
              start: 3,
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
      increment: 2,
      start: 3,
      min: 4,
      max: 5,
      cache: 6,
      cycle: true,
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
