import { useGeneratorsTestUtils } from './generators.test-utils';
import { DbMigration } from 'rake-db';
import { colors } from 'orchid-core';
import { DefaultColumnTypes, DefaultSchemaConfig } from 'pqb';
import { sql } from 'test-utils';

jest.mock('rake-db', () => {
  return {
    ...jest.requireActual('../../../../../rake-db/src'),
    migrate: jest.fn(),
    promptSelect: jest.fn(),
  };
});
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red, yellow } = colors;

describe('columns', () => {
  const { arrange, act, assert, table, BaseTable } = useGeneratorsTestUtils();

  it('should ignore `parse`, `parseNull`, `encode`, `as`', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.identity(),
          naMe: t
            .text()
            .parse(() => 1)
            .parseNull(() => 2)
            .encode(() => 3)
            .as(t.real()),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.add(t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} naMe text`);
  });

  it('should not be dropped in ignored tables', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createTable(
          'schema.inSchemaTable',
          { noPrimaryKey: true },
          (t) => ({
            naMe: t.text(),
          }),
        );

        await db.createTable('publicTable', { noPrimaryKey: true }, (t) => ({
          naMe: t.text(),
        }));
      },
      dbOptions: {
        generatorIgnore: {
          schemas: ['schema'],
          tables: ['publicTable'],
        },
      },
      tables: [
        table(() => ({}), undefined, { name: 'schema.inSchemaTable' }),
        table(() => ({}), undefined, { name: 'publicTable' }),
      ],
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should add a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity(),
        }));
      },
      tables: [
        table((t) => ({
          iD: t.identity(),
          naMe: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    naMe: t.add(t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} naMe text`);
  });

  it('should drop a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          iD: t.identity(),
          naMe: t.text(),
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
    naMe: t.drop(t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop column')} naMe text`);
  });

  it('should change column type', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          naMe: t.integer(),
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
    naMe: t.change(t.integer(), t.text()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} naMe:
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
          unChanged: t.domain('from.custom'),
          colUmn: t.domain('from.custom'),
        }));
      },
      tables: [
        table((t) => ({
          unChanged: t.domain('from.custom').as(t.integer()),
          colUmn: t.domain('to.custom').as(t.varchar()),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.domain('from.custom'), t.domain('to.custom')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.domain('from.custom')
      ${yellow('to')}: t.domain('to.custom')`);
  });

  it('should change column nullability', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.integer().nullable(),
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
    colUmn: t.change(t.integer().nullable(), t.integer()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer()`);
  });

  it('should change text data type properties', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.varchar(10).collate('C').compression('pglz'),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.varchar(20).collate('POSIX').compression('lz4'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.varchar(10).compression('pglz').collate('C'), t.varchar(20).compression('lz4').collate('POSIX')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.varchar(10).compression('pglz').collate('C')
      ${yellow('to')}: t.varchar(20).compression('lz4').collate('POSIX')`);
  });

  it('change number data type properties', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.decimal(3, 7),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.decimal(11, 13),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.decimal(3, 7), t.decimal(11, 13)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.decimal(3, 7)
      ${yellow('to')}: t.decimal(11, 13)`);
  });

  it('change date precision', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.timestamp(3),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.timestamp(5),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.timestamp(3), t.timestamp(5)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
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

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
          colUmn: t.identity(),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.identity({
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

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.identity(), t.identity({
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
  ${yellow('~ change column')} colUmn:
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
          colUmn: t.text().comment('from'),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.text().comment('to'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.text().comment('from'), t.text().comment('to')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.text().comment('from')
      ${yellow('to')}: t.text().comment('to')`);
  });

  describe('array', () => {
    it('should add array column with empty default', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('table', { noPrimaryKey: true }, () => ({}));
        },
        tables: [
          table((t) => ({
            colUmn: t.array(t.integer()).default([]),
          })),
        ],
      });

      await act();

      assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} colUmn int4[]`);
    });

    it('change to array type: prompt if should recreate the column or abort, selecting recreate', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            colUmn: t.integer(),
          }));
        },
        tables: [
          table((t) => ({
            colUmn: t.array(t.integer()),
          })),
        ],
        selects: [0],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(t.name('col_umn').integer()),
    ...t.add(t.name('col_umn').array(t.integer())),
  }));
});
`);

      assert.report(`${yellow('~ change table')} table:
  ${red('- drop column')} colUmn integer
  ${green('+ add column')} colUmn int4[]`);
    });

    it('change from array type: prompt if should recreate the column or abort, selecting abort', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            colUmn: t.array(t.integer()),
          }));
        },
        tables: [
          table((t) => ({
            colUmn: t.integer(),
          })),
        ],
        selects: [1],
      });

      await act();

      assert.migration();
    });

    it('should not change nullable multi-dimensional array', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            column: t.array(t.array(t.decimal(5, 3))),
          }));
        },
        tables: [
          table((t) => ({
            column: t.array(t.array(t.decimal(5, 3))),
          })),
        ],
      });

      await act();

      assert.migration();
    });
  });

  describe('recreating and renaming', () => {
    const prepareDb = async (
      db: DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>,
    ) => {
      await db.createTable('table', { noPrimaryKey: true }, (t) => ({
        frOm: t.integer(),
      }));
    };

    it('should drop old and create new column when selected', async () => {
      await arrange({
        prepareDb,
        tables: [
          table((t) => ({
            tO: t.integer(),
          })),
        ],
        selects: [0],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    tO: t.add(t.integer()),
    frOm: t.drop(t.integer()),
  }));
});
`);

      assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} tO integer
  ${red('- drop column')} frOm integer`);
    });

    it('should rename column when selected', async () => {
      await arrange({
        prepareDb,
        tables: [
          table((t) => ({
            tO: t.integer(),
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

      assert.report(`${yellow('~ change table')} table:
  ${yellow('~ rename column')} frOm ${yellow('=>')} tO`);
    });

    it('should rename column when using custom name', async () => {
      await arrange({
        prepareDb,
        tables: [
          table((t) => ({
            frOm: t.name('t_o').integer(),
          })),
        ],
        selects: [1],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    frOm: t.rename('t_o'),
  }));
});
`);

      assert.report(`${yellow('~ change table')} table:
  ${yellow('~ rename column')} frOm ${yellow('=>')} t_o`);
    });
  });

  it('should rename and change a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          frOm: t.text(),
        }));
      },
      tables: [
        table((t) => ({
          tO: t.string(),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    frOm: t.change(t.text(), t.name('t_o').string()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} frOm:
    ${yellow('from')}: t.text()
      ${yellow('to')}: t.name('t_o').string()`);
  });

  it('should ignore computed columns', async () => {
    await arrange({
      tables: [
        class UserTable extends BaseTable {
          readonly table = 'table';
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
            firstName: t.string(),
            lastName: t.string(),
          }));

          computed = this.setComputed((q) => ({
            one: sql`${q.column('firstName')} || ' ' || ${q.column(
              'lastName',
            )}`.type((t) => t.string()),
            two: q.computeAtRuntime(
              // define columns that it depends on
              ['firstName', 'lastName'],
              // only columns defined above are available in the callback
              (record) => `${record.firstName} ${record.lastName}`,
            ),
          }));
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));
});
`);

    assert.report(`${green('+ create table')} table (3 columns)`);
  });

  describe('generated', () => {
    it('should support generated column', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            nUm: t.integer(),
          }));
        },
        tables: [
          table((t) => ({
            nUm: t.integer(),
            genErated: t.integer().generated`n_um + n_um`,
          })),
        ],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    genErated: t.add(t.integer().generated\`n_um + n_um\`),
  }));
});
`);

      assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} genErated integer`);
    });

    it('should support generated tsvector column', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            aA: t.text(),
            bB: t.text(),
          }));
        },
        tables: [
          table((t) => ({
            aA: t.text(),
            bB: t.text(),
            tV: t.tsvector().generated('spanish', ['aA', 'bB']),
          })),
        ],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    tV: t.add(t.tsvector().generated('spanish', ['aA', 'bB'])),
  }));
});
`);

      assert.report(`${yellow('~ change table')} table:
  ${green('+ add column')} tV tsvector`);
    });

    it('should not recreate generated tsvector column', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            aA: t.text(),
            bB: t.text(),
            tV: t.tsvector().generated('spanish', ['aA', 'bB']),
          }));
        },
        tables: [
          table((t) => ({
            aA: t.text(),
            bB: t.text(),
            tV: t.tsvector().generated('spanish', ['aA', 'bB']),
          })),
        ],
      });

      await act();

      assert.migration();
    });
  });

  describe('custom column type', () => {
    it('should create a column with a custom type', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createExtension('vector');
        },
        dbOptions: {
          generatorIgnore: {
            extensions: ['vector'],
          },
        },
        tables: [
          table((t) => ({
            colUmn: t.type('vector(123)'),
          })),
        ],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'table',
    {
      noPrimaryKey: true,
    },
    (t) => ({
      colUmn: t.type('vector(123)'),
    }),
  );
});
`);

      assert.report(
        `${green('+ create table')} table (1 column, no primary key)`,
      );
    });

    it('should change a column with a custom type', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createExtension('vector');

          await db.createTable('table', { noPrimaryKey: true }, (t) => ({
            colUmn: t.type('vector(123)'),
          }));
        },
        dbOptions: {
          generatorIgnore: {
            extensions: ['vector'],
          },
        },
        tables: [
          table((t) => ({
            colUmn: t.type('vector(456)'),
          })),
        ],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.type('vector(123)'), t.type('vector(456)')),
  }));
});
`);

      assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.type('vector(123)')
      ${yellow('to')}: t.type('vector(456)')`);
    });
  });
});
