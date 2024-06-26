import { useGeneratorsTestUtils } from './generators.test-utils';
import { colors } from 'rake-db';
import { TableData } from 'pqb';

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

describe('primaryKey', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  const columnOptions: TableData.Index.ColumnOptions = {
    collate: 'C',
    opclass: 'varchar_ops',
    order: 'DESC',
  };

  const columnOptionsSql = `collate: 'C',
            opclass: 'varchar_ops',
            order: 'DESC',`;

  const indexOptions = {
    unique: true,
    nullsNotDistinct: true,
    include: ['naMe'],
  } satisfies TableData.Index.Options;

  const indexOptionsSql = `{
        nullsNotDistinct: true,
        include: ['naMe'],
      }`;

  const indexOptionsSqlDrop = `{
        nullsNotDistinct: true,
        include: ['na_me'],
      }`;

  const indexOptionsSqlShifted = indexOptionsSql.replaceAll('\n', '\n  ');
  const indexOptionsSqlShiftedDrop = indexOptionsSqlDrop.replaceAll(
    '\n',
    '\n  ',
  );

  it('should create a column index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t.text().index({
            ...columnOptions,
            ...indexOptions,
          }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.unique(
        [
          {
            column: 'naMe',
            ${columnOptionsSql}
          },
        ],
        ${indexOptionsSqlShifted},
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add unique index')} on (naMe)`);
  });

  it('should drop a column index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index(indexOptions),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.unique(['na_me'], ${indexOptionsSqlDrop})
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (na_me)`);
  });

  it('should rename an index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index('from'),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t.text().index('to'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameIndex('public.table', 'from', 'to');
});
`);

    assert.report(
      `${yellow('~ rename index')} on table table: from ${yellow('=>')} to`,
    );
  });

  it('should not be recreated when column index is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            naMe: t.text(),
          }),
          (t) => t.index([{ column: 'naMe', ...columnOptions }], indexOptions),
        );
      },
      tables: [
        table((t) => ({
          naMe: t.text().index({
            ...columnOptions,
            ...indexOptions,
          }),
        })),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate a column index with different options', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index(indexOptions),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t.text().index({ ...indexOptions, unique: false }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.unique(['na_me'], ${indexOptionsSqlDrop})
    ),
    ...t.add(
      t.index(['naMe'], ${indexOptionsSql})
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (na_me)
  ${green('+ add index')} on (naMe)`);
  });

  it('should create a composite index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.integer(),
          naMe: t.text(),
        }));
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'iD',
                {
                  column: 'naMe',
                  ...columnOptions,
                },
              ],
              indexOptions,
            ),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.unique(
        [
          'iD',
          {
            column: 'naMe',
            ${columnOptionsSql}
          },
        ],
        ${indexOptionsSqlShifted},
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add unique index')} on (iD, naMe)`);
  });

  it('should drop a composite index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.index(
              [{ column: 'iD' }, { column: 'naMe', ...columnOptions }],
              indexOptions,
            ),
        );
      },
      tables: [
        table((t) => ({
          iD: t.integer(),
          naMe: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.unique(
        [
          'i_d',
          {
            column: 'na_me',
            ${columnOptionsSql}
          },
        ],
        ${indexOptionsSqlShiftedDrop},
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (i_d, na_me)`);
  });

  it('should not recreate composite index when it is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.unique(
              [{ column: 'iD' }, { column: 'naMe', ...columnOptions }],
              indexOptions,
            ),
        );
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'iD',
                {
                  column: 'naMe',
                  ...columnOptions,
                },
              ],
              indexOptions,
            ),
        ),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate composite index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.index([{ column: 'iD' }, { column: 'naMe', ...columnOptions }], {
              ...indexOptions,
              unique: false,
            }),
        );
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'iD',
                {
                  column: 'naMe',
                  ...columnOptions,
                },
              ],
              indexOptions,
            ),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.index(
        [
          'i_d',
          {
            column: 'na_me',
            ${columnOptionsSql}
          },
        ],
        ${indexOptionsSqlShiftedDrop},
      ),
    ),
    ...t.add(
      t.unique(
        [
          'iD',
          {
            column: 'naMe',
            ${columnOptionsSql}
          },
        ],
        ${indexOptionsSqlShifted},
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop index')} on (i_d, na_me)
  ${green('+ add unique index')} on (iD, naMe)`);
  });

  it('should rename a composite index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.index(
              [{ column: 'iD' }, { column: 'naMe', ...columnOptions }],
              'from',
              indexOptions,
            ),
        );
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'iD',
                {
                  column: 'naMe',
                  ...columnOptions,
                },
              ],
              'to',
              indexOptions,
            ),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameIndex('public.table', 'from', 'to');
});
`);

    assert.report(
      `${yellow('~ rename index')} on table table: from ${yellow('=>')} to`,
    );
  });

  it('should be added together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        table((t) => ({
          naMe: t.text().index(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.add(t.text().index()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add column')} naMe text, has index`,
    );
  });

  it('should be dropped together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index(),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.drop(t.text().index()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop column')} naMe text, has index`,
    );
  });

  it('should be added in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t.text().index(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.change(t.integer(), t.text().index()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} naMe:
    ${yellow('from')}: t.integer()
      ${yellow('to')}: t.text().index()`,
    );
  });

  it('should not be recreated when a column is renamed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          frOm: t.text().index(),
        }));
      },
      tables: [
        table((t) => ({
          tO: t.text().index(),
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

  await db.renameIndex('public.table', 'table_fr_om_idx', 'table_t_o_idx');
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ rename column')} fr_om ${yellow('=>')} tO
${yellow('~ rename index')} on table table: table_fr_om_idx ${yellow(
        '=>',
      )} table_t_o_idx`,
    );
  });

  it('should recognize sql expressions by calling db', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
            actIve: t.boolean(),
          }),
          (t) => [
            t.index(
              [
                {
                  expression: `'first' || i_d || na_me || act_ive`,
                },
              ],
              'first',
              {
                where: `na_me = 'first'`,
              },
            ),
            t.index(
              [
                {
                  expression: `'second' || i_d || na_me || act_ive`,
                },
              ],
              'second',
              {
                where: `na_me = 'second'`,
              },
            ),
          ],
        );
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
            actIve: t.boolean(),
          }),
          (t) => [
            t.index(
              [
                {
                  expression: `'first'||i_d||na_me||act_ive`,
                },
              ],
              'first',
              {
                where: `na_me='first'`,
              },
            ),
            t.index(
              [
                {
                  expression: `'second'||i_d||na_me||act_ive`,
                },
              ],
              'second',
              {
                where: `na_me='second'`,
              },
            ),
          ],
        ),
      ],
    });

    await act();

    assert.migration();
  });

  it('should detect sql expression difference by calling db', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            aA: t.text(),
            bB: t.text(),
            cC: t.text(),
          }),
          (t) =>
            t.index(
              [
                {
                  expression: `(a_a || b_b) || c_c`,
                },
              ],
              'idx',
            ),
        );
      },
      tables: [
        table(
          (t) => ({
            aA: t.text(),
            bB: t.text(),
            cC: t.text(),
          }),
          (t) =>
            t.index(
              [
                {
                  expression: `a_a||c_c||b_b`,
                },
              ],
              'idx',
            ),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.index(
        [
          {
            expression: '(((a_a || b_b) || c_c))',
          },
        ],
        'idx',
      ),
    ),
    ...t.add(
      t.index(
        [
          {
            expression: 'a_a||c_c||b_b',
          },
        ],
        'idx',
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop index')} on ((((a_a || b_b) || c_c)))
  ${green('+ add index')} on (a_a||c_c||b_b)`);
  });

  describe('searchIndex', () => {
    it('should recognize a search index', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable(
            'table',
            { noPrimaryKey: true },
            (t) => ({
              titLe: t.text(),
              boDy: t.text(),
            }),
            (t) => t.searchIndex(['titLe', 'boDy']),
          );
        },
        tables: [
          table(
            (t) => ({
              titLe: t.text(),
              boDy: t.text(),
            }),
            (t) => t.searchIndex(['titLe', 'boDy']),
          ),
        ],
      });

      await act();

      assert.migration();
    });

    it('should recognize a search index with weights', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable(
            'table',
            { noPrimaryKey: true },
            (t) => ({
              titLe: t.text(),
              boDy: t.text(),
            }),
            (t) =>
              t.searchIndex([
                { column: 'titLe', weight: 'A' },
                { column: 'boDy', weight: 'B' },
              ]),
          );
        },
        tables: [
          table(
            (t) => ({
              titLe: t.text(),
              boDy: t.text(),
            }),
            (t) =>
              t.searchIndex([
                { column: 'titLe', weight: 'A' },
                { column: 'boDy', weight: 'B' },
              ]),
          ),
        ],
      });

      await act();

      assert.migration();
    });

    it('should recognize a search index with a language column', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable(
            'table',
            { noPrimaryKey: true },
            (t) => ({
              titLe: t.text(),
              boDy: t.text(),
              lang: t.type('regconfig'),
            }),
            (t) => t.searchIndex(['titLe', 'boDy'], { languageColumn: 'lang' }),
          );
        },
        tables: [
          table(
            (t) => ({
              titLe: t.text(),
              boDy: t.text(),
              lang: t.type('regconfig'),
            }),
            (t) => t.searchIndex(['titLe', 'boDy'], { languageColumn: 'lang' }),
          ),
        ],
      });

      await act();

      assert.migration();
    });
  });
});
