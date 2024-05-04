import { useGeneratorsTestUtils } from './generators.test-utils';
import { DbMigration, colors } from 'rake-db';
import { DefaultColumnTypes, DefaultSchemaConfig } from 'pqb';

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

describe('columns', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  it('should add a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity(),
          name: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.add(t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} name text`);
  });

  it('should drop a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.identity(),
          name: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          id: t.identity(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.drop(t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop column')} name text`);
  });

  it('should change column type', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          name: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          name: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.change(t.integer(), t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} name:
    ${yellow('from')}: t.integer()
      ${yellow('to')}: t.text()`);
  });

  it('should change column type when type schema is changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');
        await db.createSchema('to');
        await db.createDomain('from.custom', (t) => t.integer());
        await db.createDomain('to.custom', (t) => t.varchar());

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          unchanged: t.domain('from.custom'),
          column: t.domain('from.custom'),
        }));
      },
      tables: [
        table((t) => ({
          unchanged: t.domain('from.custom').as(t.integer()),
          column: t.domain('to.custom').as(t.varchar()),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.domain('from.custom'), t.domain('to.custom')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.domain('from.custom')
      ${yellow('to')}: t.domain('to.custom')`);
  });

  it('should change column nullability', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.integer().nullable(),
        }));
      },
      tables: [
        table((t) => ({
          column: t.integer(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.integer().nullable(), t.integer()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer()`);
  });

  it('should change text data type properties', async () => {
    await arrange({
      async prepareDb(db) {
        try {
          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            column: t.varchar(10).collate('es_ES').compression('pglz'),
          }));
        } catch (err) {
          console.log(err);
        }
      },
      tables: [
        table((t) => ({
          column: t.varchar(20).collate('fr_FR').compression('lz4'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.varchar(10).compression('pglz').collate('es_ES'), t.varchar(20).compression('lz4').collate('fr_FR')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.varchar(10).compression('pglz').collate('es_ES')
      ${yellow('to')}: t.varchar(20).compression('lz4').collate('fr_FR')`);
  });

  it('change number data type properties', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.decimal(3, 7),
        }));
      },
      tables: [
        table((t) => ({
          column: t.decimal(11, 13),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.decimal(3, 7), t.decimal(11, 13)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.decimal(3, 7)
      ${yellow('to')}: t.decimal(11, 13)`);
  });

  it('change date precision', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.timestamp(3),
        }));
      },
      tables: [
        table((t) => ({
          column: t.timestamp(5),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.timestamp(3), t.timestamp(5)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.timestamp(3)
      ${yellow('to')}: t.timestamp(5)`);
  });

  it('change default', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          valueNotChanged: t.integer().default(1),
          valueChanged: t.integer().default(2),
          ignoreFunction: t.integer(),
          sqlNotChanged: t.integer().default(t.sql`1 + 2`),
          sqlChanged: t.integer().default(t.sql`1 + 2`),
        }));
      },
      tables: [
        table((t) => ({
          valueNotChanged: t.integer().default(1),
          valueChanged: t.integer().default(3),
          ignoreFunction: t.integer().default(() => 1),
          sqlNotChanged: t.integer().default(t.sql`1 + 2`),
          sqlChanged: t.integer().default(t.sql`1 + 3`),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    valueChanged: t.change(t.integer().default(t.sql\`2\`), t.integer().default(3)),
    sqlChanged: t.change(t.integer().default(t.sql\`(1 + 2)\`), t.integer().default(t.sql\`1 + 3\`)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} valueChanged:
    ${yellow('from')}: t.integer().default(t.sql\`2\`)
      ${yellow('to')}: t.integer().default(3)
  ${yellow('~ change column')} sqlChanged:
    ${yellow('from')}: t.integer().default(t.sql\`(1 + 2)\`)
      ${yellow('to')}: t.integer().default(t.sql\`1 + 3\`)`);
  });

  it('change identity', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.identity(),
        }));
      },
      tables: [
        table((t) => ({
          column: t.identity({
            increment: 2,
            min: 3,
            start: 4,
            max: 5,
            cache: 6,
            cycle: true,
            always: true,
          }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.identity(), t.identity({
      always: true,
      increment: 2,
      start: 4,
      min: 3,
      max: 5,
      cache: 6,
      cycle: true,
    })),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.identity()
      ${yellow('to')}: t.identity({
      always: true,
      increment: 2,
      start: 4,
      min: 3,
      max: 5,
      cache: 6,
      cycle: true,
    })`);
  });

  it('change column comment', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.text().comment('from'),
        }));
      },
      tables: [
        table((t) => ({
          column: t.text().comment('to'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.text().comment('from'), t.text().comment('to')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.text().comment('from')
      ${yellow('to')}: t.text().comment('to')`);
  });

  it('change to array type: prompt if should recreate the column or abort, selecting recreate', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          column: t.array(t.integer()),
        })),
      ],
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.name('column').integer()),
    ...t.add(t.name('column').array(t.integer())),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop column')} column integer
  ${green('+ add column')} column array`);
  });

  it('change from array type: prompt if should recreate the column or abort, selecting abort', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          column: t.array(t.integer()),
        }));
      },
      tables: [
        table((t) => ({
          column: t.integer(),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration();
  });

  describe('recreating and renaming', () => {
    const prepareDb = async (
      db: DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>,
    ) => {
      await db.createTable('table', { noPrimaryKey: true }, (t) => ({
        from: t.integer(),
      }));
    };

    it('should drop old and create new column when selected', async () => {
      await arrange({
        prepareDb,
        tables: [
          table((t) => ({
            to: t.integer(),
          })),
        ],
        selects: [0],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    to: t.add(t.integer()),
    from: t.drop(t.integer()),
  }));
});
`);

      assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} to integer
  ${red('- drop column')} from integer`);
    });

    it('should rename column when selected', async () => {
      await arrange({
        prepareDb,
        tables: [
          table((t) => ({
            to: t.integer(),
          })),
        ],
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

    it('should rename column when using custom name', async () => {
      await arrange({
        prepareDb,
        tables: [
          table((t) => ({
            from: t.name('to').integer(),
          })),
        ],
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
});
