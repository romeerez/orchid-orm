import { useGeneratorsTestUtils } from './generators.test-utils';
import { setGrants } from '../../../orm';
import { colors } from 'pqb/internal';
import { Query } from 'pqb';

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

const { green, red } = colors;

describe('views', () => {
  const { arrange, act, assert, BaseTable } = useGeneratorsTestUtils();

  class SourceTable extends BaseTable {
    table = 'source';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      active: t.boolean(),
    }));
  }

  const createSourceTable = async (
    db: Parameters<NonNullable<Parameters<typeof arrange>[0]['prepareDb']>>[0],
  ) => {
    await db.createTable('source', (t) => ({
      id: t.identity().primaryKey(),
      active: t.boolean(),
    }));
  };

  class ActiveView extends BaseTable.View {
    name = 'active_view';
    checkOption = 'CASCADED' as const;
    securityBarrier = true;
    securityInvoker = false;
    columns = this.setColumns((t) => ({
      id: t.integer(),
      active: t.boolean(),
    }));
    sql = BaseTable.sql`SELECT id, active FROM "source" WHERE active = true`;
  }

  class RecursiveView extends BaseTable.View {
    name = 'recursive_view';
    recursive = true;
    columns = this.setColumns((t) => ({
      id: t.integer(),
    }));
    sql = BaseTable.sql`
      WITH RECURSIVE nums(id) AS (
        VALUES (1)
        UNION ALL
        SELECT id + 1 FROM nums WHERE id < 2
      )
      SELECT id FROM nums
    `;
  }

  class GrantView extends BaseTable.View {
    name = 'grant_view';
    columns = this.setColumns((t) => ({
      id: t.integer(),
    }));
    sql = BaseTable.sql`SELECT id FROM "source"`;
    grants = setGrants([
      {
        to: 'app-user',
        privileges: ['SELECT'],
      },
    ]);
  }

  it('should create view', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [ActiveView, RecursiveView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createView('active_view', {
    columns: ['id', 'active'],
    checkOption: 'CASCADED',
    securityBarrier: true,
    securityInvoker: false,
  }, \`SELECT id, active FROM "source" WHERE active = true\`);

  await db.createView('recursive_view', {
    recursive: true,
    columns: ['id'],
    securityInvoker: true,
  }, \`
      WITH RECURSIVE nums(id) AS (
        VALUES (1)
        UNION ALL
        SELECT id + 1 FROM nums WHERE id < 2
      )
      SELECT id FROM nums
    \`);
});
`);

    assert.report(
      `${green('+ create view')} active_view`,
      `${green('+ create view')} recursive_view`,
    );
  });

  it('should match code view aliases by their database names', async () => {
    class ActiveAliasView extends BaseTable.View {
      name = 'ActiveAlias';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
      sql = BaseTable.sql`SELECT id FROM "source"`;
    }

    class ExplicitAliasView extends BaseTable.View {
      name = 'ExplicitAlias';
      nameInDb = 'explicit_view';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
      sql = BaseTable.sql`SELECT id FROM "source"`;
    }

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('active_alias', 'SELECT id FROM "source"');
        await db.createView('explicit_view', 'SELECT id FROM "source"');
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [ActiveAliasView, ExplicitAliasView],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should create view with query assigned in init', async () => {
    class InitQueryView extends BaseTable.View {
      name = 'init_query_view';
      columns = this.setColumns((t) => ({
        id: t.integer(),
        active: t.boolean(),
      }));

      init(db: { SourceTable: Query }) {
        this.query = db.SourceTable.select('id', 'active')
          .whereSql`"source"."active" = true`;
      }
    }

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      tables: [SourceTable],
      views: [InitQueryView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createView('init_query_view', {
    columns: ['id', 'active'],
    securityInvoker: true,
  }, \`SELECT "source"."id", "source"."active" FROM "source" WHERE ("source"."active" = true)\`);
});
`);

    assert.report(`${green('+ create view')} init_query_view`);
  });

  it('should require sql or query unless view is ignored', async () => {
    class MissingDefinitionView extends BaseTable.View {
      name = 'missing_definition_view';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
    }

    await arrange({
      views: [MissingDefinitionView],
    });

    await expect(act()).rejects.toThrow(
      'Either sql or query is required for view missing_definition_view',
    );
  });

  it('should allow ignored view without sql or query', async () => {
    class IgnoredMissingDefinitionView extends BaseTable.View {
      name = 'ignored_missing_definition_view';
      readonly generatorIgnore = true;
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
    }

    await arrange({
      views: [IgnoredMissingDefinitionView],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should drop view', async () => {
    class IgnoredOptInView extends BaseTable.View {
      name = 'ignored_opt_in_view';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
      sql = BaseTable.sql`SELECT id FROM "source"`;
    }

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView(
          'dropped_view',
          {
            columns: ['id', 'active'],
            checkOption: 'CASCADED',
            securityBarrier: true,
            securityInvoker: false,
          },
          `SELECT id, active FROM "source" WHERE active = true`,
        );
        await db.createView(
          'dropped_recursive_view',
          { recursive: true, columns: ['id'], securityInvoker: true },
          `
            WITH RECURSIVE nums(id) AS (
              VALUES (1)
              UNION ALL
              SELECT id + 1 FROM nums WHERE id < 2
            )
            SELECT id FROM nums
          `,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
          views: ['ignored_opt_in_view'],
        },
      },
      views: [IgnoredOptInView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropView('dropped_recursive_view', {
    recursive: true,
    columns: ['id'],
    securityInvoker: true,
  }, \` WITH RECURSIVE dropped_recursive_view(id) AS (
         WITH RECURSIVE nums(id) AS (
                 VALUES (1)
                UNION ALL
                 SELECT (nums_1.id + 1)
                   FROM nums nums_1
                  WHERE (nums_1.id < 2)
                )
         SELECT nums.id
           FROM nums
        )
 SELECT id
   FROM dropped_recursive_view;\`);

  await db.dropView('dropped_view', {
    columns: ['id', 'active'],
    checkOption: 'CASCADED',
    securityBarrier: true,
  }, \` SELECT id,
    active
   FROM source
  WHERE (active = true);\`);
});
`);

    assert.report(
      `${red('- drop view')} dropped_recursive_view`,
      `${red('- drop view')} dropped_view`,
    );
  });

  it('should alter all view properties', async () => {
    class ChangedView extends BaseTable.View {
      schema = 'custom';
      name = 'changed_view';
      checkOption = 'CASCADED' as const;
      securityBarrier = true;
      securityInvoker = false;
      columns = this.setColumns((t) => ({
        id: t.integer(),
        active: t.boolean(),
      }));
      sql = BaseTable.sql`SELECT id, active FROM "custom"."source" WHERE active = true`;
    }

    class RecursiveView extends BaseTable.View {
      schema = 'custom';
      name = 'recursive_view';
      recursive = true;
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
      sql = BaseTable.sql`
        WITH RECURSIVE nums(id) AS (
          VALUES (1)
          UNION ALL
          SELECT id + 1 FROM nums WHERE id < 2
        )
        SELECT id FROM nums
      `;
    }

    await arrange({
      async prepareDb(db) {
        await db.createSchema('custom');
        await db.createTable('custom.source', (t) => ({
          id: t.integer().primaryKey(),
          active: t.boolean(),
        }));
        await db.createView(
          'custom.changed_view',
          {
            columns: ['id'],
            checkOption: 'LOCAL',
            securityBarrier: false,
            securityInvoker: true,
          },
          `SELECT id FROM "custom"."source"`,
        );
        await db.createView('custom.recursive_view', `SELECT 1 AS id`);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['custom.source'],
        },
      },
      views: [ChangedView, RecursiveView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropView('custom.changed_view', {
    columns: ['id'],
    checkOption: 'LOCAL',
    securityInvoker: true,
  }, \` SELECT id
   FROM custom.source;\`);

  await db.dropView('custom.recursive_view', {
    columns: ['id'],
    securityInvoker: true,
  }, \` SELECT 1 AS id;\`);
});

change(async (db) => {
  await db.createView('custom.changed_view', {
    columns: ['id', 'active'],
    checkOption: 'CASCADED',
    securityBarrier: true,
    securityInvoker: false,
  }, \`SELECT id, active FROM "custom"."source" WHERE active = true\`);

  await db.createView('custom.recursive_view', {
    recursive: true,
    columns: ['id'],
    securityInvoker: true,
  }, \`
        WITH RECURSIVE nums(id) AS (
          VALUES (1)
          UNION ALL
          SELECT id + 1 FROM nums WHERE id < 2
        )
        SELECT id FROM nums
      \`);
});
`);

    assert.report(
      `${red('- drop view')} custom.changed_view`,
      `${green('+ create view')} custom.changed_view`,
      `${red('- drop view')} custom.recursive_view`,
      `${green('+ create view')} custom.recursive_view`,
    );
  });

  it('should not generate migration if no view property changed', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView(
          'active_view',
          {
            columns: ['id', 'active'],
            checkOption: 'CASCADED',
            securityBarrier: true,
            securityInvoker: false,
          },
          `SELECT id, active FROM "source" WHERE active = true`,
        );
        await db.createView(
          'recursive_view',
          { recursive: true, columns: ['id'], securityInvoker: true },
          `
            WITH RECURSIVE nums(id) AS (
              VALUES (1)
              UNION ALL
              SELECT id + 1 FROM nums WHERE id < 2
            )
            SELECT id FROM nums
          `,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [ActiveView, RecursiveView],
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should ignore definition-side generator ignored views', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('changed_ignored_view', `SELECT id FROM "source"`);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [
        class ChangedIgnoredView extends BaseTable.View {
          name = 'changed_ignored_view';
          readonly generatorIgnore = true;
          columns = this.setColumns((t) => ({
            id: t.integer(),
            active: t.boolean(),
          }));
          sql = BaseTable.sql`SELECT id, active FROM "source" WHERE active = true`;
        },
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should preserve grants for definition-side generator ignored views', async () => {
    class IgnoredGrantView extends GrantView {
      readonly generatorIgnore = true;
    }

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('grant_view', `SELECT id FROM "source"`);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [IgnoredGrantView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    tables: ['grant_view'],
    privileges: ['SELECT'],
  });
});
`);

    assert.report(
      `${green('+ grant privileges')} SELECT on tables grant_view to app-user`,
    );
  });

  it('should generate grants from view-local metadata', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('grant_view', `SELECT id FROM "source"`);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [GrantView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    tables: ['grant_view'],
    privileges: ['SELECT'],
  });
});
`);

    assert.report(
      `${green('+ grant privileges')} SELECT on tables grant_view to app-user`,
    );
  });

  it('should not generate migration if view-local grants match db', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('grant_view', `SELECT id FROM "source"`);
        await db.grant({
          to: 'app-user',
          tables: ['grant_view'],
          privileges: ['SELECT'],
        });
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [GrantView],
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should revoke view grants missing from view-local metadata', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('grant_view', `SELECT id FROM "source"`);
        await db.grant({
          to: 'app-user',
          tables: ['grant_view'],
          privileges: ['SELECT', 'UPDATE'],
        });
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [GrantView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.revoke({
    to: ['app-user'],
    tables: ['grant_view'],
    privileges: ['UPDATE'],
  });
});
`);

    assert.report(
      `${red('- revoke privileges')} UPDATE on tables grant_view from app-user`,
    );
  });

  it('should change view grants from view-local metadata', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('grant_view', `SELECT id FROM "source"`);
        await db.grant({
          to: 'app-user',
          tables: ['grant_view'],
          privileges: ['INSERT'],
        });
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [GrantView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    tables: ['grant_view'],
    privileges: ['SELECT'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_view'],
    privileges: ['INSERT'],
  });
});
`);

    assert.report(
      `${green('+ grant privileges')} SELECT on tables grant_view to app-user`,
      `${red('- revoke privileges')} INSERT on tables grant_view from app-user`,
    );
  });

  it('should recreate view when its old table is dropped and new table is created', async () => {
    class NewSourceTable extends BaseTable {
      table = 'new_source';
      columns = this.setColumns((t) => ({
        id: t.integer().primaryKey(),
        active: t.boolean(),
      }));
    }

    class ChangedSourceView extends BaseTable.View {
      name = 'changed_source_view';
      columns = this.setColumns((t) => ({
        id: t.integer(),
        active: t.boolean(),
      }));
      sql = BaseTable.sql`SELECT id, active FROM "new_source" WHERE active = true`;
    }

    await arrange({
      async prepareDb(db) {
        await db.createTable('old_source', (t) => ({
          id: t.integer().primaryKey(),
          active: t.boolean(),
        }));
        await db.createView(
          'changed_source_view',
          { columns: ['id', 'active'] },
          `SELECT id, active FROM "old_source" WHERE active = true`,
        );
      },
      tables: [NewSourceTable],
      views: [ChangedSourceView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable('new_source', (t) => ({
    id: t.integer().primaryKey(),
    active: t.boolean(),
  }));

  await db.dropView('changed_source_view', {
    columns: ['id', 'active'],
    securityInvoker: true,
  }, \` SELECT id,
    active
   FROM old_source
  WHERE (active = true);\`);
});

change(async (db) => {
  await db.dropTable('old_source', (t) => ({
    id: t.integer().primaryKey(),
    active: t.boolean(),
  }));

  await db.createView('changed_source_view', {
    columns: ['id', 'active'],
    securityInvoker: true,
  }, \`SELECT id, active FROM "new_source" WHERE active = true\`);
});
`);

    assert.report(
      `${green('+ create table')} new_source (2 columns)`,
      `${red('- drop table')} old_source (2 columns)`,
      `${red('- drop view')} changed_source_view`,
      `${green('+ create view')} changed_source_view`,
    );
  });

  it('should ignore views existing in db with generatorIgnore', async () => {
    class KeptView extends BaseTable.View {
      name = 'kept_view';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
      sql = BaseTable.sql`SELECT id FROM "source"`;
    }

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createView('kept_view', `SELECT id FROM "source"`);
        await db.createView('legacy_view', `SELECT id FROM "source"`);
        await db.createView('external_view', `SELECT id FROM "source"`);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
          views: ['legacy_view', /^external_/],
        },
      },
      views: [KeptView],
    });

    await act();

    assert.report('No changes were detected');
  });
});
