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

const { arrange, act, assert, table, makeStructure, BaseTable } =
  generatorsTestUtils;
const { green, red, yellow } = colors;

describe('primaryKey', () => {
  beforeEach(jest.clearAllMocks);

  it('should create a column foreign key', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer().foreignKey('some', 'id'),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'someId' })],
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.foreignKey(
        ['someId'],
        'some',
        ['id'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add foreign key')} on (someId) to some(id)`);
  });

  it('should drop a column foreign key', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'someId' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            references: {
              columns: ['someId'],
              foreignColumns: ['id'],
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['someId'],
        'public.some',
        ['id'],
        {
          name: 'fkey',
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop foreign key')} on (someId) to some(id)`);
  });

  it('should rename a column foreign key', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer().foreignKey('some', 'id'),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'someId' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'fromName',
            references: {
              columns: ['someId'],
              foreignColumns: ['id'],
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameConstraint('public.table', 'fromName', 'table_someId_fkey');
});
`);

    assert.report(
      `${yellow('~ rename constraint')} on table table: fromName ${yellow(
        '=>',
      )} table_someId_fkey`,
    );
  });

  it('should not be recreated when a column foreign key is identical', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer().foreignKey('some', 'id', {
            name: 'fkeyName',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'someId' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'fkeyName',
            references: {
              columns: ['someId'],
              foreignColumns: ['id'],
              match: 'f',
              onUpdate: 'c',
              onDelete: 'c',
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  it('should recreate a column foreign key with different options', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer().foreignKey('some', 'id', {
            name: 'fkeyName',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'someId' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'fkeyName',
            references: {
              columns: ['someId'],
              foreignColumns: ['id'],
              match: 'f',
              onUpdate: 'c',
              onDelete: 'r',
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['someId'],
        'public.some',
        ['id'],
        {
          name: 'fkeyName',
          match: 'FULL',
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
      ),
    ),
    ...t.add(
      t.foreignKey(
        ['someId'],
        'some',
        ['id'],
        {
          name: 'fkeyName',
          match: 'FULL',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop foreign key')} on (someId) to some(id)
  ${green('+ add foreign key')} on (someId) to some(id)`);
  });

  it('should create a composite foreign key', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb']),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'a' }),
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
      t.foreignKey(
        ['a', 'b'],
        'some',
        ['fa', 'fb'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add foreign key')} on (a, b) to some(fa, fb)`);
  });

  it('should drop a composite foreign key', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.text(),
          b: t.text(),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'table_a_b_fkey',
            references: {
              columns: ['a', 'b'],
              foreignColumns: ['fa', 'fb'],
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['a', 'b'],
        'public.some',
        ['fa', 'fb'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop foreign key')} on (a, b) to some(fa, fb)`);
  });

  it('should not recreate composite foreign key when it is identical', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb']),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'table_a_b_fkey',
            references: {
              columns: ['a', 'b'],
              foreignColumns: ['fa', 'fb'],
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  it('should recreate composite foreign key when option changes', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb']),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'table_a_b_fkey',
            references: {
              columns: ['a', 'b'],
              foreignColumns: ['fa', 'fb'],
              match: 'p',
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['a', 'b'],
        'public.some',
        ['fa', 'fb'],
        {
          match: 'PARTIAL',
        },
      ),
    ),
    ...t.add(
      t.foreignKey(
        ['a', 'b'],
        'some',
        ['fa', 'fb'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop foreign key')} on (a, b) to some(fa, fb)
  ${green('+ add foreign key')} on (a, b) to some(fa, fb)`);
  });

  it('should rename a composite foreign key', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb'], {
            name: 'toName',
          }),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'fromName',
            references: {
              columns: ['a', 'b'],
              foreignColumns: ['fa', 'fb'],
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameConstraint('public.table', 'fromName', 'toName');
});
`);

    assert.report(
      `${yellow('~ rename constraint')} on table table: fromName ${yellow(
        '=>',
      )} toName`,
    );
  });

  it('should be added together with a column', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer().foreignKey('some', 'id'),
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
    someId: t.add(t.integer().foreignKey('some', 'id')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add column')} someId integer references some(id)`,
    );
  });

  it('should be dropped together with a column', async () => {
    arrange({
      tables: [table()],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'someId' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'table_someId_fkey',
            references: {
              columns: ['someId'],
              foreignColumns: ['id'],
            },
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    someId: t.drop(t.integer().foreignKey('some', 'id')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop column')} someId integer references some(id)`,
    );
  });

  it('should be added in a column change', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer().foreignKey('some', 'id'),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.intColumn({
                name: 'someId',
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
    someId: t.change(t.integer().nullable(), t.integer().foreignKey('some', 'id')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} someId:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer().foreignKey('some', 'id')`,
    );
  });

  it('should not be recreated when a column is renamed', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.text(),
          c: t.text(),
          ...t.foreignKey(['a', 'c'], 'some', ['fa', 'fb']),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'table_a_b_fkey',
            references: {
              columns: ['a', 'b'],
              foreignColumns: ['fa', 'fb'],
            },
          }),
        ],
      }),
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    b: t.rename('c'),
  }));

  await db.renameConstraint('public.table', 'table_a_b_fkey', 'table_a_c_fkey');
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ rename column')} b ${yellow('=>')} c
${yellow('~ rename constraint')} on table table: table_a_b_fkey ${yellow(
        '=>',
      )} table_a_c_fkey`,
    );
  });

  it('should not be recreated when a foreign column is renamed', async () => {
    arrange({
      tables: [
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fc']),
        })),
        class Some extends BaseTable {
          table = 'some';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            fa: t.text(),
            fc: t.text(),
          }));
        },
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'a' }),
              dbStructureMockFactory.textColumn({ name: 'b' }),
            ],
          }),
          dbStructureMockFactory.table({
            name: 'some',
            columns: [
              dbStructureMockFactory.textColumn({ name: 'fa' }),
              dbStructureMockFactory.textColumn({ name: 'fb' }),
            ],
          }),
        ],
        constraints: [
          dbStructureMockFactory.foreignKey('table', 'some', {
            name: 'table_a_b_fkey',
            references: {
              columns: ['a', 'b'],
              foreignColumns: ['fa', 'fb'],
            },
          }),
        ],
      }),
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('some', (t) => ({
    fb: t.rename('fc'),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} some:
  ${yellow('~ rename column')} fb ${yellow('=>')} fc`,
    );
  });
});
