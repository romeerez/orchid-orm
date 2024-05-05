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
      id: t.integer().primaryKey(),
    }));
  };

  const someCompositeTable = class Some extends BaseTable {
    table = 'some';
    columns = this.setColumns((t) => ({
      fa: t.text().primaryKey(),
      fb: t.text().primaryKey(),
    }));
  };

  it('should create a column foreign key', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer(),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'id'),
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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'id', { name: 'fkey' }),
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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'id', { name: 'fromName' }),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'id'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'id', {
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
          someId: t.integer().foreignKey(() => someTable, 'id', {
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
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'id', {
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
          someId: t.integer().foreignKey(() => someTable, 'id', {
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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fa: t.text().primaryKey(),
          fb: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.text(),
          b: t.text(),
        }));
      },
      tables: [
        someCompositeTable,
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], () => someCompositeTable, ['fa', 'fb']),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fa: t.text().primaryKey(),
          fb: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb']),
        }));
      },
      tables: [
        someCompositeTable,
        table((t) => ({
          a: t.text(),
          b: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fa: t.text().primaryKey(),
          fb: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb']),
        }));
      },
      tables: [
        someCompositeTable,
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], () => someCompositeTable, ['fa', 'fb']),
        })),
      ],
    });

    await act();

    assert.migration();
  });

  it('should recreate composite foreign key when option changes', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fa: t.text().primaryKey(),
          fb: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb'], {
            match: 'FULL',
          }),
        }));
      },
      tables: [
        someCompositeTable,
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], () => someCompositeTable, ['fa', 'fb']),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    ...t.drop(
      t.foreignKey(
        ['a', 'b'],
        'public.some',
        ['fa', 'fb'],
        {
          match: 'FULL',
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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fa: t.text().primaryKey(),
          fb: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb'], {
            name: 'fromName',
          }),
        }));
      },
      tables: [
        someCompositeTable,
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], () => someCompositeTable, ['fa', 'fb'], {
            name: 'toName',
          }),
        })),
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
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true });
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'id'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().foreignKey('some', 'id'),
        }));
      },
      tables: [someTable, table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          someId: t.integer().nullable(),
        }));
      },
      tables: [
        someTable,
        table((t) => ({
          someId: t.integer().foreignKey(() => someTable, 'id'),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fa: t.text().primaryKey(),
          fb: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb']),
        }));
      },
      tables: [
        someCompositeTable,
        table((t) => ({
          a: t.text(),
          c: t.text(),
          ...t.foreignKey(['a', 'c'], () => someCompositeTable, ['fa', 'fb']),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
    class Some extends BaseTable {
      table = 'some';
      columns = this.setColumns((t) => ({
        fa: t.text().primaryKey(),
        fc: t.text().primaryKey(),
      }));
    }

    await arrange({
      async prepareDb(db) {
        await db.createTable('some', (t) => ({
          fa: t.text().primaryKey(),
          fb: t.text().primaryKey(),
        }));

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], 'some', ['fa', 'fb']),
        }));
      },
      tables: [
        Some,
        table((t) => ({
          a: t.text(),
          b: t.text(),
          ...t.foreignKey(['a', 'b'], () => Some, ['fa', 'fc']),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

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
