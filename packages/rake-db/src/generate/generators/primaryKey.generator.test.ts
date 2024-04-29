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

describe('primaryKey', () => {
  beforeEach(jest.clearAllMocks);

  it('should add a column primary key', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity().primaryKey(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.identityColumn({ name: 'id' })],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(t.primaryKey(['id'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add primary key')} on (id)`,
    );
  });

  it('should drop a column primary key', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.identityColumn({ name: 'id' })],
          }),
        ],
        constraints: [dbStructureMockFactory.primaryKey({ name: 'custom' })],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['id'], { name: 'custom' })),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (id)`,
    );
  });

  it('should change a primary key column', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity(),
          key: t.text().primaryKey(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'id' }),
              dbStructureMockFactory.textColumn({ name: 'key' }),
            ],
          }),
        ],
        constraints: [dbStructureMockFactory.primaryKey()],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['id'])),
    ...t.add(t.primaryKey(['key'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (id)
  ${green('+ add primary key')} on (key)`,
    );
  });

  it('should add a composite primary key', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity(),
          key: t.text(),
          ...t.primaryKey(['id', 'key'], { name: 'custom' }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'id' }),
              dbStructureMockFactory.textColumn({ name: 'key' }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(t.primaryKey(['id', 'key'], { name: 'custom' })),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add primary key')} on (id, key)`,
    );
  });

  it('should add a composite primary key defined on columns', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity().primaryKey(),
          key: t.text().primaryKey(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'id' }),
              dbStructureMockFactory.textColumn({ name: 'key' }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(t.primaryKey(['id', 'key'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add primary key')} on (id, key)`,
    );
  });

  it('should drop a composite primary key', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity(),
          key: t.text(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'id' }),
              dbStructureMockFactory.textColumn({ name: 'key' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({ primaryKey: ['id', 'key'] }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['id', 'key'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (id, key)`,
    );
  });

  it('should change a composite primary key', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.identity(),
          b: t.text(),
          c: t.integer(),
          ...t.primaryKey(['b', 'c']),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
              dbStructureMockFactory.intColumn({ name: 'c' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({ primaryKey: ['a', 'b'] }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['a', 'b'])),
    ...t.add(t.primaryKey(['b', 'c'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (a, b)
  ${green('+ add primary key')} on (b, c)`,
    );
  });

  it('should change a composite primary key defined on columns', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.identity(),
          b: t.text().primaryKey(),
          c: t.integer().primaryKey(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
              dbStructureMockFactory.intColumn({ name: 'c' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({ primaryKey: ['a', 'b'] }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['a', 'b'])),
    ...t.add(t.primaryKey(['b', 'c'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (a, b)
  ${green('+ add primary key')} on (b, c)`,
    );
  });

  it('should rename primary key', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.identity(),
          b: t.text(),
          ...t.primaryKey(['a', 'b'], { name: 'to' }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({
            primaryKey: ['a', 'b'],
            name: 'from',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameConstraint('public.table', 'from', 'to');
});
`);

    assert.report(
      `${yellow('~ rename constraint')} on table table: from ${yellow(
        '=>',
      )} to`,
    );
  });

  it('should be added together with a column', async () => {
    arrange({
      tables: [
        table(
          (t) => ({
            id: t.identity().primaryKey(),
          }),
          false,
        ),
      ],
      structure: makeStructure({
        tables: [dbStructureMockFactory.table()],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.add(t.identity().primaryKey()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add column')} id integer primary key`,
    );
  });

  it('should be dropped together with a column', async () => {
    arrange({
      tables: [table()],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.identityColumn({ name: 'id' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({
            primaryKey: ['id'],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.drop(t.identity().primaryKey()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop column')} id integer primary key`,
    );
  });

  it('should be added in a column change', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity().primaryKey(),
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
    id: t.change(t.integer(), t.identity().primaryKey()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} id:
    ${yellow('from')}: t.integer()
      ${yellow('to')}: t.identity().primaryKey()`,
    );
  });

  it('should not be recreated when a column is renamed', async () => {
    arrange({
      tables: [
        table((t) => ({
          to: t.integer().primaryKey(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            columns: [dbStructureMockFactory.intColumn({ name: 'from' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({
            primaryKey: ['from'],
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

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ rename column')} from ${yellow('=>')} to`,
    );
  });
});
