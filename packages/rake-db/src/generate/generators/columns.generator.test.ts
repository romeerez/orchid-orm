import { generatorsTestUtils } from './generators.test-utils';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';
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

describe('columns', () => {
  beforeEach(jest.clearAllMocks);

  it('should add a column', async () => {
    arrange({
      tables: [
        table((t) => ({
          id: t.identity(),
          name: t.text(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.identityColumn({ name: 'id' })],
          }),
        ],
      }),
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
    arrange({
      tables: [
        table((t) => ({
          id: t.identity(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({ name: 'id' }),
              dbStructureMockFactory.textColumn({ name: 'name' }),
            ],
          }),
        ],
      }),
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
            columns: [dbStructureMockFactory.intColumn({ name: 'name' })],
          }),
        ],
      }),
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
    arrange({
      tables: [
        table((t) => ({
          column: t.type('to.custom').as(t.integer()),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.column({
                typeSchema: 'from',
                type: 'custom',
              }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.type('from.custom'), t.type('to.custom')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.type('from.custom')
      ${yellow('to')}: t.type('to.custom')`);
  });

  it('should change column nullability', async () => {
    arrange({
      tables: [
        table((t) => ({
          column: t.integer(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({
                name: 'column',
                isNullable: true,
              }),
            ],
          }),
        ],
      }),
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
    arrange({
      tables: [
        table((t) => ({
          column: t.varchar(20).collate('toCollation').compression('l'),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.column({
                type: 'varchar',
                maxChars: 10,
                collate: 'fromCollation',
                compression: 'p',
              }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.varchar(10).compression('p').collate('fromCollation'), t.varchar(20).compression('l').collate('toCollation')),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.varchar(10).compression('p').collate('fromCollation')
      ${yellow('to')}: t.varchar(20).compression('l').collate('toCollation')`);
  });

  it('change number data type properties', async () => {
    arrange({
      tables: [
        table((t) => ({
          column: t.decimal(11, 13),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.column({
                type: 'decimal',
                numericPrecision: 3,
                numericScale: 7,
              }),
            ],
          }),
        ],
      }),
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
    arrange({
      tables: [
        table((t) => ({
          column: t.timestamp(13),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.column({
                type: 'timestamptz',
                dateTimePrecision: 7,
              }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.timestamp(7), t.timestamp(13)),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.timestamp(7)
      ${yellow('to')}: t.timestamp(13)`);
  });

  it('change default', async () => {
    arrange({
      tables: [
        table((t) => ({
          valueNotChanged: t.integer().default(1),
          valueChanged: t.integer().default(3),
          ignoreFunction: t.integer().default(() => 1),
          sqlNotChanged: t.integer().default(t.sql`1 + 2`),
          sqlChanged: t.integer().default(t.sql`1 + 3`),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({
                name: 'valueNotChanged',
                default: '1',
              }),
              dbStructureMockFactory.intColumn({
                name: 'valueChanged',
                default: '2',
              }),
              dbStructureMockFactory.intColumn({
                name: 'ignoreFunction',
              }),
              dbStructureMockFactory.intColumn({
                name: 'sqlNotChanged',
                default: '(1 + 2)',
              }),
              dbStructureMockFactory.intColumn({
                name: 'sqlChanged',
                default: '(1 + 2)',
              }),
            ],
          }),
        ],
      }),
      compareExpressions: [false, false],
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
    arrange({
      tables: [
        table((t) => ({
          column: t.identity({
            incrementBy: 2,
            startWith: 3,
            min: 4,
            max: 5,
            cache: 6,
            cycle: true,
            always: true,
          }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.identityColumn({
                name: 'column',
              }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.identity(), t.identity({
      always: true,
      incrementBy: 2,
      startWith: 3,
      min: 4,
      max: 5,
      cache: 6,
    })),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.identity()
      ${yellow('to')}: t.identity({
      always: true,
      incrementBy: 2,
      startWith: 3,
      min: 4,
      max: 5,
      cache: 6,
    })`);
  });

  it('change column comment', async () => {
    arrange({
      tables: [
        table((t) => ({
          column: t.text().comment('to'),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({
                name: 'column',
                comment: 'from',
              }),
            ],
          }),
        ],
      }),
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

  it('change to array type', async () => {
    arrange({
      tables: [
        table((t) => ({
          column: t.array(t.integer()),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn()],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.integer(), t.array(t.integer())),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.integer()
      ${yellow('to')}: t.array(t.integer())`);
  });

  it('change from array type', async () => {
    arrange({
      tables: [
        table((t) => ({
          column: t.integer(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({
                isArray: true,
              }),
            ],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.array(t.integer()), t.integer()),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${yellow('~ change column')} column:
    ${yellow('from')}: t.array(t.integer())
      ${yellow('to')}: t.integer()`);
  });

  describe('recreating and renaming', () => {
    const dbTable = dbStructureMockFactory.table({
      name: 'table',
      columns: [
        dbStructureMockFactory.intColumn({
          name: 'from',
        }),
      ],
    });

    it('should drop old and create new column when selected', async () => {
      arrange({
        tables: [
          table((t) => ({
            to: t.integer(),
          })),
        ],
        structure: makeStructure({
          tables: [dbTable],
        }),
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
      arrange({
        tables: [
          table((t) => ({
            to: t.integer(),
          })),
        ],
        structure: makeStructure({
          tables: [dbTable],
        }),
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
      arrange({
        tables: [
          table((t) => ({
            from: t.name('to').integer(),
          })),
        ],
        structure: makeStructure({
          tables: [dbTable],
        }),
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
