import { useGeneratorsTestUtils } from './generators.test-utils';
import { colors, type RlsPolicy } from 'pqb/internal';
import { defineRls } from '../../../orm';

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

describe('rls', () => {
  const { arrange, act, assert, BaseTable } = useGeneratorsTestUtils();
  type MigrationDb = Parameters<
    NonNullable<Parameters<typeof arrange>[0]['prepareDb']>
  >[0];

  const permit = () =>
    [
      {
        name: 'table_select_policy',
        for: 'SELECT' as const,
        to: 'public',
        using: BaseTable.sql`id > 0`,
      },
    ] satisfies [RlsPolicy.Policy, ...RlsPolicy.Policy[]];

  const createTable = async (db: MigrationDb) => {
    await db.createTable('table', (t) => ({
      id: t.identity().primaryKey(),
    }));
  };

  const createSelectPolicy = async (db: MigrationDb) => {
    await db.createPolicy('table', 'table_select_policy', {
      as: 'PERMISSIVE',
      for: 'SELECT',
      using: db.sql`id > 0`,
    });
  };

  const createTableWithSelectPolicy = async (db: MigrationDb) => {
    await createTable(db);
    await createSelectPolicy(db);
  };

  it('should enable and force rls when table rls is declared as enabled and force is omitted', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            enable: true,
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.enableRls('table');

  await db.forceRls('table');
});
`);

    assert.report(
      `${green('+ enable rls')} table`,
      `${green('+ force rls')} table`,
    );
  });

  it('should disable rls when it is enabled in db and omitted in table rls declaration', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
        await db.enableRls('table');
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.disableRls('table');
});
`);

    assert.report(`${red('- enable rls')} table`);
  });

  it('should force rls when table rls is declared as forced', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: true,
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.forceRls('table');
});
`);

    assert.report(`${green('+ force rls')} table`);
  });

  it('should no-force rls when it is forced in db and explicitly false in table rls declaration', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
        await db.forceRls('table');
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.noForceRls('table');
});
`);

    assert.report(`${red('- force rls')} table`);
  });

  it('should keep forced rls when force is omitted in table rls declaration', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
        await db.forceRls('table');
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should not force rls when project table rls default is false', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
      },
      dbOptions: {
        rls: {
          tableRlsDefaults: {
            force: false,
          },
        },
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should create policies before enabling and forcing rls', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            enable: true,
            force: true,
            permit: [
              {
                name: 'table_select_policy',
                for: 'SELECT',
                to: 'public',
                using: BaseTable.sql`id > 0`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createPolicy('table', 'table_select_policy', {
    as: 'PERMISSIVE',
    for: 'SELECT',
    to: ['public'],
    using: db.sql\`id > 0\`,
  });

  await db.enableRls('table');

  await db.forceRls('table');
});
`);

    assert.report(
      `${green('+ create policy')} table_select_policy: permit access on table, to public, for select, using (id > 0)`,
      `${green('+ enable rls')} table`,
      `${green('+ force rls')} table`,
    );
  });

  it('should disable rls before dropping policies', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
        await db.createPolicy('table', 'table_restrict_policy', {
          as: 'RESTRICTIVE',
          for: 'UPDATE',
          using: db.sql`id > 0`,
          withCheck: db.sql`id > 0`,
        });
        await db.enableRls('table');
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.disableRls('table');

  await db.dropPolicy('table', 'table_restrict_policy', {
    as: 'RESTRICTIVE',
    for: 'UPDATE',
    to: ['public'],
    using: db.sql\`(id > 0)\`,
    withCheck: db.sql\`(id > 0)\`,
  });
});
`);

    assert.report(
      `${red('- enable rls')} table`,
      `${red('- drop policy')} table_restrict_policy: restrict access on table, to public, for update, using ((id > 0)), with check ((id > 0))`,
    );
  });

  it('should ignore table rls diff for rls-specific ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.enableRls('table');
      },
      dbOptions: {
        generatorIgnore: {
          rls: {
            tables: ['table'],
          },
        } as never,
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            permit: permit(),
          });
        },
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should ignore named policies from rls-specific policy ignore config', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.createPolicy('table', 'managed_policy', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          using: db.sql`id > 0`,
        });
        await db.createPolicy('table', 'ignored_policy', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          using: db.sql`id > 0`,
        });
      },
      dbOptions: {
        generatorIgnore: {
          rls: {
            policies: [{ table: 'table', names: ['ignored_policy'] }],
          },
        } as never,
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: [
              {
                name: 'managed_policy',
                for: 'SELECT',
                to: 'public',
                using: BaseTable.sql`id > 0`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should add a restrict policy', async () => {
    await arrange({
      async prepareDb(db) {
        await createTableWithSelectPolicy(db);
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: permit(),
            restrict: [
              {
                name: 'table_restrict_policy',
                for: 'UPDATE',
                to: 'public',
                using: BaseTable.sql`id > 0`,
                withCheck: BaseTable.sql`id > 0`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createPolicy('table', 'table_restrict_policy', {
    as: 'RESTRICTIVE',
    for: 'UPDATE',
    to: ['public'],
    using: db.sql\`id > 0\`,
    withCheck: db.sql\`id > 0\`,
  });
});
`);

    assert.report(
      `${green('+ create policy')} table_restrict_policy: restrict access on table, to public, for update, using (id > 0), with check (id > 0)`,
    );
  });

  it('should add permit and restrict policies in the same migration', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: [
              {
                name: 'table_permit_policy',
                for: 'SELECT',
                to: 'public',
                using: BaseTable.sql`id > 0`,
              },
            ],
            restrict: [
              {
                name: 'table_restrict_policy',
                for: 'UPDATE',
                to: 'public',
                using: BaseTable.sql`id > 0`,
                withCheck: BaseTable.sql`id > 0`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createPolicy('table', 'table_permit_policy', {
    as: 'PERMISSIVE',
    for: 'SELECT',
    to: ['public'],
    using: db.sql\`id > 0\`,
  });

  await db.createPolicy('table', 'table_restrict_policy', {
    as: 'RESTRICTIVE',
    for: 'UPDATE',
    to: ['public'],
    using: db.sql\`id > 0\`,
    withCheck: db.sql\`id > 0\`,
  });
});
`);

    assert.report(
      `${green('+ create policy')} table_permit_policy: permit access on table, to public, for select, using (id > 0)`,
      `${green('+ create policy')} table_restrict_policy: restrict access on table, to public, for update, using (id > 0), with check (id > 0)`,
    );
  });

  it('should drop permit and restrict policies when they are in db and not in table', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.createPolicy('table', 'table_permit_policy', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          using: db.sql`id > 0`,
        });
        await db.createPolicy('table', 'table_restrict_policy', {
          as: 'RESTRICTIVE',
          for: 'UPDATE',
          to: 'postgres',
          using: db.sql`id > 0`,
          withCheck: db.sql`id > 0`,
        });
        await db.createPolicy('table', 'table_select_policy', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          using: db.sql`id > 0`,
        });
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: permit(),
            restrict: [],
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropPolicy('table', 'table_permit_policy', {
    as: 'PERMISSIVE',
    for: 'SELECT',
    to: ['public'],
    using: db.sql\`(id > 0)\`,
  });

  await db.dropPolicy('table', 'table_restrict_policy', {
    as: 'RESTRICTIVE',
    for: 'UPDATE',
    to: ['postgres'],
    using: db.sql\`(id > 0)\`,
    withCheck: db.sql\`(id > 0)\`,
  });
});
`);

    assert.report(
      `${red('- drop policy')} table_permit_policy: permit access on table, to public, for select, using ((id > 0))`,
      `${red('- drop policy')} table_restrict_policy: restrict access on table, to postgres, for update, using ((id > 0)), with check ((id > 0))`,
    );
  });

  it('should produce no migration when permit and restrict policies match', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.createPolicy('table', 'table_permit_policy', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          using: db.sql`id > 0`,
        });
        await db.createPolicy('table', 'table_restrict_policy', {
          as: 'RESTRICTIVE',
          for: 'UPDATE',
          to: 'postgres',
          using: db.sql`id > 0`,
          withCheck: db.sql`id > 0`,
        });
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: [
              {
                name: 'table_permit_policy',
                for: 'SELECT',
                to: 'public',
                using: BaseTable.sql`id > 0`,
              },
            ],
            restrict: [
              {
                name: 'table_restrict_policy',
                for: 'UPDATE',
                to: 'postgres',
                using: BaseTable.sql`id > 0`,
                withCheck: BaseTable.sql`id > 0`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should change all fields supported by ALTER POLICY', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.createRole('role_a');
        await db.createRole('role_b');
        await db.createPolicy('table', 'table_policy_from', {
          as: 'PERMISSIVE',
          for: 'UPDATE',
          to: 'role_a',
          using: db.sql`id > 0`,
          withCheck: db.sql`id > 0`,
        });
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: [
              {
                name: 'table_policy_to',
                for: 'UPDATE',
                to: ['role_a', 'role_b'],
                using: BaseTable.sql`id > 1`,
                withCheck: BaseTable.sql`id > 1`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changePolicy('table', 'table_policy_from', {
    from: {
      name: 'table_policy_from',
      to: ['role_a'],
      using: db.sql\`(id > 0)\`,
      withCheck: db.sql\`(id > 0)\`,
    },
    to: {
      name: 'table_policy_to',
      to: ['role_a', 'role_b'],
      using: db.sql\`id > 1\`,
      withCheck: db.sql\`id > 1\`,
    },
  });
});
`);

    assert.report(`${yellow('~ rename policy')} table_policy_from ${yellow(
      '=>',
    )} table_policy_to on table:
  ${yellow('from')}: name table_policy_from, to role_a, using ((id > 0)), with check ((id > 0))
  ${yellow('to')}: name table_policy_to, to role_a, role_b, using (id > 1), with check (id > 1)`);
  });

  it('should change all policy options except the name', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.createRole('role_a');
        await db.createRole('role_b');
        await db.createPolicy('table', 'table_policy', {
          as: 'PERMISSIVE',
          for: 'UPDATE',
          to: 'role_a',
          using: db.sql`id > 0`,
          withCheck: db.sql`id > 0`,
        });
        await db.createPolicy('table', 'table_select_policy', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          using: db.sql`id > 0`,
        });
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: permit(),
            restrict: [
              {
                name: 'table_policy',
                for: 'INSERT',
                to: ['role_a', 'role_b'],
                withCheck: BaseTable.sql`id > 1`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changePolicy('table', 'table_policy', {
    from: {
      as: 'PERMISSIVE',
      for: 'UPDATE',
      to: ['role_a'],
      using: db.sql\`(id > 0)\`,
      withCheck: db.sql\`(id > 0)\`,
    },
    to: {
      as: 'RESTRICTIVE',
      for: 'INSERT',
      to: ['role_a', 'role_b'],
      withCheck: db.sql\`id > 1\`,
    },
  });
});
`);

    assert.report(`${yellow('~ change policy')} table_policy on table:
  ${yellow('from')}: as permissive, for update, to role_a, using ((id > 0)), with check ((id > 0))
  ${yellow('to')}: as restrictive, for insert, to role_a, role_b, with check (id > 1)`);
  });

  it('should not generate policy change when using expression did not change', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.createPolicy('table', 'table_policy', {
          as: 'PERMISSIVE',
          for: 'UPDATE',
          to: 'postgres',
          using: db.sql`id > 0`,
          withCheck: db.sql`id > 0`,
        });
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: [
              {
                name: 'table_policy',
                for: 'UPDATE',
                to: 'postgres',
                using: BaseTable.sql`id>0`,
                withCheck: BaseTable.sql`id>0`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should generate policy change when using expression changed', async () => {
    await arrange({
      async prepareDb(db) {
        await createTable(db);
        await db.createPolicy('table', 'table_policy', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          to: 'postgres',
          using: db.sql`id > 0`,
        });
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: false,
            permit: [
              {
                name: 'table_policy',
                for: 'SELECT',
                to: 'postgres',
                using: BaseTable.sql`id > 1`,
              },
            ],
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changePolicy('table', 'table_policy', {
    from: {
      using: db.sql\`(id > 0)\`,
    },
    to: {
      using: db.sql\`id > 1\`,
    },
  });
});
`);

    assert.report(`${yellow('~ change policy')} table_policy on table:
  ${yellow('from')}: using ((id > 0))
  ${yellow('to')}: using (id > 1)`);
  });
});
