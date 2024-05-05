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

describe('checks', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  it('should create a column check', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          column: t.integer().check(t.sql`"column" = 42`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`"column" = 42\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} "column" = 42`);
  });

  it('should drop a column check', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.integer().check(t.sql`"column" = 42`),
        }));
      },
      tables: [
        table((t) => ({
          column: t.integer(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.check(t.sql\`("column" = 42)\`, { name: 'table_column_check' })
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop check')} ("column" = 42)`);
  });

  it('should not recreate a column check when it is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.integer().check(t.sql`id != 123`),
        }));
      },
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`id != 123`),
        })),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate a column check when it is changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.integer().check(t.sql`id = 123`),
        }));
      },
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`id != 123`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.check(t.sql\`(id = 123)\`, { name: 'table_id_check' })
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
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.integer(),
          ...t.check(t.sql`"id" = 42`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`"id" = 42\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} "id" = 42`);
  });

  it('should be added together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`"id" = 5`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.add(t.integer().check(t.sql\`"id" = 5\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} id integer, checks "id" = 5`);
  });

  it('should be dropped together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.integer().check(t.sql`id = 123`),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.drop(t.integer().check(t.sql\`(id = 123)\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop column')} id integer, checks (id = 123)`);
  });

  it('should be added in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.integer().nullable(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.integer().check(t.sql`"id" = 5`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.change(t.integer().nullable(), t.integer().check(t.sql\`"id" = 5\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} id:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer().check(t.sql\`"id" = 5\`)`);
  });

  it('should not be recreated when a column is renamed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          from: t.integer().check(t.sql`2 = 2`),
        }));
      },
      tables: [
        table((t) => ({
          to: t.integer().check(t.sql`2 = 2`),
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

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ rename column')} from ${yellow('=>')} to`);
  });
});
