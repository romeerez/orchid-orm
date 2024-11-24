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
      t.check(t.sql\`"col_umn" = 42\`, 'table_col_umn_check')
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
      t.check(t.sql\`i_d != 123\`, 'table_i_d_check')
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop check')} (i_d = 123)
  ${green('+ add check')} i_d != 123`);
  });

  it('should create table checks', async () => {
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
          (t) => [t.check(t.sql`"i_d" = 1`), t.check(t.sql`"i_d" = 2`)],
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`"i_d" = 1\`, 'table_check')
    ),
    ...t.add(
      t.check(t.sql\`"i_d" = 2\`, 'table_check1')
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} "i_d" = 1
  ${green('+ add check')} "i_d" = 2`);
  });

  it('should be added together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        table((t) => ({
          iD: t.integer().check(t.sql`"i_d" = 5`, 'name'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    iD: t.add(t.integer().check(t.sql\`"i_d" = 5\`, 'name')),
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
          iD: t.smallint(),
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
    iD: t.change(t.smallint(), t.integer().check(t.sql\`"i_d" = 5\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} iD:
    ${yellow('from')}: t.smallint()
      ${yellow('to')}: t.integer().check(t.sql\`"i_d" = 5\`)`);
  });

  it('should be dropped in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t
            .integer()
            .nullable()
            .check(t.sql`"i_d" = 5`),
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
    iD: t.change(t.integer().nullable().check(t.sql\`(i_d = 5)\`, 'table_i_d_check'), t.integer()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} i_d:
    ${yellow(
      'from',
    )}: t.integer().nullable().check(t.sql\`(i_d = 5)\`, 'table_i_d_check')
      ${yellow('to')}: t.integer()`);
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

  it('should not be added during unrelated column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t
            .integer()
            .nullable()
            .check(t.sql`"i_d" = 5`),
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
    iD: t.change(t.integer().nullable(), t.integer()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} iD:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer()`);
  });

  it('should add a column check when other column check exists', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          firstName: t.text().check(t.sql`first_name != ''`),
          lastName: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          firstName: t.text().check(t.sql`first_name != ''`),
          lastName: t.text().check(t.sql`last_name != ''`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`last_name != ''\`, 'table_last_name_check')
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} last_name != ''`);
  });

  it('should add a table check when other column check exists', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          firstName: t.text().check(t.sql`first_name != ''`),
          lastName: t.text(),
        }));
      },
      tables: [
        table(
          (t) => ({
            firstName: t.text().check(t.sql`first_name != ''`),
            lastName: t.text(),
          }),
          (t) => t.check(t.sql`first_name != last_name`),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`first_name != last_name\`, 'table_check')
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} first_name != last_name`);
  });

  it('should add column checks to two columns simultaneously', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          firstName: t.text(),
          lastName: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          firstName: t.text().check(t.sql`first_name != ''`),
          lastName: t.text().check(t.sql`last_name != ''`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.check(t.sql\`first_name != ''\`, 'table_first_name_check')
    ),
    ...t.add(
      t.check(t.sql\`last_name != ''\`, 'table_last_name_check')
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add check')} first_name != ''
  ${green('+ add check')} last_name != ''`);
  });

  it('should drop multiple checks and add multiple checks', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            firstName: t
              .text()
              .check(t.sql`first_name = 'keep1'`)
              .check(t.sql`first_name = 'drop1'`)
              .check(t.sql`first_name = 'drop2'`),
            lastName: t.text(),
          }),
          (t) => [
            t.check(t.sql`first_name = 'keep2'`),
            t.check(t.sql`first_name = 'drop3'`),
            t.check(t.sql`first_name = 'drop4'`),
          ],
        );
      },
      tables: [
        table(
          (t) => ({
            firstName: t
              .text()
              .check(t.sql`first_name = 'keep1'`)
              .check(t.sql`first_name = 'add1'`)
              .check(t.sql`first_name = 'add2'`),
            lastName: t.text(),
          }),
          (t) => [
            t.check(t.sql`first_name = 'keep2'`),
            t.check(t.sql`first_name = 'add3'`),
            t.check(t.sql`first_name = 'add4'`),
          ],
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.check(t.sql\`(first_name = 'drop3'::text)\`, 'table_check1')
    ),
    ...t.drop(
      t.check(t.sql\`(first_name = 'drop4'::text)\`, 'table_check2')
    ),
    ...t.drop(
      t.check(t.sql\`(first_name = 'drop1'::text)\`, 'table_first_name_check1')
    ),
    ...t.drop(
      t.check(t.sql\`(first_name = 'drop2'::text)\`, 'table_first_name_check2')
    ),
    ...t.add(
      t.check(t.sql\`first_name = 'add1'\`, 'table_first_name_check1')
    ),
    ...t.add(
      t.check(t.sql\`first_name = 'add2'\`, 'table_first_name_check2')
    ),
    ...t.add(
      t.check(t.sql\`first_name = 'add3'\`, 'table_check1')
    ),
    ...t.add(
      t.check(t.sql\`first_name = 'add4'\`, 'table_check2')
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop check')} (first_name = 'drop3'::text)
  ${red('- drop check')} (first_name = 'drop4'::text)
  ${red('- drop check')} (first_name = 'drop1'::text)
  ${red('- drop check')} (first_name = 'drop2'::text)
  ${green('+ add check')} first_name = 'add1'
  ${green('+ add check')} first_name = 'add2'
  ${green('+ add check')} first_name = 'add3'
  ${green('+ add check')} first_name = 'add4'`);
  });
});
