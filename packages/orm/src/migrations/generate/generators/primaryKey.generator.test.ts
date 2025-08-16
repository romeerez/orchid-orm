import { useGeneratorsTestUtils } from './generators.test-utils';
import { colors } from 'orchid-core';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  fullMigrate: jest.fn(),
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

  it('should not be dropped in ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createTable('schema.inSchemaTable', (t) => ({
          iD: t.identity().primaryKey('custom'),
        }));

        await db.createTable('publicTable', (t) => ({
          iD: t.identity().primaryKey('custom'),
        }));
      },
      dbOptions: {
        generatorIgnore: {
          schemas: ['schema'],
          tables: ['publicTable'],
        },
      },
      tables: [
        table(
          (t) => ({
            iD: t.identity(),
          }),
          undefined,
          { name: 'schema.inSchemaTable' },
        ),
        table(
          (t) => ({
            iD: t.identity(),
          }),
          undefined,
          { name: 'publicTable' },
        ),
      ],
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should add a column primary key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.identity().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(t.primaryKey(['iD'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add primary key')} on (iD)`,
    );
  });

  it('should drop a column primary key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity().primaryKey('custom'),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.identity(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['i_d'], 'custom')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (i_d)`,
    );
  });

  it('should change a primary key column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          iD: t.identity().primaryKey(),
          kEy: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.identity(),
          kEy: t.text().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['i_d'])),
    ...t.add(t.primaryKey(['kEy'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (i_d)
  ${green('+ add primary key')} on (kEy)`,
    );
  });

  it('should add a composite primary key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity(),
          kEy: t.text(),
        }));
      },
      tables: [
        table(
          (t) => ({
            iD: t.identity(),
            kEy: t.text(),
          }),
          (t) => t.primaryKey(['iD', 'kEy'], 'custom'),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(t.primaryKey(['iD', 'kEy'], 'custom')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add primary key')} on (iD, kEy)`,
    );
  });

  it('should add a composite primary key defined on columns', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity(),
          kEy: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.identity().primaryKey(),
          kEy: t.text().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(t.primaryKey(['iD', 'kEy'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add primary key')} on (iD, kEy)`,
    );
  });

  it('should drop a composite primary key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.identity(),
            kEy: t.text(),
          }),
          (t) => t.primaryKey(['iD', 'kEy']),
        );
      },
      tables: [
        table((t) => ({
          iD: t.identity(),
          kEy: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.primaryKey(['i_d', 'k_ey'])),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop primary key')} on (i_d, k_ey)`,
    );
  });

  it('should change a composite primary key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            a: t.identity(),
            b: t.text(),
            c: t.integer(),
          }),
          (t) => t.primaryKey(['a', 'b']),
        );
      },
      tables: [
        table(
          (t) => ({
            a: t.identity(),
            b: t.text(),
            c: t.integer(),
          }),
          (t) => t.primaryKey(['b', 'c']),
        ),
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
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            a: t.identity(),
            b: t.text(),
            c: t.integer(),
          }),
          (t) => t.primaryKey(['a', 'b']),
        );
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
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            a: t.identity(),
            b: t.text(),
          }),
          (t) => t.primaryKey(['a', 'b'], 'from'),
        );
      },
      tables: [
        table(
          (t) => ({
            a: t.identity(),
            b: t.text(),
          }),
          (t) => t.primaryKey(['a', 'b'], 'to'),
        ),
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
            iD: t.identity().primaryKey(),
          }),
          undefined,
          { noPrimaryKey: false },
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.add(t.identity().primaryKey()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add column')} iD integer primary key`,
    );
  });

  it('should be dropped together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          iD: t.identity().primaryKey(),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.drop(t.identity().primaryKey()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop column')} iD integer primary key`,
    );
  });

  it('should be added in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.identity().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.change(t.integer(), t.identity().primaryKey()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} iD:
    ${yellow('from')}: t.integer()
      ${yellow('to')}: t.identity().primaryKey()`,
    );
  });

  it('should be dropped in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity().primaryKey(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.integer(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.change(t.identity().primaryKey(), t.integer()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} iD:
    ${yellow('from')}: t.identity().primaryKey()
      ${yellow('to')}: t.integer()`,
    );
  });

  it('should not be recreated when a column is renamed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          frOm: t.integer().primaryKey(),
        }));
      },
      tables: [
        table((t) => ({
          tO: t.integer().primaryKey(),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    frOm: t.rename('tO'),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ rename column')} frOm ${yellow('=>')} tO`,
    );
  });

  it('should not be added during unrelated column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.varchar(100).primaryKey(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.text().primaryKey(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.change(t.varchar(100), t.text()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} iD:
    ${yellow('from')}: t.varchar(100)
      ${yellow('to')}: t.text()`,
    );
  });
});
