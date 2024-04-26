import { generatorsTestUtils } from './generators.test-utils';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';

jest.mock('../dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../prompt');

const { arrange, act, assert, makeStructure } = generatorsTestUtils;

describe('domains', () => {
  beforeEach(jest.clearAllMocks);

  it('should create a domain', async () => {
    arrange({
      dbOptions: {
        domains: {
          'schema.domain': (t) =>
            t
              .integer()
              .nullable()
              .collate('C')
              .default(t.sql`2 + 2`)
              .check(t.sql`value = 42`),
        },
      },
      structure: makeStructure({
        schemas: ['schema'],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createDomain('schema.domain', (t) => t.integer().nullable().default(t.sql\`2 + 2\`).check(t.sql\`value = 42\`).collate('C'));
});
`);
  });

  it('should drop a domain', async () => {
    arrange({
      structure: makeStructure({
        domains: [
          dbStructureMockFactory.domain({
            schemaName: 'schema',
            type: 'text',
            isNullable: true,
            collate: 'C',
            default: `('a'::text || 'b'::text)`,
            check: `(VALUE = 'ab'::text)`,
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropDomain('schema.domain', (t) => t.text().nullable().default(t.sql\`('a'::text || 'b'::text)\`).check(t.sql\`(VALUE = 'ab'::text)\`).collate('C'));
});
`);
  });

  it('should not recreate a domain when it is not changed', async () => {
    arrange({
      dbOptions: {
        domains: {
          'schema.domain': (t) =>
            t
              .text(1, 2)
              .nullable()
              .collate('C')
              .default(t.sql`'a'||'b'`)
              .check(t.sql`value = 'ab'`),
        },
      },
      structure: makeStructure({
        schemas: ['schema'],
        domains: [
          dbStructureMockFactory.domain({
            schemaName: 'schema',
            type: 'text',
            isNullable: true,
            collate: 'C',
            default: `('a'::text || 'b'::text)`,
            check: `(VALUE = 'ab'::text)`,
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  it('should recreate a domain when value was changed', async () => {
    arrange({
      dbOptions: {
        domains: {
          'schema.domain': (t) => t.text(1, 2).collate('C'),
        },
      },
      structure: makeStructure({
        schemas: ['schema'],
        domains: [
          dbStructureMockFactory.domain({
            schemaName: 'schema',
            type: 'text',
            isNullable: true,
            collate: 'C',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropDomain('schema.domain', (t) => t.text().nullable().collate('C'));
});

change(async (db) => {
  await db.createDomain('schema.domain', (t) => t.text(1, 2).collate('C'));
});
`);
  });

  it('should recreate a domain when sql value was changed', async () => {
    arrange({
      dbOptions: {
        domains: {
          'schema.domain': (t) =>
            t
              .text(1, 2)
              .nullable()
              .collate('C')
              .default(t.sql`'a'||'c'`)
              .check(t.sql`value = 'ab'`),
        },
      },
      structure: makeStructure({
        schemas: ['schema'],
        domains: [
          dbStructureMockFactory.domain({
            schemaName: 'schema',
            type: 'text',
            isNullable: true,
            collate: 'C',
            default: `('a'::text || 'b'::text)`,
            check: `(VALUE = 'ab'::text)`,
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropDomain('schema.domain', (t) => t.text().nullable().default(t.sql\`('a'::text || 'b'::text)\`).check(t.sql\`(VALUE = 'ab'::text)\`).collate('C'));
});

change(async (db) => {
  await db.createDomain('schema.domain', (t) => t.text(1, 2).nullable().default(t.sql\`'a'||'c'\`).check(t.sql\`value = 'ab'\`).collate('C'));
});
`);
  });

  it('should rename a domain when only name is changed', async () => {
    arrange({
      dbOptions: {
        domains: {
          'schema.to': (t) => t.text(1, 2).nullable().collate('C'),
        },
      },
      structure: makeStructure({
        schemas: ['schema'],
        domains: [
          dbStructureMockFactory.domain({
            name: 'from',
            schemaName: 'schema',
            type: 'text',
            isNullable: true,
            collate: 'C',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameType('schema.from', 'schema.to');
});
`);
  });

  it('should change domain schema', async () => {
    arrange({
      dbOptions: {
        domains: {
          'newSchema.domain': (t) => t.text(1, 2).nullable().collate('C'),
        },
      },
      structure: makeStructure({
        schemas: ['newSchema'],
        domains: [
          dbStructureMockFactory.domain({
            schemaName: 'oldSchema',
            name: 'domain',
            type: 'text',
            isNullable: true,
            collate: 'C',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTypeSchema('domain', 'oldSchema', 'newSchema');
});
`);
  });

  it('should not change domain schema when renaming a schema', async () => {
    arrange({
      dbOptions: {
        domains: {
          'newSchema.domain': (t) => t.integer(),
        },
      },
      structure: makeStructure({
        schemas: ['oldSchema'],
        domains: [
          dbStructureMockFactory.domain({
            schemaName: 'oldSchema',
            name: 'domain',
            type: 'int4',
          }),
        ],
      }),
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('oldSchema', 'newSchema');
});
`);
  });
});
