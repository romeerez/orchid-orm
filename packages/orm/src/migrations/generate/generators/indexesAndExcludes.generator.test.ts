import { useGeneratorsTestUtils } from './generators.test-utils';
import { TableData, colors } from 'pqb';

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

describe('indexes', () => {
  const { arrange, act, assert, table, BaseTable } = useGeneratorsTestUtils();

  const columnOptions: TableData.Index.ColumnOptions = {
    collate: 'C',
    opclass: 'varchar_ops',
    order: 'DESC',
  };

  const columnOptionsSql = `collate: 'C',
            opclass: 'varchar_ops',
            order: 'DESC',`;

  const excludeOptions = {
    include: ['naMe'],
  } satisfies TableData.Exclude.Options;

  const indexOptions = {
    ...excludeOptions,
    unique: true,
    nullsNotDistinct: true,
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

  it('should properly quote a geography type, not detect any changes', async () => {
    await arrange({
      dbOptions: {
        extensions: ['postgis'],
        generatorIgnore: {
          tables: ['spatial_ref_sys'],
        },
      },
      async prepareDb(db) {
        await db.createExtension('postgis');

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.geography
            .point()
            .nullable()
            .index({ where: `"col_umn" IS NOT NULL` }),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.geography
            .point()
            .nullable()
            .index({ where: `"col_umn" IS NOT NULL` }),
        })),
      ],
    });

    await act();

    assert.migration();
  });

  it('should properly quote an array type, not detect any changes', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t
            .array(t.integer())
            .nullable()
            .index({ where: `"col_umn" IS NOT NULL` }),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t
            .array(t.integer())
            .nullable()
            .index({ where: `"col_umn" IS NOT NULL` }),
        })),
      ],
    });

    await act();

    assert.migration();
  });

  it('should not be dropped in ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createTable(
          'schema.inSchemaTable',
          { noPrimaryKey: true },
          (t) => ({
            naMe: t.text().index(indexOptions).exclude('=', excludeOptions),
          }),
        );

        await db.createTable('publicTable', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index(indexOptions).exclude('=', excludeOptions),
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
            naMe: t.text(),
          }),
          undefined,
          { name: 'schema.inSchemaTable' },
        ),
        table(
          (t) => ({
            naMe: t.text(),
          }),
          undefined,
          { name: 'publicTable' },
        ),
      ],
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should create a column index and exclude', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t
            .text()
            .index({
              ...columnOptions,
              ...indexOptions,
            })
            .exclude('=', {
              ...columnOptions,
              ...excludeOptions,
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
    ...t.add(
      t.exclude(
        [
          {
            column: 'naMe',
            collate: 'C',
            opclass: 'varchar_ops',
            order: 'DESC',
            with: '=',
          },
        ],
        {
          include: ['naMe'],
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add unique index')} on (naMe)
  ${green('+ add exclude')} on (naMe)`);
  });

  it('should handle different `using` casing properly', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          nUm: t.integer(),
        }));
      },
      tables: [
        table((t) => ({
          nUm: t
            .integer()
            .index({ using: 'BtReE' })
            .exclude('=', { using: 'BtReE' }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.index(['nUm'])
    ),
    ...t.add(
      t.exclude(
        [
          {
            column: 'nUm',
            with: '=',
          },
        ]
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add index')} on (nUm)
  ${green('+ add exclude')} on (nUm)`);
  });

  it('should drop a column index and exclude', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index(indexOptions).exclude('=', excludeOptions),
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
    ...t.drop(
      t.exclude(
        [
          {
            column: 'na_me',
            with: '=',
          },
        ],
        {
          include: ['na_me'],
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (na_me)
  ${red('- drop exclude')} on (na_me)`);
  });

  it('should rename an index and an exclude', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t
            .text()
            .index({ name: 'from' })
            .exclude('=', { name: 'exclude_from' }),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t
            .text()
            .index({ name: 'to' })
            .exclude('=', { name: 'exclude_to' }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameIndex('public.table', 'from', 'to');

  await db.renameConstraint('public.table', 'exclude_from', 'exclude_to');
});
`);

    assert.report(
      `${yellow('~ rename index')} on table table: from ${yellow('=>')} to
${yellow('~ rename constraint')} on table table: exclude_from ${yellow(
        '=>',
      )} exclude_to`,
    );
  });

  it('should not be recreated when column index and exclude is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            naMe: t.text(),
          }),
          (t) => [
            t.index([{ column: 'naMe', ...columnOptions }], indexOptions),
            t.exclude(
              [{ column: 'naMe', ...columnOptions, with: '=' }],
              excludeOptions,
            ),
          ],
        );
      },
      tables: [
        table((t) => ({
          naMe: t
            .text()
            .index({
              ...columnOptions,
              ...indexOptions,
            })
            .exclude('=', {
              ...columnOptions,
              ...excludeOptions,
            }),
        })),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate a column index and a column exclude with different options', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index(indexOptions).exclude('=', excludeOptions),
        }));
      },
      tables: [
        table((t) => ({
          naMe: t
            .text()
            .index({ ...indexOptions, unique: false })
            .exclude('=', { ...excludeOptions, include: [] }),
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
    ...t.drop(
      t.exclude(
        [
          {
            column: 'na_me',
            with: '=',
          },
        ],
        {
          include: ['na_me'],
        },
      ),
    ),
    ...t.add(
      t.index(['naMe'], ${indexOptionsSql})
    ),
    ...t.add(
      t.exclude(
        [
          {
            column: 'naMe',
            with: '=',
          },
        ],
        {
          include: [],
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (na_me)
  ${red('- drop exclude')} on (na_me)
  ${green('+ add index')} on (naMe)
  ${green('+ add exclude')} on (naMe)`);
  });

  it('should create a composite index and exclude', async () => {
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
          (t) => [
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
            t.exclude(
              [
                { column: 'iD', with: '=' },
                { column: 'naMe', with: '=' },
              ],
              excludeOptions,
            ),
          ],
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
    ...t.add(
      t.exclude(
        [
          {
            column: 'iD',
            with: '=',
          },
          {
            column: 'naMe',
            with: '=',
          },
        ],
        {
          include: ['naMe'],
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add unique index')} on (iD, naMe)
  ${green('+ add exclude')} on (iD, naMe)`);
  });

  it('should drop a composite index exclude', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) => [
            t.index(
              [{ column: 'iD' }, { column: 'naMe', ...columnOptions }],
              indexOptions,
            ),
            t.exclude(
              [
                { column: 'iD', with: '=' },
                { column: 'naMe', ...columnOptions, with: '=' },
              ],
              indexOptions,
            ),
          ],
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
    ...t.drop(
      t.exclude(
        [
          {
            column: 'i_d',
            with: '=',
          },
          {
            column: 'na_me',
            ${columnOptionsSql}
            with: '=',
          },
        ],
        {
          include: ['na_me'],
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop unique index')} on (i_d, na_me)
  ${red('- drop exclude')} on (i_d, na_me)`);
  });

  it('should not recreate composite index and exclude when it is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) => [
            t.unique(
              [{ column: 'iD' }, { column: 'naMe', ...columnOptions }],
              indexOptions,
            ),
            t.exclude(
              [
                { column: 'iD', with: '=' },
                { column: 'naMe', ...columnOptions, with: '=' },
              ],
              excludeOptions,
            ),
          ],
        );
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) => [
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
            t.exclude(
              [
                { column: 'iD', with: '=' },
                {
                  column: 'naMe',
                  ...columnOptions,
                  with: '=',
                },
              ],
              excludeOptions,
            ),
          ],
        ),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate composite index and exclude', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) => [
            t.index([{ column: 'iD' }, { column: 'naMe', ...columnOptions }], {
              ...indexOptions,
              unique: false,
            }),
            t.exclude(
              [
                { column: 'iD', with: '=' },
                { column: 'naMe', ...columnOptions, with: '=' },
              ],
              excludeOptions,
            ),
          ],
        );
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) => [
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
            t.exclude(
              [
                { column: 'iD', with: '=' },
                {
                  column: 'naMe',
                  ...columnOptions,
                  with: '=',
                },
              ],
              { ...excludeOptions, include: [] },
            ),
          ],
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
    ...t.drop(
      t.exclude(
        [
          {
            column: 'i_d',
            with: '=',
          },
          {
            column: 'na_me',
            ${columnOptionsSql}
            with: '=',
          },
        ],
        {
          include: ['na_me'],
        },
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
    ...t.add(
      t.exclude(
        [
          {
            column: 'iD',
            with: '=',
          },
          {
            column: 'naMe',
            ${columnOptionsSql}
            with: '=',
          },
        ],
        {
          include: [],
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop index')} on (i_d, na_me)
  ${red('- drop exclude')} on (i_d, na_me)
  ${green('+ add unique index')} on (iD, naMe)
  ${green('+ add exclude')} on (iD, naMe)`);
  });

  it('should rename a composite index and exclude', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) => [
            t.index([{ column: 'iD' }, { column: 'naMe', ...columnOptions }], {
              ...indexOptions,
              name: 'from',
            }),
            t.exclude(
              [
                { column: 'iD', with: '=' },
                { column: 'naMe', ...columnOptions, with: '=' },
              ],
              { ...excludeOptions, name: 'exclude_from' },
            ),
          ],
        );
      },
      tables: [
        table(
          (t) => ({
            iD: t.integer(),
            naMe: t.text(),
          }),
          (t) => [
            t.unique(
              [
                'iD',
                {
                  column: 'naMe',
                  ...columnOptions,
                },
              ],
              { ...indexOptions, name: 'to' },
            ),
            t.exclude(
              [
                { column: 'iD', with: '=' },
                {
                  column: 'naMe',
                  ...columnOptions,
                  with: '=',
                },
              ],
              { ...excludeOptions, name: 'exclude_to' },
            ),
          ],
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameIndex('public.table', 'from', 'to');

  await db.renameConstraint('public.table', 'exclude_from', 'exclude_to');
});
`);

    assert.report(
      `${yellow('~ rename index')} on table table: from ${yellow('=>')} to
${yellow('~ rename constraint')} on table table: exclude_from ${yellow(
        '=>',
      )} exclude_to`,
    );
  });

  it('should be added together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        table((t) => ({
          naMe: t.text().index().exclude('='),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.add(t.text().index().exclude('=')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add column')} naMe text, has index, has exclude`,
    );
  });

  it('should be dropped together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.text().index().exclude('='),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.drop(t.text().index().exclude('=')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop column')} naMe text, has index, has exclude`,
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
          naMe: t.text().index().exclude('='),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.change(t.integer(), t.text().index().exclude('=')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} naMe:
    ${yellow('from')}: t.integer()
      ${yellow('to')}: t.text().index().exclude('=')`,
    );
  });

  it('should not be recreated when a column is renamed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          frOm: t.text().index().exclude('='),
        }));
      },
      tables: [
        table((t) => ({
          tO: t.text().index().exclude('='),
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

  await db.renameIndex('public.table', 'table_fr_om_idx', 'table_t_o_idx');

  await db.renameConstraint('public.table', 'table_fr_om_exclude', 'table_t_o_exclude');
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ rename column')} frOm ${yellow('=>')} tO
${yellow('~ rename index')} on table table: table_fr_om_idx ${yellow(
        '=>',
      )} table_t_o_idx
${yellow('~ rename constraint')} on table table: table_fr_om_exclude ${yellow(
        '=>',
      )} table_t_o_exclude`,
    );
  });

  it('should change index and exclude together with a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.varchar(100).index().exclude('='),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t
            .text()
            .index({ nullsNotDistinct: true })
            .exclude('=', { include: ['colUmn'] }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.varchar(100).index().exclude('='), t.text().index({
      nullsNotDistinct: true,
    }).exclude('=', {
      include: ['colUmn'],
    })),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.varchar(100).index().exclude('=')
      ${yellow('to')}: t.text().index({
      nullsNotDistinct: true,
    }).exclude('=', {
      include: ['colUmn'],
    })`,
    );
  });

  it('should not be added during a unrelated column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.varchar(100).index().exclude('='),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.text().index().exclude('='),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.varchar(100), t.text()),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.varchar(100)
      ${yellow('to')}: t.text()`,
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
              {
                name: 'first',
                where: `na_me = 'first'`,
              },
            ),
            t.index(
              [
                {
                  expression: `'second' || i_d || na_me || act_ive`,
                },
              ],
              {
                name: 'second',
                where: `na_me = 'second'`,
              },
            ),
            t.exclude([
              {
                expression: `'first' || i_d || na_me || act_ive`,
                with: '=',
              },
            ]),
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
              {
                name: 'first',
                where: `na_me='first'`,
              },
            ),
            t.index(
              [
                {
                  expression: `'second'||i_d||na_me||act_ive`,
                },
              ],
              {
                name: 'second',
                where: `na_me='second'`,
              },
            ),
            t.exclude([
              {
                expression: `'first'||i_d||na_me||act_ive`,
                with: '=',
              },
            ]),
          ],
        ),
      ],
    });

    await act();

    assert.migration();
  });

  it('should properly quote the enum name in the `where` expression', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createEnum('numbers', ['one', 'two', 'three']);

        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            colUmn: t.enum('numbers'),
          }),
          (t) =>
            t.unique(['colUmn'], {
              where: `(col_umn = 'one'::"numbers")`,
            }),
        );
      },
      tables: [
        table(
          (t) => ({
            colUmn: t.enum('numbers', ['one', 'two', 'three']),
          }),
          (t) =>
            t.unique(['colUmn'], {
              where: `(col_umn = 'one'::"numbers")`,
            }),
        ),
      ],
    });

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
          (t) => [
            t.index(
              [
                {
                  expression: `(a_a || b_b) || c_c`,
                },
              ],
              { name: 'idx' },
            ),
            t.exclude([
              {
                expression: `(a_a || b_b) || c_c`,
                with: '=',
              },
            ]),
          ],
        );
      },
      tables: [
        table(
          (t) => ({
            aA: t.text(),
            bB: t.text(),
            cC: t.text(),
          }),
          (t) => [
            t.index(
              [
                {
                  expression: `a_a||c_c||b_b`,
                },
              ],
              { name: 'idx' },
            ),
            t.exclude([
              {
                expression: `a_a||c_c||b_b`,
                with: '=',
              },
            ]),
          ],
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
        {
          name: 'idx',
        },
      ),
    ),
    ...t.drop(
      t.exclude(
        [
          {
            expression: '(((a_a || b_b) || c_c))',
            with: '=',
          },
        ]
      ),
    ),
    ...t.add(
      t.index(
        [
          {
            expression: 'a_a||c_c||b_b',
          },
        ],
        {
          name: 'idx',
        },
      ),
    ),
    ...t.add(
      t.exclude(
        [
          {
            expression: 'a_a||c_c||b_b',
            with: '=',
          },
        ]
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop index')} on ((((a_a || b_b) || c_c)))
  ${red('- drop exclude')} on ((((a_a || b_b) || c_c)))
  ${green('+ add index')} on (a_a||c_c||b_b)
  ${green('+ add exclude')} on (a_a||c_c||b_b)`);
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

  it('should compact long index and exclude names', async () => {
    await arrange({
      tables: [
        class Table extends BaseTable {
          table = 'reallyLongTableNameConsistingOfSeveralWords';
          noPrimaryKey = true;
          columns = this.setColumns(
            (t) => ({
              longNameForTheFirstColumn: t.integer(),
              longNameForTheSecondColumn: t.integer(),
            }),
            (t) => [
              t.unique([
                'longNameForTheFirstColumn',
                'longNameForTheSecondColumn',
              ]),
              t.exclude([
                { column: 'longNameForTheFirstColumn', with: '=' },
                { column: 'longNameForTheSecondColumn', with: '=' },
              ]),
            ],
          );
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'reallyLongTableNameConsistingOfSeveralWords',
    {
      noPrimaryKey: true,
    },
    (t) => ({
      longNameForTheFirstColumn: t.integer(),
      longNameForTheSecondColumn: t.integer(),
    }),
    (t) => [
      t.unique(['longNameForTheFirstColumn', 'longNameForTheSecondColumn']),
      t.exclude(
        [
          {
            column: 'longNameForTheFirstColumn',
            with: '=',
          },
          {
            column: 'longNameForTheSecondColumn',
            with: '=',
          },
        ]
      ),
    ],
  );
});
`);

    assert.report(
      `${green(
        '+ create table',
      )} reallyLongTableNameConsistingOfSeveralWords (2 columns, 1 index, 1 exclude, no primary key)`,
    );
  });
});
