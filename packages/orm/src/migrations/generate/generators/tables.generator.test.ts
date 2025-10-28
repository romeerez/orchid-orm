import { useGeneratorsTestUtils } from './generators.test-utils';
import {
  DefaultColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  UnknownColumn,
  colors,
} from 'pqb';
import { DbMigration } from 'rake-db';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red, yellow } = colors;

describe('tables', () => {
  const { arrange, act, assert, BaseTable, table } = useGeneratorsTestUtils();

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

  it('should throw if found more than one table with same schema and naMe', async () => {
    await arrange({
      tables: [
        class One extends BaseTable {
          schema = 'schema';
          table = 'table';
          noPrimaryKey = true;
        },
        class Two extends BaseTable {
          schema = 'schema';
          table = 'table';
          noPrimaryKey = true;
        },
      ],
    });

    await expect(act()).rejects.toThrow(
      `Table schema.table is defined more than once`,
    );
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
          class One extends BaseTable {
            schema = 'schema';
            table = 'one';
            comment = 'table comment';
            noPrimaryKey = true;
            snakeCase = true;
            columns = this.setColumns(
              (t) => ({
                naMe: t.string(),
                iNt: t.integer(),
                virtUal: new UnknownColumn(defaultSchemaConfig),
                creatEd: t.timestamps().createdAt,
                updatEd: t.timestamps().updatedAt,
              }),
              (t) => [
                t.primaryKey(['naMe', 'iNt']),
                t.index(['naMe', 'iNt']),
                t.check(t.sql`"i_nt" > 5`, 'constraintName'),
              ],
            );
          },
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
          `creatEd: t.timestamps().createdAt,
      updatEd: t.timestamps().updatedAt,
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
            iNt: t.integer().check(t.sql`(i_nt > 5)`),
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
        class Two extends BaseTable {
          noPrimaryKey = true;
          table = 'two';
        },
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
        class Two extends BaseTable {
          noPrimaryKey = true;
          schema = 'to';
          table = 'two';
        },
        class Unchanged extends BaseTable {
          schema = 'from';
          table = 'unchanged';
          noPrimaryKey = true;
        },
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
        table(
          (t) => ({
            iD: t.integer().primaryKey(),
          }),
          undefined,
          { name: 'three' },
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
        class Three extends BaseTable {
          schema = 'to';
          table = 'three';
          columns = this.setColumns((t) => ({
            iD: t.integer().primaryKey(),
          }));
        },
        class Unchanged extends BaseTable {
          schema = 'from';
          table = 'unchanged';
          noPrimaryKey = true;
        },
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
        class Table extends BaseTable {
          table = 'to';
          columns = this.setColumns((t) => ({
            iD: t.integer().primaryKey(),
            naMe: t.text(),
          }));
        },
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
      class One extends BaseTable {
        table = 'one';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          iD: t.identity(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => Two, {
            columns: ['iD'],
            references: ['oneId'],
            through: {
              table: 'joinTable',
              columns: ['twoId'],
              references: ['iD'],
            },
          }),
        };
      }

      class Two extends BaseTable {
        table = 'two';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          iD: t.identity(),
        }));
      }

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'joinTable',
    (t) => ({
      oneId: t.integer(),
      twoId: t.integer(),
    }),
    (t) => t.primaryKey(['oneId', 'twoId']),
  );
});
`);

      assert.report(`${green('+ create table')} joinTable (2 columns)`);
    });

    it('should create join table just once when it is defined on both sides', async () => {
      class One extends BaseTable {
        table = 'one';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          iD: t.identity(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => Two, {
            columns: ['iD'],
            references: ['oneId'],
            through: {
              table: 'joinTable',
              columns: ['twoId'],
              references: ['iD'],
            },
          }),
        };
      }

      class Two extends BaseTable {
        table = 'two';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          iD: t.identity(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => One, {
            columns: ['iD'],
            references: ['twoId'],
            through: {
              table: 'joinTable',
              columns: ['oneId'],
              references: ['iD'],
            },
          }),
        };
      }

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'joinTable',
    (t) => ({
      oneId: t.integer(),
      twoId: t.integer(),
    }),
    (t) => t.primaryKey(['oneId', 'twoId']),
  );
});
`);

      assert.report(`${green('+ create table')} joinTable (2 columns)`);
    });

    it('should throw if two join table do not match', async () => {
      class One extends BaseTable {
        table = 'one';
        columns = this.setColumns((t) => ({
          iD: t.identity().primaryKey(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => Two, {
            columns: ['iD'],
            references: ['oneId'],
            through: {
              table: 'joinTable',
              columns: ['twoId'],
              references: ['iD'],
            },
          }),
        };
      }

      class Two extends BaseTable {
        table = 'two';
        columns = this.setColumns((t) => ({
          iD: t.identity().primaryKey(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => One, {
            columns: ['iD'],
            references: ['wrong'],
            through: {
              table: 'joinTable',
              columns: ['oneId'],
              references: ['iD'],
            },
          }),
        };
      }

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await expect(act()).rejects.toThrow('does not match');
    });

    it('should handle multiple has and belongs to many', async () => {
      class StaffTable extends BaseTable {
        readonly table = 'user_staff';

        columns = this.setColumns((t) => ({
          iD: t.identity().primaryKey(),
        }));

        relations = {
          roles: this.hasAndBelongsToMany(() => RoleTable, {
            columns: ['iD'],
            references: ['staffId'],
            through: {
              table: 'user_staff_to_role',
              columns: ['roleId'],
              references: ['iD'],
            },
          }),
        };
      }

      class RoleTable extends BaseTable {
        readonly table = 'user_staff_role';

        columns = this.setColumns((t) => ({
          iD: t.identity().primaryKey(),
        }));

        relations = {
          staffs: this.hasAndBelongsToMany(() => StaffTable, {
            columns: ['iD'],
            references: ['roleId'],
            through: {
              table: 'user_staff_to_role',
              columns: ['staffId'],
              references: ['iD'],
            },
          }),

          permissions: this.hasAndBelongsToMany(() => PermissionTable, {
            columns: ['iD'],
            references: ['roleId'],
            through: {
              table: 'user_role_to_perm',
              columns: ['permId'],
              references: ['iD'],
            },
          }),
        };
      }

      class PermissionTable extends BaseTable {
        readonly table = 'user_staff_perm';

        columns = this.setColumns((t) => ({
          iD: t.identity().primaryKey(),
        }));

        relations = {
          roles: this.hasAndBelongsToMany(() => RoleTable, {
            columns: ['iD'],
            references: ['permId'],
            through: {
              table: 'user_role_to_perm',
              columns: ['roleId'],
              references: ['iD'],
            },
          }),
        };
      }

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
        table((t) => ({
          point: t.geography.point().primaryKey(),
        })),
      ],
    });

    await act();

    assert.report(`${green('+ create extension')} postgis
${green('+ create table')} table (1 column)`);
  });

  it('should auto generate foreign keys when using autoForeignKeys', async () => {
    class One extends BaseTable {
      autoForeignKeys = { onDelete: 'CASCADE' };
      table = 'one';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        twoId: t.integer(),
      }));

      relations = {
        two: this.belongsTo(() => Two, {
          columns: ['twoId'],
          references: ['id'],
        }),
      };
    }

    class Two extends BaseTable {
      table = 'two';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }

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
