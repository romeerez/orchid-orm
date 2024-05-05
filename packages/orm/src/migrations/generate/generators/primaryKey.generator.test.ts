import { useGeneratorsTestUtils } from './generators.test-utils';
import { colors } from 'rake-db';

jest.mock('rake-db', () => ({
  ...jest.requireActual('rake-db'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red, yellow } = colors;

describe('primaryKey', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  it('should add a column primary key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity().primaryKey({ name: 'custom' }),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          id: t.identity().primaryKey(),
          key: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity(),
          key: t.text().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity(),
          key: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity(),
          key: t.text(),
          ...t.primaryKey(['id', 'key'], { name: 'custom' }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity(),
          key: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity().primaryKey(),
          key: t.text().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity(),
          key: t.text(),
          ...t.primaryKey(['id', 'key']),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity(),
          key: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.identity(),
          b: t.text(),
          c: t.integer(),
          ...t.primaryKey(['a', 'b']),
        }));
      },
      tables: [
        table((t) => ({
          a: t.identity(),
          b: t.text(),
          c: t.integer(),
          ...t.primaryKey(['b', 'c']),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.identity(),
          b: t.text(),
          c: t.integer(),
          ...t.primaryKey(['a', 'b']),
        }));
      },
      tables: [
        table((t) => ({
          a: t.identity(),
          b: t.text().primaryKey(),
          c: t.integer().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.identity(),
          b: t.text(),
          ...t.primaryKey(['a', 'b'], { name: 'from' }),
        }));
      },
      tables: [
        table((t) => ({
          a: t.identity(),
          b: t.text(),
          ...t.primaryKey(['a', 'b'], { name: 'to' }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        table(
          (t) => ({
            id: t.identity().primaryKey(),
          }),
          { noPrimaryKey: false },
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          id: t.identity().primaryKey(),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          from: t.integer().primaryKey(),
        }));
      },
      tables: [
        table((t) => ({
          to: t.integer().primaryKey(),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
