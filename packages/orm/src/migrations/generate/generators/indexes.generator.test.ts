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
    include: ['name'],
  } satisfies TableData.Index.Options;

  const indexOptionsSql = `{
        nullsNotDistinct: true,
        include: ['name'],
      }`;

  const indexOptionsSqlShifted = indexOptionsSql.replaceAll('\n', '\n  ');

  it('should create a column index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          name: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          name: t.text().index({
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
            column: 'name',
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
  ${green('+ add unique index')} on (name)`);
  });

  it('should drop a column index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          name: t.text().index(indexOptions),
        }));
      },
      tables: [
        table((t) => ({
          name: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.unique(['name'], ${indexOptionsSql})
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (name)`);
  });

  it('should rename an index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          name: t.text().index('from'),
        }));
      },
      tables: [
        table((t) => ({
          name: t.text().index('to'),
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
            name: t.text(),
          }),
          (t) => t.index([{ column: 'name', ...columnOptions }], indexOptions),
        );
      },
      tables: [
        table((t) => ({
          name: t.text().index({
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
          name: t.text().index(indexOptions),
        }));
      },
      tables: [
        table((t) => ({
          name: t.text().index({ ...indexOptions, unique: false }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.unique(['name'], ${indexOptionsSql})
    ),
    ...t.add(
      t.index(['name'], ${indexOptionsSql})
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (name)
  ${green('+ add index')} on (name)`);
  });

  it('should create a composite index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          id: t.integer(),
          name: t.text(),
        }));
      },
      tables: [
        table(
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'id',
                {
                  column: 'name',
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
          'id',
          {
            column: 'name',
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
  ${green('+ add unique index')} on (id, name)`);
  });

  it('should drop a composite index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.index(
              [{ column: 'id' }, { column: 'name', ...columnOptions }],
              indexOptions,
            ),
        );
      },
      tables: [
        table((t) => ({
          id: t.integer(),
          name: t.text(),
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
          'id',
          {
            column: 'name',
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
  ${red('- drop unique index')} on (id, name)`);
  });

  it('should not recreate composite index when it is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.unique(
              [{ column: 'id' }, { column: 'name', ...columnOptions }],
              indexOptions,
            ),
        );
      },
      tables: [
        table(
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'id',
                {
                  column: 'name',
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
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.index([{ column: 'id' }, { column: 'name', ...columnOptions }], {
              ...indexOptions,
              unique: false,
            }),
        );
      },
      tables: [
        table(
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'id',
                {
                  column: 'name',
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
          'id',
          {
            column: 'name',
            ${columnOptionsSql}
          },
        ],
        ${indexOptionsSqlShifted},
      ),
    ),
    ...t.add(
      t.unique(
        [
          'id',
          {
            column: 'name',
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
  ${red('- drop index')} on (id, name)
  ${green('+ add unique index')} on (id, name)`);
  });

  it('should rename a composite index', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.index(
              [{ column: 'id' }, { column: 'name', ...columnOptions }],
              'from',
              indexOptions,
            ),
        );
      },
      tables: [
        table(
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          (t) =>
            t.unique(
              [
                'id',
                {
                  column: 'name',
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
          name: t.text().index(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.add(t.text().index()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add column')} name text, has index`,
    );
  });

  it('should be dropped together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          name: t.text().index(),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.drop(t.text().index()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop column')} name text, has index`,
    );
  });

  it('should be added in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          name: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          name: t.text().index(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.change(t.integer(), t.text().index()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} name:
    ${yellow('from')}: t.integer()
      ${yellow('to')}: t.text().index()`,
    );
  });

  it('should not be recreated when a column is renamed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          from: t.text().index(),
        }));
      },
      tables: [
        table((t) => ({
          to: t.text().index(),
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

  await db.renameIndex('public.table', 'table_from_idx', 'table_to_idx');
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ rename column')} from ${yellow('=>')} to
${yellow('~ rename index')} on table table: table_from_idx ${yellow(
        '=>',
      )} table_to_idx`,
    );
  });

  it('should recognize sql expressions by calling db', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            id: t.integer(),
            name: t.text(),
            active: t.boolean(),
          }),
          (t) => [
            t.index(
              [
                {
                  expression: `'first' || id || name || active`,
                },
              ],
              'first',
              {
                where: `name = 'first'`,
              },
            ),
            t.index(
              [
                {
                  expression: `'second' || id || name || active`,
                },
              ],
              'second',
              {
                where: `name = 'second'`,
              },
            ),
          ],
        );
      },
      tables: [
        table(
          (t) => ({
            id: t.integer(),
            name: t.text(),
            active: t.boolean(),
          }),
          (t) => [
            t.index(
              [
                {
                  expression: `'first'||id||name||active`,
                },
              ],
              'first',
              {
                where: `name='first'`,
              },
            ),
            t.index(
              [
                {
                  expression: `'second'||id||name||active`,
                },
              ],
              'second',
              {
                where: `name='second'`,
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
            a: t.text(),
            b: t.text(),
            c: t.text(),
          }),
          (t) =>
            t.index(
              [
                {
                  expression: `(a || b) || c`,
                },
              ],
              'idx',
            ),
        );
      },
      tables: [
        table(
          (t) => ({
            a: t.text(),
            b: t.text(),
            c: t.text(),
          }),
          (t) =>
            t.index(
              [
                {
                  expression: `a||c||b`,
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
            expression: '(((a || b) || c))',
          },
        ],
        'idx',
      ),
    ),
    ...t.add(
      t.index(
        [
          {
            expression: 'a||c||b',
          },
        ],
        'idx',
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop index')} on ((((a || b) || c)))
  ${green('+ add index')} on (a||c||b)`);
  });

  describe('searchIndex', () => {
    it('should recognize a search index', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable(
            'table',
            { noPrimaryKey: true },
            (t) => ({
              title: t.text(),
              body: t.text(),
            }),
            (t) => t.searchIndex(['title', 'body']),
          );
        },
        tables: [
          table(
            (t) => ({
              title: t.text(),
              body: t.text(),
            }),
            (t) => t.searchIndex(['title', 'body']),
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
              title: t.text(),
              body: t.text(),
            }),
            (t) =>
              t.searchIndex([
                { column: 'title', weight: 'A' },
                { column: 'body', weight: 'B' },
              ]),
          );
        },
        tables: [
          table(
            (t) => ({
              title: t.text(),
              body: t.text(),
            }),
            (t) =>
              t.searchIndex([
                { column: 'title', weight: 'A' },
                { column: 'body', weight: 'B' },
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
              title: t.text(),
              body: t.text(),
              lang: t.type('regconfig'),
            }),
            (t) => t.searchIndex(['title', 'body'], { languageColumn: 'lang' }),
          );
        },
        tables: [
          table(
            (t) => ({
              title: t.text(),
              body: t.text(),
              lang: t.type('regconfig'),
            }),
            (t) => t.searchIndex(['title', 'body'], { languageColumn: 'lang' }),
          ),
        ],
      });

      await act();

      assert.migration();
    });
  });
});
