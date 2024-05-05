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

describe('schemas', () => {
  const { arrange, act, assert, BaseTable } = useGeneratorsTestUtils();

  it('should create db schemas and set tables schemas', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('one', { noPrimaryKey: true });
        await db.createTable('two', { noPrimaryKey: true });
      },
      tables: [
        class One extends BaseTable {
          schema = 'one';
          table = 'one';
        },
        class Two extends BaseTable {
          schema = 'two';
          table = 'two';
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createSchema('one');

  await db.createSchema('two');
});

change(async (db) => {
  await db.changeTableSchema('one', 'public', 'one');

  await db.changeTableSchema('two', 'public', 'two');
});
`);

    assert.report(
      `${green('+ create schema')} one`,
      `${green('+ create schema')} two`,
      `${yellow('~ change schema of table')} one ${yellow('=>')} one.one`,
      `${yellow('~ change schema of table')} two ${yellow('=>')} two.two`,
    );
  });

  it('should drop a db schema, do not drop the public schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('one');
        await db.createSchema('two');

        await db.createTable('one.one', { noPrimaryKey: true });
      },
      tables: [
        class One extends BaseTable {
          schema = 'one';
          table = 'one';
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropSchema('two');
});
`);

    assert.report(`${red('- drop schema')} two`);
  });

  it('should create new schema and drop the old one when selecting `create schema` option', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');

        await db.createTable('from.one', { noPrimaryKey: true });
      },
      tables: [
        class One extends BaseTable {
          schema = 'to';
          table = 'one';
        },
      ],
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createSchema('to');
});

change(async (db) => {
  await db.changeTableSchema('one', 'from', 'to');
});

change(async (db) => {
  await db.dropSchema('from');
});
`);

    assert.report(
      `${green('+ create schema')} to`,
      `${red('- drop schema')} from`,
      `${yellow('~ change schema of table')} from.one ${yellow('=>')} to.one`,
    );
  });

  it('should rename schema when selecting `rename schema` option', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');

        await db.createTable('from.one', { noPrimaryKey: true });
      },
      tables: [
        class One extends BaseTable {
          schema = 'to';
          table = 'one';
        },
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');
});
`);

    assert.report(`${yellow('~ rename schema')} from ${yellow('=>')} to`);
  });

  it('should rename schema and drop other schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('drop');
        await db.createSchema('from');

        await db.createTable('from.one', { noPrimaryKey: true });
      },
      tables: [
        class One extends BaseTable {
          schema = 'to';
          table = 'one';
        },
      ],
      selects: [2],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');

  await db.dropSchema('drop');
});
`);

    assert.report(
      `${yellow('~ rename schema')} from ${yellow('=>')} to`,
      `${red('- drop schema')} drop`,
    );
  });

  it('should change table schema when both schemas exist', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');
        await db.createSchema('to');

        await db.createTable('from.one', { noPrimaryKey: true });
        await db.createTable('to.two', { noPrimaryKey: true });
      },
      tables: [
        class One extends BaseTable {
          schema = 'to';
          table = 'one';
        },
        class Two extends BaseTable {
          schema = 'from';
          table = 'two';
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTableSchema('one', 'from', 'to');

  await db.changeTableSchema('two', 'to', 'from');
});
`);

    assert.report(
      `${yellow('~ change schema of table')} from.one ${yellow('=>')} to.one`,
      `${yellow('~ change schema of table')} to.two ${yellow('=>')} from.two`,
    );
  });
});
