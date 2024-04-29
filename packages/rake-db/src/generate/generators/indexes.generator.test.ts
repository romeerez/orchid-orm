import { generatorsTestUtils } from './generators.test-utils';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';
import { IndexColumnOptionsForColumn, IndexOptions } from 'pqb';
import { DbStructure } from '../dbStructure';
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

  const columnOptions: IndexColumnOptionsForColumn = {
    collate: 'collate',
    opclass: 'opclass',
    order: 'order',
  };

  const columnOptionsSql = `collate: 'collate',
            opclass: 'opclass',
            order: 'order',`;

  const indexOptions = {
    name: 'name',
    unique: true,
    nullsNotDistinct: true,
    using: 'using',
    include: ['include'],
    tablespace: 'tablespace',
  } satisfies IndexOptions;

  const indexOptionsSql = `{
        name: 'name',
        using: 'using',
        nullsNotDistinct: true,
        include: ['include'],
        tablespace: 'tablespace',
      }`;

  const indexOptionsSqlShifted = indexOptionsSql.replaceAll('\n', '\n  ');

  it('should create a column index', async () => {
    arrange({
      tables: [
        table((t) => ({
          name: t.text().index({
            ...columnOptions,
            ...indexOptions,
          }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.textColumn({ name: 'name' })],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

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
    arrange({
      tables: [
        table((t) => ({
          name: t.text(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.textColumn({ name: 'name' })],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [{ column: 'name' }],
            ...indexOptions,
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

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
    arrange({
      tables: [
        table((t) => ({
          name: t.text().index({ name: 'to' }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.textColumn({ name: 'name' })],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [{ column: 'name' }],
            name: 'from',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameIndex('public.table', 'from', 'to');
});
`);

    assert.report(
      `${yellow('~ rename index')} on table table: from ${yellow('=>')} to`,
    );
  });

  it('should not be recreated when column index is identical', async () => {
    arrange({
      tables: [
        table((t) => ({
          name: t.text().index({
            ...columnOptions,
            ...indexOptions,
          }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.textColumn({ name: 'name' })],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                column: 'name',
                ...columnOptions,
              },
            ],
            ...indexOptions,
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  it('should recreate a column index with different options', async () => {
    arrange({
      tables: [
        table((t) => ({
          name: t.text().index({
            collate: 'collate2',
            opclass: 'opclass2',
            order: 'order2',
            name: 'name2',
            unique: false,
            using: 'using2',
            nullsNotDistinct: false,
            include: ['include2'],
            with: 'with2',
            tablespace: 'tablespace2',
            where: 'where2',
          }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.textColumn({ name: 'name' })],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                column: 'name',
                ...columnOptions,
              },
            ],
            ...indexOptions,
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
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
    ...t.add(
      t.index(
        [
          {
            column: 'name',
            collate: 'collate2',
            opclass: 'opclass2',
            order: 'order2',
          },
        ],
        {
          name: 'name2',
          using: 'using2',
          include: ['include2'],
          with: 'with2',
          tablespace: 'tablespace2',
          where: 'where2',
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (name)
  ${green('+ add index')} on (name)`);
  });

  it('should create a composite index', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.integer(),
          b: t.text(),
          ...t.unique(
            [
              'a',
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            indexOptions,
          ),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.unique(
        [
          'a',
          {
            column: 'b',
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
  ${green('+ add unique index')} on (a, b)`);
  });

  it('should drop a composite index', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.integer(),
          b: t.text(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                column: 'a',
              },
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            ...indexOptions,
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.unique(
        [
          'a',
          {
            column: 'b',
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
  ${red('- drop unique index')} on (a, b)`);
  });

  it('should not recreate composite index when it is identical', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.integer(),
          b: t.text(),
          ...t.unique(
            [
              'a',
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            indexOptions,
          ),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                column: 'a',
              },
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            ...indexOptions,
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  it('should recreate composite index', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.integer(),
          b: t.text(),
          ...t.unique(
            [
              'a',
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            indexOptions,
          ),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                column: 'a',
              },
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            ...indexOptions,
            unique: false,
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.index(
        [
          'a',
          {
            column: 'b',
            ${columnOptionsSql}
          },
        ],
        ${indexOptionsSqlShifted},
      ),
    ),
    ...t.add(
      t.unique(
        [
          'a',
          {
            column: 'b',
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
  ${red('- drop index')} on (a, b)
  ${green('+ add unique index')} on (a, b)`);
  });

  it('should rename a composite index', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.integer(),
          b: t.text(),
          ...t.unique(
            [
              'a',
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            { ...indexOptions, name: 'to' },
          ),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                column: 'a',
              },
              {
                column: 'b',
                ...columnOptions,
              },
            ],
            ...indexOptions,
            name: 'from',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameIndex('public.table', 'from', 'to');
});
`);

    assert.report(
      `${yellow('~ rename index')} on table table: from ${yellow('=>')} to`,
    );
  });

  it('should be added together with a column', async () => {
    arrange({
      tables: [
        table((t) => ({
          name: t.text().index(),
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
    arrange({
      tables: [table()],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.textColumn({ name: 'name' })],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [{ column: 'name' }],
            name: 'table_name_idx',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

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
    arrange({
      tables: [
        table((t) => ({
          name: t.text().index(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'name' })],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

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
    arrange({
      tables: [
        table((t) => ({
          to: t.text().index(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.textColumn({ name: 'from' })],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [{ column: 'from' }],
            name: 'table_from_idx',
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
    arrange({
      tables: [
        table((t) => ({
          id: t.integer(),
          name: t.text(),
          active: t.boolean(),
          ...t.index(
            {
              expression: `'first'||id||name||active`,
            },
            {
              name: 'first',
              with: `'first'`,
              where: `'first'`,
            },
          ),
          ...t.index(
            {
              expression: `'second'||id||name||active`,
            },
            {
              name: 'second',
              with: `'second'`,
              where: `'second'`,
            },
          ),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({ name: 'id' }),
              dbStructureMockFactory.textColumn({ name: 'name' }),
              dbStructureMockFactory.column({
                name: 'active',
                type: 'boolean',
              }),
            ],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [{ expression: `'second' || id || name || active` }],
            name: 'second',
            with: `'second'`,
            where: `'second'`,
          }),
          dbStructureMockFactory.index({
            columns: [{ expression: `'first' || id || name || active` }],
            name: 'first',
            with: `'first'`,
            where: `'first'`,
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  it('should detect sql expression difference by calling db', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.integer(),
          name: t.text(),
          active: t.boolean(),
          ...t.index(
            {
              expression: `id||active||name`,
            },
            {
              name: 'idx',
            },
          ),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({ name: 'id' }),
              dbStructureMockFactory.textColumn({ name: 'name' }),
              dbStructureMockFactory.column({
                name: 'active',
                type: 'boolean',
              }),
            ],
          }),
        ],
        indexes: [
          dbStructureMockFactory.index({
            columns: [{ expression: '(id || name) || active' }],
            name: 'idx',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.index(
        [
          {
            expression: '(id || name) || active',
          },
        ],
        {
          name: 'idx',
        },
      ),
    ),
    ...t.add(
      t.index(
        [
          {
            expression: 'id||active||name',
          },
        ],
        {
          name: 'idx',
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop index')} on ((id || name) || active)
  ${green('+ add index')} on (id||active||name)`);
  });

  describe('searchIndex', () => {
    const dbSearchIndex = (data: Partial<DbStructure.Index>) =>
      dbStructureMockFactory.index({
        columns: [
          {
            column: 'title',
          },
          {
            column: 'body',
          },
        ],
        tsVector: true,
        name: 'table_title_body_idx',
        ...data,
      });

    it('should recognize a search index', async () => {
      arrange({
        tables: [
          table((t) => ({
            title: t.text(),
            body: t.text(),
            ...t.searchIndex(['title', 'body']),
          })),
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: ['title', 'body'].map((name) =>
                dbStructureMockFactory.textColumn({ name }),
              ),
            }),
          ],
          indexes: [
            dbSearchIndex({
              language: 'english',
            }),
          ],
        }),
      });

      await act();

      assert.migration();
    });

    it('should recognize a search index with weights', async () => {
      arrange({
        tables: [
          table((t) => ({
            title: t.text(),
            body: t.text(),
            ...t.searchIndex([
              { column: 'title', weight: 'A' },
              { column: 'body', weight: 'B' },
            ]),
          })),
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: ['title', 'body'].map((name) =>
                dbStructureMockFactory.textColumn({ name }),
              ),
            }),
          ],
          indexes: [
            dbSearchIndex({
              columns: [
                {
                  column: 'title',
                  weight: 'A',
                },
                {
                  column: 'body',
                  weight: 'B',
                },
              ],
              language: 'english',
            }),
          ],
        }),
      });

      await act();

      assert.migration();
    });

    it('should recognize a search index with a language column', async () => {
      arrange({
        tables: [
          table((t) => ({
            title: t.text(),
            body: t.text(),
            lang: t.type('regconfig'),
            ...t.searchIndex(['title', 'body'], { languageColumn: 'lang' }),
          })),
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                ...['title', 'body'].map((name) =>
                  dbStructureMockFactory.textColumn({ name }),
                ),
                dbStructureMockFactory.column({
                  name: 'lang',
                  type: 'regconfig',
                }),
              ],
            }),
          ],
          indexes: [
            dbSearchIndex({
              languageColumn: 'lang',
            }),
          ],
        }),
      });

      await act();

      assert.migration();
    });
  });
});
