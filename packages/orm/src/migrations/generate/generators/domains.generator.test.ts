import { useGeneratorsTestUtils } from './generators.test-utils';
import { colors } from 'pqb';

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

describe('domains', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  it('should not be dropped when ignored', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');
        await db.createDomain('schema.domain', (t) => t.text());
        await db.createDomain('publicDomain', (t) => t.integer());
      },
      dbOptions: {
        generatorIgnore: {
          schemas: ['schema'],
          domains: ['publicDomain'],
        },
      },
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should create a domain', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');
      },
      dbOptions: {
        domains: {
          'schema.domain': (t) =>
            t
              .text()
              .nullable()
              .collate('C')
              .default(t.sql`'default'`)
              .check(t.sql`value = 'x'`),
        },
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createDomain('schema.domain', (t) => t.text().nullable().default(t.sql\`'default'\`).check(t.sql\`value = 'x'\`).collate('C'));
});
`);

    assert.report(`${green('+ create domain')} schema.domain`);
  });

  it('should drop a domain', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createTable('schema.table', { noPrimaryKey: true });

        await db.createDomain('schema.domain', (t) =>
          t
            .text()
            .nullable()
            .collate('C')
            .default(t.sql`('a'::text || 'b'::text)`)
            .check(t.sql`(VALUE = 'ab'::text)`),
        );
      },
      tables: [table(undefined, undefined, { schema: 'schema' })],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropDomain('schema.domain', (t) => t.text().nullable().default(t.sql\`('a'::text || 'b'::text)\`).check(t.sql\`(VALUE = 'ab'::text)\`).collate('C'));
});
`);

    assert.report(`${red('- drop domain')} schema.domain`);
  });

  it('should not recreate a domain when it is not changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createDomain('schema.domain', (t) =>
          t
            .text()
            .nullable()
            .collate('C')
            .default(t.sql`'a'||'b'`)
            .check(t.sql`value = 'ab'`),
        );
      },
      dbOptions: {
        domains: {
          'schema.domain': (t) =>
            t
              .text()
              .nullable()
              .collate('C')
              .default(t.sql`'a'||'b'`)
              .check(t.sql`value = 'ab'`),
        },
      },
    });

    await act();

    assert.migration();
  });

  it('should recreate a domain when value was changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createDomain('schema.domain', (t) =>
          t.text().nullable().collate('C'),
        );
      },
      dbOptions: {
        domains: {
          'schema.domain': (t) => t.text().collate('C'),
        },
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropDomain('schema.domain', (t) => t.text().nullable().collate('C'));
});

change(async (db) => {
  await db.createDomain('schema.domain', (t) => t.text().collate('C'));
});
`);

    assert.report(`${red('- drop domain')} schema.domain
${green('+ create domain')} schema.domain`);
  });

  it('should recreate a domain when sql value was changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createDomain('schema.domain', (t) =>
          t
            .text()
            .nullable()
            .collate('C')
            .default(t.sql`'a'||'b'`)
            .check(t.sql`value = 'ab'`),
        );
      },
      dbOptions: {
        domains: {
          'schema.domain': (t) =>
            t
              .text()
              .nullable()
              .collate('C')
              .default(t.sql`'a'||'c'`)
              .check(t.sql`value = 'ab'`),
        },
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropDomain('schema.domain', (t) => t.text().nullable().default(t.sql\`('a'::text || 'b'::text)\`).check(t.sql\`(VALUE = 'ab'::text)\`).collate('C'));
});

change(async (db) => {
  await db.createDomain('schema.domain', (t) => t.text().nullable().default(t.sql\`'a'||'c'\`).check(t.sql\`value = 'ab'\`).collate('C'));
});
`);

    assert.report(`${red('- drop domain')} schema.domain
${green('+ create domain')} schema.domain`);
  });

  it('should rename a domain when only name is changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createDomain('schema.from', (t) =>
          t.text().nullable().collate('C'),
        );
      },
      dbOptions: {
        domains: {
          'schema.to': (t) => t.text().nullable().collate('C'),
        },
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameType('schema.from', 'schema.to');
});
`);
    assert.report(
      `${yellow('~ rename domain')} schema.from ${yellow('=>')} schema.to`,
    );
  });

  it('should change domain schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('newSchema');

        await db.createDomain('domain', (t) =>
          t.text().nullable().collate('C'),
        );
      },
      dbOptions: {
        domains: {
          'newSchema.domain': (t) => t.text().nullable().collate('C'),
        },
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTypeSchema('domain', 'public', 'newSchema');
});
`);

    assert.report(
      `${yellow('~ change schema of domain')} domain ${yellow(
        '=>',
      )} newSchema.domain`,
    );
  });

  it('should not change domain schema when renaming a schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('oldSchema');

        await db.createDomain('oldSchema.domain', (t) => t.integer());
      },
      dbOptions: {
        domains: {
          'newSchema.domain': (t) => t.integer(),
        },
      },
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameSchema('oldSchema', 'newSchema');
});
`);

    assert.report(
      `${yellow('~ rename schema')} oldSchema ${yellow('=>')} newSchema`,
    );
  });
});
