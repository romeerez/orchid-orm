import { generatorsTestUtils } from './generators.test-utils';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';
import { colors } from '../../colors';

jest.mock('../../commands/migrateOrRollback');
jest.mock('../dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../prompt');

const { arrange, act, assert, table, makeStructure } = generatorsTestUtils;
const { green, red, yellow } = colors;

describe('checks', () => {
  beforeEach(jest.clearAllMocks);

  it('should create a column check', async () => {
    arrange({
      tables: [
        table((t) => ({
          column: t.integer().check(t.sql`sql`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'column' })],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`sql\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} sql`);
  });

  it('should drop a column check', async () => {
    arrange({
      tables: [
        table((t) => ({
          column: t.integer(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'column' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.check({
            check: {
              columns: ['column'],
              expression: 'sql',
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.check(t.sql\`sql\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop check')} sql`);
  });

  it('should not recreate a column check when it is identical', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`id != 123`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.check({
            check: {
              columns: ['id'],
              expression: '(id <> 123)',
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  it('should recreate a column check when it is changed', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`id != 123`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.check({
            check: {
              columns: ['id'],
              expression: '(id = 123)',
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.check(t.sql\`(id = 123)\`)
    ),
    ...t.add(
      t.check(t.sql\`id != 123\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop check')} (id = 123)
  ${green('+ add check')} id != 123`);
  });

  it('should create a table check', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.integer(),
          ...t.check(t.sql`sql`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`sql\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} sql`);
  });

  it('should be added together with a column', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`sql`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.add(t.integer().check(t.sql\`sql\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} id integer, checks sql`);
  });

  it('should be dropped together with a column', async () => {
    arrange({
      tables: [table()],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.check({
            check: {
              columns: ['id'],
              expression: 'sql',
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.drop(t.integer().check(t.sql\`sql\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop column')} id integer, checks sql`);
  });

  it('should be added in a column change', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`sql`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({
                name: 'id',
                isNullable: true,
              }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.change(t.integer().nullable(), t.integer().check(t.sql\`sql\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} id:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer().check(t.sql\`sql\`)`);
  });

  it('should not be recreated when a column is renamed', async () => {
    arrange({
      tables: [
        table((t) => ({
          to: t.integer().check(t.sql`2 + 2`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({
                name: 'from',
                isNullable: true,
              }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.check({
            check: {
              columns: ['from'],
              expression: '2 + 2',
            },
          }),
        ],
      }),
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    from: t.rename('to'),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ rename column')} from ${yellow('=>')} to`);
  });
});
