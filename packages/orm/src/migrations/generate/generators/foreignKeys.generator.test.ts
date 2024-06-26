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

describe('primaryKey', () => {
  const { arrange, act, assert, table, BaseTable } = useGeneratorsTestUtils();

  const someTable = class Some extends BaseTable {
    table = 'some';
    columns = this.setColumns((t) => ({
      iD: t.integer().primaryKey(),
    }));
  };

  const someCompositeTable = class Some extends BaseTable {
    table = 'some';
    columns = this.setColumns((t) => ({
      fA: t.text().primaryKey(),
      fB: t.text().primaryKey(),
    }));
  };

  it('should create a column foreign key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer(),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'iD'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.foreignKey(
        ['someId'],
        'some',
        ['iD'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add foreign key')} on (someId) to some(iD)`);
  });

  it('should drop a column foreign key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'iD', { name: 'fkey' }),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['some_id'],
        'public.some',
        ['i_d'],
        {
          name: 'fkey',
        },
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop foreign key')} on (some_id) to some(i_d)`);
  });

  it('should rename a column foreign key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'iD', { name: 'fromName' }),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'iD'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameConstraint('public.table', 'fromName', 'table_some_id_fkey');
});
`);

    assert.report(
      `${yellow('~ rename constraint')} on table table: fromName ${yellow(
        '=>',
      )} table_some_id_fkey`,
    );
  });

  it('should not be recreated when a column foreign key is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'iD', {
            name: 'fkeyName',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'iD', {
            name: 'fkeyName',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
        })),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate a column foreign key with different options', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'iD', {
            name: 'fkeyName',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          }),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'iD', {
            name: 'fkeyName',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['some_id'],
        'public.some',
        ['i_d'],
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
        ['iD'],
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
  ${red('- drop foreign key')} on (some_id) to some(i_d)
  ${green('+ add foreign key')} on (someId) to some(iD)`);
  });

  it('should create a composite foreign key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fA: t.text().primaryKey(),
          fB: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          aA: t.text(),
          bB: t.text(),
        }));
      },
      tables: [
        someCompositeTable,
        table(
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) =>
            t.foreignKey(['aA', 'bB'], () => someCompositeTable, ['fA', 'fB']),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.add(
      t.foreignKey(
        ['aA', 'bB'],
        'some',
        ['fA', 'fB'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${green('+ add foreign key')} on (aA, bB) to some(fA, fB)`);
  });

  it('should drop a composite foreign key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fA: t.text().primaryKey(),
          fB: t.text().primaryKey(),
        }));

        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) => t.foreignKey(['aA', 'bB'], 'some', ['fA', 'fB']),
        );
      },
      tables: [
        someCompositeTable,
        table((t) => ({
          aA: t.text(),
          bB: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['a_a', 'b_b'],
        'public.some',
        ['f_a', 'f_b'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop foreign key')} on (a_a, b_b) to some(f_a, f_b)`);
  });

  it('should not recreate composite foreign key when it is identical', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fA: t.text().primaryKey(),
          fB: t.text().primaryKey(),
        }));

        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) => t.foreignKey(['aA', 'bB'], 'some', ['fA', 'fB']),
        );
      },
      tables: [
        someCompositeTable,
        table(
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) =>
            t.foreignKey(['aA', 'bB'], () => someCompositeTable, ['fA', 'fB']),
        ),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate composite foreign key when option changes', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fA: t.text().primaryKey(),
          fB: t.text().primaryKey(),
        }));

        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) =>
            t.foreignKey(['aA', 'bB'], 'some', ['fA', 'fB'], {
              match: 'FULL',
            }),
        );
      },
      tables: [
        someCompositeTable,
        table(
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) =>
            t.foreignKey(['aA', 'bB'], () => someCompositeTable, ['fA', 'fB']),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['a_a', 'b_b'],
        'public.some',
        ['f_a', 'f_b'],
        {
          match: 'FULL',
        },
      ),
    ),
    ...t.add(
      t.foreignKey(
        ['aA', 'bB'],
        'some',
        ['fA', 'fB'],
      ),
    ),
  }));
});
`);

    assert.report(`${yellow('~ change table')} table:
  ${red('- drop foreign key')} on (a_a, b_b) to some(f_a, f_b)
  ${green('+ add foreign key')} on (aA, bB) to some(fA, fB)`);
  });

  it('should rename a composite foreign key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fA: t.text().primaryKey(),
          fB: t.text().primaryKey(),
        }));

        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) =>
            t.foreignKey(['aA', 'bB'], 'some', ['fA', 'fB'], {
              name: 'fromName',
            }),
        );
      },
      tables: [
        someCompositeTable,
        table(
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) =>
            t.foreignKey(['aA', 'bB'], () => someCompositeTable, ['fA', 'fB'], {
              name: 'toName',
            }),
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'iD'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    someId: t.add(t.integer().foreignKey('some', 'iD')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${green('+ add column')} someId integer references some(iD)`,
    );
  });

  it('should be dropped together with a column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'iD'),
        }));
      },
      tables: [someTable, table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    someId: t.drop(t.integer().foreignKey('some', 'i_d')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${red('- drop column')} someId integer references some(i_d)`,
    );
  });

  it('should be added in a column change', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          iD: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().nullable(),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'iD'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    someId: t.change(t.integer().nullable(), t.integer().foreignKey('some', 'iD')),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ change column')} someId:
    ${yellow('from')}: t.integer().nullable()
      ${yellow('to')}: t.integer().foreignKey('some', 'iD')`,
    );
  });

  it('should not be recreated when a column is renamed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fA: t.text().primaryKey(),
          fB: t.text().primaryKey(),
        }));

        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) => t.foreignKey(['aA', 'bB'], 'some', ['fA', 'fB']),
        );
      },
      tables: [
        someCompositeTable,
        table(
          (t) => ({
            aA: t.text(),
            cC: t.text(),
          }),
          (t) =>
            t.foreignKey(['aA', 'cC'], () => someCompositeTable, ['fA', 'fB']),
        ),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    b_b: t.rename('cC'),
  }));

  await db.renameConstraint('public.table', 'table_a_a_b_b_fkey', 'table_a_a_c_c_fkey');
});
`);

    assert.report(
      `${yellow('~ change table')} table:
  ${yellow('~ rename column')} b_b ${yellow('=>')} cC
${yellow('~ rename constraint')} on table table: table_a_a_b_b_fkey ${yellow(
        '=>',
      )} table_a_a_c_c_fkey`,
    );
  });

  it('should not be recreated when a foreign column is renamed', async () => {
    class Some extends BaseTable {
      table = 'some';
      columns = this.setColumns((t) => ({
        fA: t.text().primaryKey(),
        fC: t.text().primaryKey(),
      }));
    }

    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fA: t.text().primaryKey(),
          fB: t.text().primaryKey(),
        }));

        await db.createTable(
          'table',
          { noPrimaryKey: true },
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) => t.foreignKey(['aA', 'bB'], 'some', ['fA', 'fB']),
        );
      },
      tables: [
        Some,
        table(
          (t) => ({
            aA: t.text(),
            bB: t.text(),
          }),
          (t) => t.foreignKey(['aA', 'bB'], () => Some, ['fA', 'fC']),
        ),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('some', (t) => ({
    f_b: t.rename('fC'),
  }));
});
`);

    assert.report(
      `${yellow('~ change table')} some:
  ${yellow('~ rename column')} f_b ${yellow('=>')} fC`,
    );
  });
});
