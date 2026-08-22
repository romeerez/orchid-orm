import {
  defineTable,
  sql,
  useGeneratorsTestUtils,
} from './generators.test-utils';
import {
  DefaultColumnTypes,
  DefaultSchemaConfig,
  UnknownColumn,
  colors,
} from 'pqb/internal';
import { DbMigration } from 'rake-db';
import { defineRls } from '../../../orm-instance/orm-instance';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));
jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red, yellow } = colors;

describe('tables', () => {
  const { arrange, act, assert } = useGeneratorsTestUtils();

  it('should support a specific clock_timestamp() timestamp default', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          id: t.identity().primaryKey(),
          timeStamp: t
            .timestamp()
            .default(t.sql`clock_timestamp() AT TIME ZONE 'UTC'`),
        }));
      },
      tables: [
        defineTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity().primaryKey(),
          timeStamp: t
            .timestamp()
            .default(t.sql`clock_timestamp() AT TIME ZONE 'UTC'`),
        })),
      ],
    });

    await act();

    assert.migration(undefined);
  });

  it('should not drop ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createTable('schema.inSchemaTable', (t) => ({
          id: t.identity().primaryKey(),
        }));

        await db.createTable('publicTable', (t) => ({
          id: t.identity().primaryKey(),
        }));
      },
      dbOptions: {
        generatorIgnore: {
          schemas: ['schema'],
          tables: ['publicTable'],
        },
      },
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should ignore definition-side generator ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('ignored_schema');
        await db.createTable('changed_table', (t) => ({
          id: t.integer().primaryKey(),
        }));
        await db.createTable('schema_moved_table', (t) => ({
          id: t.integer().primaryKey(),
        }));
      },
      tables: [
        defineTable(
          'created_table',
          {
            noPrimaryKey: true,
            generatorIgnore: true,
            nameInDb: 'created_table',
          },
          () => ({}),
        ),
        defineTable(
          'changed_table',
          {
            noPrimaryKey: true,
            generatorIgnore: true,
            nameInDb: 'changed_table',
          },
          (t) => ({
            id: t.integer().primaryKey(),
            name: t.text(),
          }),
        ),
        defineTable(
          'schema_moved_table',
          {
            schema: 'ignored_schema',
            noPrimaryKey: true,
            generatorIgnore: true,
            nameInDb: 'schema_moved_table',
          },
          (t) => ({
            id: t.integer().primaryKey(),
          }),
        ),
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should not ignore managed tables with the same name as definition-side ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('ignored_schema');
        await db.createTable('shared_table', (t) => ({
          id: t.integer().primaryKey(),
        }));
      },
      tables: [
        defineTable(
          'shared_table',
          {
            schema: 'ignored_schema',
            noPrimaryKey: true,
            generatorIgnore: true,
            nameInDb: 'shared_table',
          },
          (t) => ({
            id: t.integer().primaryKey(),
          }),
        ),
        defineTable(
          'shared_table',
          { nameInDb: 'shared_table', noPrimaryKey: true },
          (t) => ({
            id: t.integer().primaryKey(),
            name: t.text(),
          }),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('shared_table', (t) => ({
    name: t.add(t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} shared_table:
  ${green('+ add column')} name text`);
  });

  it('should ignore rls for definition-side generator ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('ignored_rls_table', (t) => ({
          id: t.identity().primaryKey(),
        }));
      },
      tables: [
        defineTable(
          'ignored_rls_table',
          {
            noPrimaryKey: true,
            generatorIgnore: true,
            nameInDb: 'ignored_rls_table',
          },
          (t) => ({
            id: t.identity().primaryKey(),
          }),
        ).rls(
          defineRls({
            enable: true,
            permit: [
              {
                name: 'ignored_rls_policy',
                for: 'SELECT',
                to: 'public',
                using: sql`id > 0`,
              },
            ],
          }),
        ),
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should throw if found more than one table with same schema and name', async () => {
    await arrange({
      tables: [
        defineTable(
          'table',
          { schema: () => 'schema', noPrimaryKey: true },
          () => ({}),
        ),
        defineTable(
          'table',
          { schema: () => 'schema', noPrimaryKey: true },
          () => ({}),
        ),
      ],
    });

    await expect(act()).rejects.toThrow(
      `Table schema.table is defined more than once`,
    );
  });

  it('should match code table aliases by their database names', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('user_profile', (t) => ({
          id: t.identity().primaryKey(),
        }));

        await db.createTable('app_users', (t) => ({
          id: t.identity().primaryKey(),
        }));
      },
      tables: [
        defineTable(
          'UserProfile',
          { nameInDb: 'user_profile', noPrimaryKey: false },
          (t) => ({
            id: t.identity().primaryKey(),
          }),
        ),
        defineTable(
          'User',
          { nameInDb: 'app_users', noPrimaryKey: false },
          (t) => ({
            id: t.identity().primaryKey(),
          }),
        ),
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it(
    'should create table with customly named timestamps, ignore virtual column, add table comment, add noPrimaryKey option, ' +
      'add composite primary key, index, constraint',
    async () => {
      await arrange({
        async prepareDb(db) {
          await db.createSchema('schema');
        },
        tables: [
          defineTable(
            'one',
            {
              schema: () => 'schema',
              noPrimaryKey: true,
              comment: 'table comment',
              snakeCase: true,
              nameInDb: 'one',
            },
            (t) => ({
              naMe: t.string(),
              iNt: t.integer(),
              virtUal: UnknownColumn.instance,
              creatEd: t.timestamps().createdAt,
              updatEd: t.timestamps().updatedAt,
            }),
          )
            .primaryKey(['naMe', 'iNt'])
            .index(['naMe', 'iNt'])
            .check(sql`"i_nt" > 5`, 'constraintName'),
        ],
      });

      await act();

      assert.migration(
        `import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'schema.one',
    {
      comment: "table comment",
      noPrimaryKey: true,
    },
    (t) => ({
      naMe: t.string(),
      iNt: t.integer(),
      ` +
          // when creating, logic can see that `createdAt` and `updatedAt` are indeed coming from `timestamps` and can rely on this fact.
          `creatEd: t.timestamp().default(t.sql\`now()\`),
      updatEd: t.timestamp().default(t.sql\`now()\`),
    }),
    (t) => [
      t.primaryKey(['naMe', 'iNt']),
      t.index(['naMe', 'iNt']),
      t.check(t.sql\`"i_nt" > 5\`, 'constraintName'),
    ],
  );
});
`,
      );

      assert.report(
        `${green('+ create table')} schema.one (4 columns, 1 index, 1 check)`,
      );
    },
  );

  it('should drop table with same properties as when creating a table', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createTable(
          'schema.one',
          { comment: 'table comment', noPrimaryKey: true },
          (t) => ({
            naMe: t.varchar(255),
            iNt: t.integer().check(sql`(i_nt > 5)`),
            creatEd: t.timestamps().createdAt,
            updatEd: t.timestamps().updatedAt,
          }),
          (t) => [t.primaryKey(['naMe', 'iNt']), t.index(['naMe', 'iNt'])],
        );
      },
    });

    await act();

    assert.migration(
      `import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropTable(
    'schema.one',
    {
      comment: "table comment",
    },
    (t) => ({
      naMe: t.varchar(255),
      iNt: t.integer().check(t.sql\`(i_nt > 5)\`),
      ` +
        // when dropping, the logic cannot know if it's from `timestamps` or if it's just an arbitrary timestamp.
        `creatEd: t.timestamp().default(t.sql\`now()\`),
      updatEd: t.timestamp().default(t.sql\`now()\`),
    }),
    (t) => [
      t.primaryKey(['naMe', 'iNt']),
      t.index(['naMe', 'iNt']),
    ],
  );
});

change(async (db) => {
  await db.dropSchema('schema');
});
`,
    );

    assert.report(`${red('- drop schema')} schema
${red('- drop table')} schema.one (4 columns, 1 index, 1 check)`);
  });

  it('should create a new table and drop the old one when choosing such option', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('one', (t) => ({
          iD: t.integer().primaryKey(),
        }));
      },
      tables: [
        defineTable('two', { noPrimaryKey: true, nameInDb: 'two' }, () => ({})),
      ],
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'two',
    {
      noPrimaryKey: true,
    },
    (t) => ({}),
  );

  await db.dropTable('one', (t) => ({
    iD: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${green('+ create table')} two (0 columns, no primary key)`,
      `${red('- drop table')} one (1 column)`,
    );
  });

  it('should create a new table and drop the old one when choosing such option, with schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');
        await db.createSchema('to');

        await db.createTable('from.one', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('from.unchanged', { noPrimaryKey: true });
      },
      tables: [
        defineTable(
          'two',
          { schema: 'to', nameInDb: 'two', noPrimaryKey: true },
          () => ({}),
        ),
        defineTable(
          'unchanged',
          { schema: 'from', nameInDb: 'unchanged', noPrimaryKey: true },
          () => ({}),
        ),
      ],
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'to.two',
    {
      noPrimaryKey: true,
    },
    (t) => ({}),
  );

  await db.dropTable('from.one', (t) => ({
    iD: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${green('+ create table')} to.two (0 columns, no primary key)`,
      `${red('- drop table')} from.one (1 column)`,
    );
  });

  it('should rename table when is selected so, and drop the remaining table', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('one', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('two', (t) => ({
          iD: t.integer().primaryKey(),
        }));
      },
      tables: [
        defineTable(
          'three',
          { nameInDb: 'three', noPrimaryKey: true },
          (t) => ({
            iD: t.integer().primaryKey(),
          }),
        ),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameTable('one', 'three');

  await db.dropTable('two', (t) => ({
    iD: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${yellow('~ rename table')} one ${yellow('=>')} three`,
      `${red('- drop table')} two (1 column)`,
    );
  });

  it('should rename table when is selected so, and drop the remaining table, with schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');
        await db.createSchema('to');

        await db.createTable('from.one', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('from.two', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('from.unchanged', { noPrimaryKey: true });
      },
      tables: [
        defineTable(
          'three',
          { schema: 'to', nameInDb: 'three', noPrimaryKey: true },
          (t) => ({
            iD: t.integer().primaryKey(),
          }),
        ),
        defineTable(
          'unchanged',
          { schema: 'from', nameInDb: 'unchanged', noPrimaryKey: true },
          () => ({}),
        ),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameTable('from.one', 'to.three');

  await db.dropTable('from.two', (t) => ({
    iD: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${yellow('~ change schema and rename table')} from.one ${yellow(
        '=>',
      )} to.three`,
      `${red('- drop table')} from.two (1 column)`,
    );
  });

  it('should rename and change a table', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('from', (t) => ({
          iD: t.integer().primaryKey(),
        }));
      },
      tables: [
        defineTable('to', { nameInDb: 'to', noPrimaryKey: true }, (t) => ({
          iD: t.integer().primaryKey(),
          naMe: t.text(),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameTable('from', 'to');
});

change(async (db) => {
  await db.changeTable('to', (t) => ({
    naMe: t.add(t.text()),
  }));
});
`);

    assert.report(
      `${yellow('~ rename table')} from ${yellow('=>')} to`,
      `${yellow('~ change table')} to:`,
      `  ${green('+ add column')} naMe text`,
    );
  });

  describe('hasAndBelongsToMany', () => {
    const prepareDb = async (
      db: DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>,
    ) => {
      await db.createTable('one', { noPrimaryKey: true }, (t) => ({
        iD: t.identity(),
      }));
      await db.createTable('two', { noPrimaryKey: true }, (t) => ({
        iD: t.identity(),
      }));
    };

    it('should create join table', async () => {
      const Two = defineTable(
        'two',
        { nameInDb: 'two', noPrimaryKey: true },
        (t) => ({
          iD: t.identity(),
        }),
      );

      const One = defineTable(
        'one',
        { nameInDb: 'one', noPrimaryKey: true },
        (t) => ({
          iD: t.identity(),
        }),
      ).relations((one) => ({
        twos: one('iD')
          .hasAndBelongsToMany(() => Two('iD'))
          .through('joinTable', 'oneId', 'twoId'),
      }));

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'join_table',
    (t) => ({
      oneId: t.integer(),
      twoId: t.integer(),
    }),
    (t) => t.primaryKey(['oneId', 'twoId']),
  );
});
`);

      assert.report(`${green('+ create table')} join_table (2 columns)`);
    });

    it('should ignore definition-side generator ignored join tables', async () => {
      const Two = defineTable(
        'two',
        { nameInDb: 'two', noPrimaryKey: true },
        (t) => ({
          iD: t.identity(),
        }),
      );

      const One = defineTable(
        'one',
        { noPrimaryKey: true, generatorIgnore: true, nameInDb: 'one' },
        (t) => ({
          iD: t.identity(),
        }),
      ).relations((one) => ({
        twos: one('iD')
          .hasAndBelongsToMany(() => Two('iD'))
          .through('ignoredJoinTable', 'oneId', 'twoId'),
      }));

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await act();

      assert.migration();
      assert.report('No changes were detected');
    });

    it('should create join table just once when it is defined on both sides', async () => {
      const One = defineTable(
        'one',
        { nameInDb: 'one', noPrimaryKey: true },
        (t) => ({
          iD: t.identity(),
        }),
      ).relations((one) => ({
        twos: one('iD')
          .hasAndBelongsToMany(() => Two('iD'))
          .through('joinTable', 'oneId', 'twoId'),
      }));

      const Two = defineTable(
        'two',
        { nameInDb: 'two', noPrimaryKey: true },
        (t) => ({
          iD: t.identity(),
        }),
      ).relations((two) => ({
        twos: two('iD')
          .hasAndBelongsToMany(() => One('iD'))
          .through('joinTable', 'twoId', 'oneId'),
      }));

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'join_table',
    (t) => ({
      oneId: t.integer(),
      twoId: t.integer(),
    }),
    (t) => t.primaryKey(['oneId', 'twoId']),
  );
});
`);

      assert.report(`${green('+ create table')} join_table (2 columns)`);
    });

    it('should throw if two join table do not match', async () => {
      const One = defineTable(
        'one',
        { nameInDb: 'one', noPrimaryKey: true },
        (t) => ({
          iD: t.identity().primaryKey(),
        }),
      ).relations((one) => ({
        twos: one('iD')
          .hasAndBelongsToMany(() => Two('iD'))
          .through('joinTable', 'oneId', 'twoId'),
      }));

      const Two = defineTable(
        'two',
        { nameInDb: 'two', noPrimaryKey: true },
        (t) => ({
          iD: t.identity().primaryKey(),
        }),
      ).relations((two) => ({
        twos: two('iD')
          .hasAndBelongsToMany(() => One('iD'))
          .through('joinTable', 'wrong', 'oneId'),
      }));

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await expect(act()).rejects.toThrow('does not match');
    });

    it('should handle multiple has and belongs to many', async () => {
      const RoleTable = defineTable(
        'user_staff_role',
        { nameInDb: 'user_staff_role', noPrimaryKey: false },
        (t) => ({
          iD: t.identity().primaryKey(),
        }),
      ).relations((role) => ({
        staffs: role('iD')
          .hasAndBelongsToMany(() => StaffTable('iD'))
          .through('user_staff_to_role', 'roleId', 'staffId'),

        permissions: role('iD')
          .hasAndBelongsToMany(() => PermissionTable('iD'))
          .through('user_role_to_perm', 'roleId', 'permId'),
      }));

      const PermissionTable = defineTable(
        'user_staff_perm',
        { nameInDb: 'user_staff_perm', noPrimaryKey: false },
        (t) => ({
          iD: t.identity().primaryKey(),
        }),
      ).relations((permission) => ({
        roles: permission('iD')
          .hasAndBelongsToMany(() => RoleTable('iD'))
          .through('user_role_to_perm', 'permId', 'roleId'),
      }));

      const StaffTable = defineTable(
        'user_staff',
        { nameInDb: 'user_staff', noPrimaryKey: false },
        (t) => ({
          iD: t.identity().primaryKey(),
        }),
      ).relations((staff) => ({
        roles: staff('iD')
          .hasAndBelongsToMany(() => RoleTable('iD'))
          .through('user_staff_to_role', 'staffId', 'roleId'),
      }));

      await arrange({
        tables: [StaffTable, RoleTable, PermissionTable],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable('user_staff', (t) => ({
    iD: t.identity().primaryKey(),
  }));

  await db.createTable(
    'user_staff_to_role',
    (t) => ({
      staffId: t.integer(),
      roleId: t.integer(),
    }),
    (t) => t.primaryKey(['staffId', 'roleId']),
  );

  await db.createTable('user_staff_role', (t) => ({
    iD: t.identity().primaryKey(),
  }));

  await db.createTable(
    'user_role_to_perm',
    (t) => ({
      roleId: t.integer(),
      permId: t.integer(),
    }),
    (t) => t.primaryKey(['roleId', 'permId']),
  );

  await db.createTable('user_staff_perm', (t) => ({
    iD: t.identity().primaryKey(),
  }));
});
`);

      assert.report(`${green('+ create table')} user_staff (1 column)
${green('+ create table')} user_staff_to_role (2 columns)
${green('+ create table')} user_staff_role (1 column)
${green('+ create table')} user_role_to_perm (2 columns)
${green('+ create table')} user_staff_perm (1 column)`);
    });
  });

  it('should create postgis extension and a table with a postgis column', async () => {
    await arrange({
      dbOptions: {
        extensions: ['postgis'],
        generatorIgnore: {
          tables: ['spatial_ref_sys'],
        },
      },
      tables: [
        defineTable('table', { noPrimaryKey: true }, (t) => ({
          point: t.geography.point().primaryKey(),
        })),
      ],
    });

    await act();

    assert.report(`${green('+ create extension')} postgis
${green('+ create table')} table (1 column)`);
  });

  it('should auto generate foreign keys when using autoForeignKeys', async () => {
    const Two = defineTable(
      'two',
      { nameInDb: 'two', noPrimaryKey: false },
      (t) => ({
        id: t.identity().primaryKey(),
      }),
    );

    const One = defineTable(
      'one',
      {
        noPrimaryKey: false,
        autoForeignKeys: { onDelete: 'CASCADE' },
        nameInDb: 'one',
      },
      (t) => ({
        id: t.identity().primaryKey(),
        twoId: t.integer(),
      }),
    ).relations((one) => ({
      two: one('twoId').belongsTo(() => Two('id')),
    }));

    await arrange({
      tables: [One, Two],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable('two', (t) => ({
    id: t.identity().primaryKey(),
  }));
});

change(async (db) => {
  await db.createTable(
    'one',
    (t) => ({
      id: t.identity().primaryKey(),
      twoId: t.integer(),
    }),
    (t) => 
      t.foreignKey(
        ['twoId'],
        'two',
        ['id'],
        {
          onDelete: 'CASCADE',
        },
      ),
  );
});
`);
  });
});
