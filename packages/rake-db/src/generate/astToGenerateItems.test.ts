import { RakeDbAst } from 'rake-db';
import { astToGenerateItem, GenerateItem } from './astToGenerateItems';
import { defaultSchemaConfig, makeColumnTypes } from 'pqb';

const t = makeColumnTypes(defaultSchemaConfig);

const tableAst: RakeDbAst.Table = {
  type: 'table',
  action: 'create',
  name: 'tableName',
  shape: {},
  noPrimaryKey: 'error',
};

const changeTableAst: RakeDbAst.ChangeTable = {
  type: 'changeTable',
  name: 'tableName',
  shape: {},
  add: {},
  drop: {},
};

let item: RakeDbAst = {} as RakeDbAst;

const arrange = (ast: RakeDbAst) => {
  item = ast;
};

const arrangeTable = (ast: Partial<RakeDbAst.Table>) => {
  item = { ...tableAst, ...ast };
};

const arrangeChangeTable = (ast: Partial<RakeDbAst.ChangeTable>) => {
  item = { ...changeTableAst, ...ast };
};

type TableGenerateItem = [up: GenerateItem, down: GenerateItem];

let result: GenerateItem | TableGenerateItem | undefined;
const act = () => {
  if ('action' in item) {
    result = [
      astToGenerateItem({ ...item, action: 'create' } as RakeDbAst, 'public'),
      astToGenerateItem({ ...item, action: 'drop' } as RakeDbAst, 'public'),
    ];
  } else {
    result = astToGenerateItem(item, 'public');
  }
};

const assertKeys = (keys: string[]) => {
  expect((result as TableGenerateItem)[0].add).toEqual(new Set(keys));
  expect((result as TableGenerateItem)[1].drop).toEqual(new Set(keys));
};

const assertKey = (key: string) => {
  if (Array.isArray(result)) {
    assertKeys([key]);
  } else {
    throw new Error('Expected add/drop result');
  }
};

const assertChange = ({
  add = [],
  drop = [],
}: {
  add?: string[];
  drop?: string[];
}) => {
  expect(result).toMatchObject({
    add: new Set(add),
    drop: new Set(drop),
  });
};

const assertDeps = (deps: string[]) => {
  if (Array.isArray(result)) {
    expect(result[0].deps).toEqual(result[1].deps);
    expect(result[0].deps).toEqual(new Set(deps));
  } else {
    expect((result as GenerateItem).deps).toEqual(new Set(deps));
  }
};

class SomeTable {
  table = 'some';
  columns = {
    id: t.integer(),
  };
}

class SomeTableWithSchema extends SomeTable {
  schema = 'schema';
}

describe('astToGenerateItem', () => {
  describe('table', () => {
    describe('keys', () => {
      const assertTableKey = (key: string) =>
        assertKeys([
          `public.${
            ((result as TableGenerateItem)[0].ast as RakeDbAst.Table).name
          }`,
          key,
        ]);

      it('should have a table name key', () => {
        arrangeTable({});

        act();

        assertTableKey('public.tableName');
      });

      it('should have a column pkey key', () => {
        arrangeTable({
          shape: {
            id: t.uuid().primaryKey(),
          },
        });

        act();

        assertTableKey('public.tableName_pkey');
      });

      it('should have a composite pkey key', () => {
        arrangeTable({
          primaryKey: {
            columns: [],
          },
        });

        act();

        assertTableKey('public.tableName_pkey');
      });

      it('should have a custom composite pkey key', () => {
        arrangeTable({
          primaryKey: {
            columns: [],
            options: {
              name: 'pkeyName',
            },
          },
        });

        act();

        assertTableKey('public.pkeyName');
      });

      it('should have a column index key', () => {
        arrangeTable({
          shape: {
            name: t.string().index(),
          },
        });

        act();

        assertTableKey('public.tableName_name_idx');
      });

      it('should have a custom column index key', () => {
        arrangeTable({
          shape: {
            name: t.string().index({ name: 'indexName' }),
          },
        });

        act();

        assertTableKey('public.indexName');
      });

      it('should have a composite index key', () => {
        arrangeTable({
          indexes: [
            {
              columns: [{ column: 'one' }, { column: 'two' }],
              options: {},
            },
          ],
        });

        act();

        assertTableKey('public.tableName_one_two_idx');
      });

      it('should have a custom composite index key', () => {
        arrangeTable({
          indexes: [
            {
              columns: [],
              options: { name: 'indexName' },
            },
          ],
        });

        act();

        assertTableKey('public.indexName');
      });

      it('should have a column fkey key', () => {
        arrangeTable({
          shape: {
            someId: t.integer().foreignKey('some', 'id'),
          },
        });

        act();

        assertTableKey('public.tableName_someId_fkey');
      });

      it('should have a custom column fkey key', () => {
        arrangeTable({
          shape: {
            someId: t.integer().foreignKey('some', 'id', { name: 'fkeyName' }),
          },
        });

        act();

        assertTableKey('public.fkeyName');
      });

      it('should have a constraint references key', () => {
        arrangeTable({
          constraints: [
            {
              references: {
                columns: ['one', 'two'],
                fnOrTable: '',
                foreignColumns: [],
              },
            },
          ],
        });

        act();

        assertTableKey('public.tableName_one_two_fkey');
      });

      it('should have a custom constraint key', () => {
        arrangeTable({
          constraints: [
            {
              name: 'constraintName',
            },
          ],
        });

        act();

        assertTableKey('public.constraintName');
      });
    });

    const origAssertDeps = assertDeps;
    describe('deps', () => {
      const assertDeps = (...deps: string[]) =>
        origAssertDeps([
          ((result as TableGenerateItem)[0].ast as RakeDbAst.Table).schema ??
            'public',
          ...deps,
        ]);

      it('should have a schema dep', () => {
        arrangeTable({});

        act();

        assertDeps('public');
      });

      it('should have a column fkey dep', () => {
        arrangeTable({
          shape: {
            someId: t.integer().foreignKey('some', 'id'),
          },
        });

        act();

        assertDeps('public.some', 'public.integer');
      });

      it('should have a column fkey dep with schema', () => {
        arrangeTable({
          shape: {
            someId: t.integer().foreignKey('schema.some', 'id'),
          },
        });

        act();

        assertDeps('schema.some', 'public.integer');
      });

      it('should have a column fn fkey dep', () => {
        arrangeTable({
          shape: {
            someId: t.integer().foreignKey(() => SomeTable, 'id'),
          },
        });

        act();

        assertDeps('public.some', 'public.integer');
      });

      it('should have a column fn fkey dep with schema', () => {
        arrangeTable({
          shape: {
            someId: t.integer().foreignKey(() => SomeTableWithSchema, 'id'),
          },
        });

        act();

        assertDeps('schema.some', 'public.integer');
      });

      it('should have a composite fkey dep', () => {
        arrangeTable({
          constraints: [
            {
              references: {
                columns: [],
                fnOrTable: 'some',
                foreignColumns: [],
              },
            },
          ],
        });

        act();

        assertDeps('public.some');
      });

      it('should have a composite fkey dep with schema', () => {
        arrangeTable({
          constraints: [
            {
              references: {
                columns: [],
                fnOrTable: 'schema.some',
                foreignColumns: [],
              },
            },
          ],
        });

        act();

        assertDeps('schema.some');
      });

      it('should have a composite fn fkey dep', () => {
        arrangeTable({
          constraints: [
            {
              references: {
                columns: [],
                fnOrTable: () => SomeTable,
                foreignColumns: [],
              },
            },
          ],
        });

        act();

        assertDeps('public.some');
      });

      it('should have a composite fn fkey dep with schema', () => {
        arrangeTable({
          constraints: [
            {
              references: {
                columns: [],
                fnOrTable: () => SomeTableWithSchema,
                foreignColumns: [],
              },
            },
          ],
        });

        act();

        assertDeps('schema.some');
      });

      it('should have collation deps', () => {
        arrangeTable({
          shape: {
            name: t.string().collate('customCollation'),
          },
        });

        act();

        assertDeps('public.varchar', 'customCollation');
      });

      it('should have enum deps', () => {
        arrangeTable({
          shape: {
            column: t.enum('enumName', ['one', 'two']),
          },
        });

        act();

        assertDeps('public.enumName');
      });
    });
  });

  describe('changeTable', () => {
    describe('keys', () => {
      describe.each(['add', 'drop'] as const)('%s', (action) => {
        it('should have column pkey key', () => {
          arrangeChangeTable({
            shape: {
              column: {
                type: action,
                item: t.integer().primaryKey(),
              },
            },
          });

          act();

          assertChange({
            [action]: ['public.tableName_pkey'],
          });
        });

        it('should have composite pkey key', () => {
          arrangeChangeTable({
            [action]: {
              primaryKey: {
                columns: [],
              },
            },
          });

          act();

          assertChange({
            [action]: ['public.tableName_pkey'],
          });
        });

        it('should have column index key', () => {
          arrangeChangeTable({
            shape: {
              column: {
                type: action,
                item: t.integer().index(),
              },
            },
          });

          act();

          assertChange({
            [action]: ['public.tableName_column_idx'],
          });
        });

        it('should have composite index key', () => {
          arrangeChangeTable({
            [action]: {
              indexes: [
                {
                  columns: [{ column: 'one' }, { column: 'two' }],
                  options: {},
                },
              ],
            },
          });

          act();

          assertChange({
            [action]: ['public.tableName_one_two_idx'],
          });
        });

        it('should have column fkey key', () => {
          arrangeChangeTable({
            shape: {
              column: {
                type: action,
                item: t.integer().foreignKey('some', 'id'),
              },
            },
          });

          act();

          assertChange({
            [action]: ['public.tableName_column_fkey'],
          });
        });

        it('should have composite fkey key', () => {
          arrangeChangeTable({
            [action]: {
              constraints: [
                {
                  references: {
                    columns: ['one', 'two'],
                    fnOrTable: 'some',
                    foreignColumns: ['three', 'four'],
                  },
                },
              ],
            },
          });

          act();

          assertChange({
            [action]: ['public.tableName_one_two_fkey'],
          });
        });
      });

      describe.each(['object', 'column'] as const)('change with %s', (type) => {
        it('should have change column pkey key', () => {
          arrangeChangeTable({
            shape: {
              column: {
                type: 'change',
                from:
                  type === 'object'
                    ? { primaryKey: false }
                    : { column: t.integer() },
                to:
                  type === 'object'
                    ? { primaryKey: true }
                    : { column: t.integer().primaryKey() },
              },
            },
          });

          act();

          assertChange({
            add: ['public.tableName_pkey'],
          });
        });

        it('should have change column index key', () => {
          arrangeChangeTable({
            shape: {
              column: {
                type: 'change',
                from:
                  type === 'object' ? { indexes: [] } : { column: t.integer() },
                to:
                  type === 'object'
                    ? { indexes: [{}] }
                    : { column: t.integer().index() },
              },
            },
          });

          act();

          assertChange({
            add: ['public.tableName_column_idx'],
          });
        });

        it('should have change column fkey key', () => {
          arrangeChangeTable({
            shape: {
              column: {
                type: 'change',
                from:
                  type === 'object'
                    ? { foreignKeys: [] }
                    : { column: t.integer() },
                to:
                  type === 'object'
                    ? { foreignKeys: [{ table: 'some', columns: ['id'] }] }
                    : { column: t.integer().foreignKey('some', 'id') },
              },
            },
          });

          act();

          assertChange({
            add: ['public.tableName_column_fkey'],
          });
        });
      });
    });

    const origAssertDeps = assertDeps;
    describe('deps', () => {
      const assertDeps = (...deps: string[]) => {
        const ast = (result as GenerateItem).ast as RakeDbAst.ChangeTable;
        origAssertDeps([`${ast.schema ?? 'public'}.${ast.name}`, ...deps]);
      };

      it('should have a table dep', () => {
        arrangeChangeTable({});

        act();

        assertDeps('public.tableName');
      });

      describe.each(['add', 'drop'] as const)('%s', (action) => {
        describe.each([
          'table',
          'table with schema',
          'fn',
          'fn with schema',
        ] as const)('%s', (type) => {
          const table =
            type === 'table'
              ? 'some'
              : type === 'table with schema'
              ? 'schema.some'
              : type === 'fn'
              ? () => SomeTable
              : () => SomeTableWithSchema;

          it('should have a column fkey dep', () => {
            arrangeChangeTable({
              shape: {
                column: {
                  type: action,
                  item: t.integer().foreignKey(table as never, 'id'),
                },
              },
            });

            act();

            assertDeps(
              `${type.includes('schema') ? 'schema' : 'public'}.some`,
              'public.integer',
            );
          });

          it('should have a composite fkey dep', () => {
            arrangeChangeTable({
              [action]: {
                constraints: [
                  {
                    references: {
                      fnOrTable: table,
                      columns: [],
                      foreignColumns: [],
                    },
                  },
                ],
              },
            });

            act();

            assertDeps(`${type.includes('schema') ? 'schema' : 'public'}.some`);
          });
        });
      });

      describe.each(['object', 'column'] as const)('change with %s', (type) => {
        it('should have change column fkey', () => {
          arrangeChangeTable({
            shape: {
              column: {
                type: 'change',
                from:
                  type === 'object'
                    ? { type: 'integer', foreignKeys: [] }
                    : { column: t.integer() },
                to:
                  type === 'object'
                    ? {
                        type: 'varchar',
                        foreignKeys: [{ table: 'some', columns: [] }],
                      }
                    : { column: t.string().foreignKey('some', 'id') },
              },
            },
          });

          act();

          assertDeps('public.some', 'public.integer', 'public.varchar');
        });
      });
    });
  });

  describe('renameTable', () => {
    it('should drop old table name and add a new one', () => {
      arrange({
        type: 'renameType',
        kind: 'TABLE',
        fromSchema: 'fromSchema',
        from: 'fromTable',
        toSchema: 'toSchema',
        to: 'toTable',
      });

      act();

      assertChange({
        drop: ['fromSchema.fromTable'],
        add: ['toSchema.toTable'],
      });
    });

    it('should drop old table name and add a new one with default schema', () => {
      arrange({
        type: 'renameType',
        kind: 'TABLE',
        from: 'fromTable',
        to: 'toTable',
      });

      act();

      assertChange({
        drop: ['public.fromTable'],
        add: ['public.toTable'],
      });
    });

    it('should add schemas to deps', () => {
      arrange({
        type: 'renameType',
        kind: 'TABLE',
        fromSchema: 'fromSchema',
        from: 'fromTable',
        toSchema: 'toSchema',
        to: 'toTable',
      });

      act();

      assertDeps(['fromSchema', 'toSchema']);
    });

    it('should add default schema to deps', () => {
      arrange({
        type: 'renameType',
        kind: 'TABLE',
        from: 'fromTable',
        to: 'toTable',
      });

      act();

      assertDeps(['public']);
    });
  });

  describe('schema', () => {
    it.each(['add', 'drop'] as const)(
      'should %s schema key and have no deps',
      (action) => {
        arrange({
          type: 'schema',
          action: action === 'add' ? 'create' : 'drop',
          name: 'schema',
        });

        act();

        assertKey('schema');
        assertDeps([]);
      },
    );
  });

  describe('renameSchema', () => {
    it('should drop old schema key and add new one and have no deps', () => {
      arrange({
        type: 'renameSchema',
        from: 'from',
        to: 'to',
      });

      act();

      assertChange({
        drop: ['from'],
        add: ['to'],
      });
      assertDeps([]);
    });
  });

  describe.each(['extension', 'enum', 'collation'] as const)('%s', (type) => {
    it.each(['add', 'drop'] as const)(
      `should %s ${type} key and have a default schema dep`,
      (action) => {
        arrange({
          type: type as 'extension',
          action: action === 'add' ? 'create' : 'drop',
          name: 'name',
        });

        act();

        assertKey('public.name');
        assertDeps(['public']);
      },
    );

    it.each(['add', 'drop'] as const)(
      `should %s ${type} key with schema`,
      (action) => {
        arrange({
          type: type as 'extension',
          action: action === 'add' ? 'create' : 'drop',
          name: 'name',
          schema: 'schema',
        });

        act();

        assertKey('schema.name');
        assertDeps(['schema']);
      },
    );
  });

  describe.each(['enumValues', 'renameEnumValues', 'changeEnumValues'])(
    '%s',
    (type) => {
      it('should have schema dep', () => {
        arrange({
          type,
          schema: 'schema',
        } as RakeDbAst);

        act();

        assertDeps(['schema']);
      });
    },
  );

  describe.each(['add', 'drop'] as const)('%s domain', (action) => {
    it(`should have domain key and have a default schema dep`, () => {
      arrange({
        type: 'domain',
        action: action === 'add' ? 'create' : 'drop',
        name: 'domain',
        baseType: t.integer(),
      });

      act();

      assertKey('public.domain');
      assertDeps(['public', 'public.integer']);
    });

    it(`should have domain key with schema`, () => {
      arrange({
        type: 'domain',
        action: action === 'add' ? 'create' : 'drop',
        name: 'domain',
        schema: 'schema',
        baseType: t.integer(),
      });

      act();

      assertKey('schema.domain');
      assertDeps(['schema', 'public.integer']);
    });

    it('should have collation deps', () => {
      arrange({
        type: 'domain',
        action: action === 'add' ? 'create' : 'drop',
        name: 'domain',
        baseType: t.integer(),
        collation: 'customCollation',
      });

      act();

      assertDeps(['public', 'public.integer', 'customCollation']);
    });
  });

  describe.each(['add', 'drop'] as const)('%s constraint', (action) => {
    describe.each(['default', 'custom'] as const)('%s schema', (schema) => {
      const tableSchema = schema === 'default' ? undefined : schema;
      const expectSchema = schema === 'default' ? 'public' : schema;

      it(`should have check constraint key and have a default schema dep`, () => {
        arrange({
          type: 'constraint',
          action: action === 'add' ? 'create' : 'drop',
          tableSchema,
          tableName: 'tableName',
          check: t.sql`check`,
        });

        act();

        assertKey(`${expectSchema}.tableName_check`);
        assertDeps([`${expectSchema}`, `${expectSchema}.tableName`]);
      });

      it(`should have identity constraint key and have a default schema dep`, () => {
        arrange({
          type: 'constraint',
          action: action === 'add' ? 'create' : 'drop',
          tableSchema,
          tableName: 'tableName',
          identity: {},
        });

        act();

        assertKey(`${expectSchema}.tableName_identity`);
        assertDeps([`${expectSchema}`, `${expectSchema}.tableName`]);
      });

      it(`should have foreign key constraint key and have a default schema dep`, () => {
        arrange({
          type: 'constraint',
          action: action === 'add' ? 'create' : 'drop',
          tableSchema,
          tableName: 'tableName',
          references: {
            columns: ['one', 'two'],
            fnOrTable: 'some',
            foreignColumns: [],
          },
        });

        act();

        assertKey(`${expectSchema}.tableName_one_two_fkey`);
        assertDeps([`${expectSchema}`, `${expectSchema}.tableName`]);
      });
    });

    it('should use a given name for the key', () => {
      arrange({
        type: 'constraint',
        action: action === 'add' ? 'create' : 'drop',
        tableName: 'tableName',
        name: 'constraintName',
      });

      act();

      assertKey('public.constraintName');
      assertDeps(['public', 'public.tableName']);
    });
  });

  describe.each(['renameConstraint', 'renameIndex'])('%s', (action) => {
    it('should have schema and table dep', () => {
      arrange({
        type: 'renameTableItem',
        kind: action === 'renameConstraint' ? 'CONSTRAINT' : 'INDEX',
        tableSchema: 'schema',
        tableName: 'table',
        from: 'from',
        to: 'to',
      });

      act();

      assertChange({
        drop: ['from'],
        add: ['to'],
      });
      assertDeps(['schema', 'schema.table']);
    });
  });

  describe.each(['add', 'drop'] as const)('%s view', (action) => {
    describe.each(['default', 'custom'] as const)('%s schema', (schema) => {
      const viewSchema = schema === 'default' ? undefined : schema;
      const expectSchema = schema === 'default' ? 'public' : schema;

      it('should have view key, and have schema, tables, column types, collation deps', () => {
        arrange({
          type: 'view',
          action: action === 'add' ? 'create' : 'drop',
          schema: viewSchema,
          name: 'viewName',
          shape: {
            name: t.string().collate('collationName'),
          },
          sql: t.sql`sql`,
          options: {},
          deps: [{ schemaName: 'public', name: 'table' }],
        });

        act();

        assertKey(`${expectSchema}.viewName`);
        assertDeps([
          expectSchema,
          'public.table',
          'public.varchar',
          'collationName',
        ]);
      });
    });
  });
});
