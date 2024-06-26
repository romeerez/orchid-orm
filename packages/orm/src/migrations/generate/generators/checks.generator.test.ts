import { useGeneratorsTestUtils } from './generators.test-utils';
import { colors } from 'rake-db';

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

describe('checks', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  it('should create a column check', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.integer().check(t.sql`"col_umn" = 42`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`"col_umn" = 42\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} "col_umn" = 42`);
  });

  it('should drop a column check', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.integer().check(t.sql`"col_umn" = 42`),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.integer(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.check(t.sql\`(col_umn = 42)\`, 'table_col_umn_check')
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop check')} (col_umn = 42)`);
  });

  it('should not recreate a column check when it is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.integer().check(t.sql`i_d != 123`),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.integer().check(t.sql`i_d != 123`),
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
          iD: t.integer().check(t.sql`i_d = 123`),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.integer().check(t.sql`i_d != 123`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.check(t.sql\`(i_d = 123)\`, 'table_i_d_check')
    ),
    ...t.add(
      t.check(t.sql\`i_d != 123\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop check')} (i_d = 123)
  ${green('+ add check')} i_d != 123`);
  });

  it('should create a table check', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.integer(),
        }));
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
          }),
          (t) => t.check(t.sql`"i_d" = 42`),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`"i_d" = 42\`)
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} "i_d" = 42`);
  });

  it('should be added together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        table((t) => ({
          iD: t.integer().check(t.sql`"i_d" = 5`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.add(t.integer().check(t.sql\`"i_d" = 5\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} iD integer, checks "i_d" = 5`);
  });

  it('should be dropped together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.integer().check(t.sql`i_d = 123`),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.drop(t.integer().check(t.sql\`(i_d = 123)\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop column')} iD integer, checks (i_d = 123)`);
  });

  it('should be added in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.integer().nullable(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.integer().check(t.sql`"i_d" = 5`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.change(t.integer().nullable(), t.integer().check(t.sql\`"i_d" = 5\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} iD:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer().check(t.sql\`"i_d" = 5\`)`);
  });

  it('should not be recreated when a column is renamed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          frOm: t.integer().check(t.sql`2 = 2`),
        }));
      },
      tables: [
        table((t) => ({
          tO: t.integer().check(t.sql`2 = 2`),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    fr_om: t.rename('tO'),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ rename column')} fr_om ${yellow('=>')} tO`);
  });
});
