import {
  defineTable,
  defineView,
  sql,
  useGeneratorsTestUtils,
} from './generators.test-utils';
import { colors } from 'pqb/internal';

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

describe('materialized views', () => {
  const { arrange, act, assert } = useGeneratorsTestUtils();

  const SourceTable = defineTable(
    'source',
    { noPrimaryKey: false, nameInDb: 'source' },
    (t) => ({
      id: t.identity().primaryKey(),
      active: t.boolean(),
    }),
  );

  const createSourceTable = async (
    db: Parameters<NonNullable<Parameters<typeof arrange>[0]['prepareDb']>>[0],
  ) => {
    await db.createTable('source', (t) => ({
      id: t.identity().primaryKey(),
      active: t.boolean(),
    }));
  };

  const ActiveMaterializedView = defineView(
    'active_materialized_view',
    {
      materialized: true,
      withData: false,
      sql: sql`SELECT id, active FROM "source" WHERE active = true`,
    },
    (t) => ({
      id: t.integer(),
      active: t.boolean(),
    }),
  );

  it('should create materialized view', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [ActiveMaterializedView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createMaterializedView('active_materialized_view', {
    columns: ['id', 'active'],
    withData: false,
  }, \`SELECT id, active FROM "source" WHERE active = true\`);
});
`);

    assert.report(
      `${green('+ create materialized view')} active_materialized_view`,
    );
  });

  it('should match code materialized view aliases by their database names', async () => {
    const MonthlySaleView = defineView(
      'MonthlySale',
      { materialized: true, sql: sql`SELECT id FROM "source"` },
      (t) => ({
        id: t.integer(),
      }),
    );

    const ExplicitSaleView = defineView(
      'ExplicitSale',
      {
        materialized: true,
        nameInDb: 'sales_by_month',
        sql: sql`SELECT id FROM "source"`,
      },
      (t) => ({
        id: t.integer(),
      }),
    );

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createMaterializedView(
          'monthly_sale',
          { columns: ['id'] },
          'SELECT id FROM "source"',
        );
        await db.createMaterializedView(
          'sales_by_month',
          { columns: ['id'] },
          'SELECT id FROM "source"',
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [MonthlySaleView, ExplicitSaleView],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should create materialized view with query assigned in init', async () => {
    const InitQueryMaterializedView = defineView(
      'init_query_materialized_view',
      { materialized: true },
      (t) => ({
        id: t.integer(),
        active: t.boolean(),
      }),
    ).query(
      (db) =>
        db.table0.select('id', 'active').whereSql`"source"."active" = true`,
    );

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
      views: [InitQueryMaterializedView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createMaterializedView('init_query_materialized_view', {
    columns: ['id', 'active'],
  }, \`SELECT "source"."id", "source"."active" FROM "source" WHERE ("source"."active" = true)\`);
});
`);

    assert.report(
      `${green('+ create materialized view')} init_query_materialized_view`,
    );
  });

  it('should drop materialized view', async () => {
    const IgnoredOptInView = defineView(
      'ignored_opt_in_materialized_view',
      { materialized: true, sql: sql`SELECT id FROM "source"` },
      (t) => ({
        id: t.integer(),
      }),
    );

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createMaterializedView(
          'dropped_materialized_view',
          {
            columns: ['id', 'active'],
            withData: false,
          },
          `SELECT id, active FROM "source" WHERE active = true`,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
          views: ['ignored_opt_in_materialized_view'],
        },
      },
      views: [IgnoredOptInView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropMaterializedView('dropped_materialized_view', {
    columns: ['id', 'active'],
    withData: false,
  }, \` SELECT id,
    active
   FROM source
  WHERE (active = true);\`);
});
`);

    assert.report(
      `${red('- drop materialized view')} dropped_materialized_view`,
    );
  });

  it('should alter materialized view sql and withData', async () => {
    const ChangedMaterializedView = defineView(
      'changed_materialized_view',
      {
        materialized: true,
        schema: 'custom',
        withData: true,
        sql: sql`SELECT id, active FROM "custom"."source" WHERE active = true`,
      },
      (t) => ({
        id: t.integer(),
        active: t.boolean(),
      }),
    );

    await arrange({
      async prepareDb(db) {
        await db.createSchema('custom');
        await db.createTable('custom.source', (t) => ({
          id: t.integer().primaryKey(),
          active: t.boolean(),
        }));
        await db.createMaterializedView(
          'custom.changed_materialized_view',
          {
            columns: ['id'],
            withData: false,
          },
          `SELECT id FROM "custom"."source"`,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['custom.source'],
        },
      },
      views: [ChangedMaterializedView],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropMaterializedView('custom.changed_materialized_view', {
    columns: ['id'],
    withData: false,
  }, \` SELECT id
   FROM custom.source;\`);
});

change(async (db) => {
  await db.createMaterializedView('custom.changed_materialized_view', {
    columns: ['id', 'active'],
    withData: true,
  }, \`SELECT id, active FROM "custom"."source" WHERE active = true\`);
});
`);

    assert.report(
      `${red('- drop materialized view')} custom.changed_materialized_view`,
      `${green('+ create materialized view')} custom.changed_materialized_view`,
    );
  });

  it('should not generate migration if no materialized view property changed', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createMaterializedView(
          'active_materialized_view',
          {
            columns: ['id', 'active'],
            withData: false,
          },
          `SELECT id, active FROM "source" WHERE active = true`,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [ActiveMaterializedView],
    });

    await act();

    assert.migration();

    assert.report('No changes were detected');
  });

  it('should ignore definition-side generator ignored materialized views', async () => {
    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createMaterializedView(
          'changed_ignored_materialized_view',
          { columns: ['id'], withData: false },
          `SELECT id FROM "source"`,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
        },
      },
      views: [
        defineView(
          'changed_ignored_materialized_view',
          {
            materialized: true,
            generatorIgnore: true,
            withData: true,
            sql: sql`SELECT id, active FROM "source" WHERE active = true`,
          },
          (t) => ({
            id: t.integer(),
            active: t.boolean(),
          }),
        ),
      ],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should ignore materialized views using generatorIgnore.views names', async () => {
    const IgnoredCodeMaterializedView = defineView(
      'ignored_code_materialized_view',
      { materialized: true, sql: sql`SELECT id FROM "source"` },
      (t) => ({
        id: t.integer(),
      }),
    );

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createMaterializedView(
          'ignored_db_materialized_view',
          { columns: ['id'] },
          `SELECT id FROM "source"`,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
          views: [
            'ignored_code_materialized_view',
            'ignored_db_materialized_view',
          ],
        },
      },
      views: [IgnoredCodeMaterializedView],
    });

    await act();

    assert.migration();

    assert.report('No changes were detected');
  });

  it('should ignore materialized views using generatorIgnore.views regular expressions', async () => {
    const ExternalCodeMaterializedView = defineView(
      'external_code_materialized_view',
      { materialized: true, sql: sql`SELECT id FROM "source"` },
      (t) => ({
        id: t.integer(),
      }),
    );

    await arrange({
      async prepareDb(db) {
        await createSourceTable(db);
        await db.createMaterializedView(
          'external_db_materialized_view',
          { columns: ['id'] },
          `SELECT id FROM "source"`,
        );
      },
      dbOptions: {
        generatorIgnore: {
          tables: ['source'],
          views: [/^external_/],
        },
      },
      views: [ExternalCodeMaterializedView],
    });

    await act();

    assert.migration();

    assert.report('No changes were detected');
  });

  it('should ignore materialized views using generatorIgnore.schemas', async () => {
    const IgnoredSchemaMaterializedView = defineView(
      'ignored_schema_materialized_view',
      {
        materialized: true,
        schema: 'ignored_schema',
        sql: sql`SELECT id FROM "ignored_schema"."source"`,
      },
      (t) => ({
        id: t.integer(),
      }),
    );

    await arrange({
      async prepareDb(db) {
        await db.createSchema('ignored_schema');
        await db.createTable('ignored_schema.source', (t) => ({
          id: t.identity().primaryKey(),
        }));
        await db.createMaterializedView(
          'ignored_schema.ignored_db_materialized_view',
          { columns: ['id'] },
          `SELECT id FROM "ignored_schema"."source"`,
        );
      },
      dbOptions: {
        generatorIgnore: {
          schemas: ['ignored_schema'],
        },
      },
      views: [IgnoredSchemaMaterializedView],
    });

    await act();

    assert.migration();

    assert.report('No changes were detected');
  });
});
