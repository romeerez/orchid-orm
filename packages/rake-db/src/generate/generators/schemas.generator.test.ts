import { generatorsTestUtils } from './generators.test-utils';

jest.mock('../dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../prompt');

const { arrange, act, assert, BaseTable, makeStructure } = generatorsTestUtils;

describe('schemas', () => {
  beforeEach(jest.clearAllMocks);

  it('should create db schemas and set tables schemas', async () => {
    arrange({
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
      structure: makeStructure({
        tables: [
          {
            schemaName: 'public',
            name: 'one',
          },
          {
            schemaName: 'public',
            name: 'two',
          },
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createSchema('one');

  await db.createSchema('two');
});

change(async (db) => {
  await db.changeTableSchema('one', 'public', 'one');

  await db.changeTableSchema('two', 'public', 'two');
});
`);
  });

  it('should drop a db schema, do not drop the public schema', async () => {
    arrange({
      tables: [
        class One extends BaseTable {
          schema = 'one';
          table = 'one';
        },
      ],
      structure: makeStructure({
        schemas: ['public', 'one', 'two'],
        tables: [
          {
            schemaName: 'one',
            name: 'one',
          },
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropSchema('two');
});
`);
  });

  it('should create new schema and drop the old one when selecting `create schema` option', async () => {
    arrange({
      tables: [
        class One extends BaseTable {
          schema = 'to';
          table = 'one';
        },
      ],
      structure: makeStructure({
        schemas: ['public', 'from'],
        tables: [
          {
            schemaName: 'to',
            name: 'one',
          },
        ],
      }),
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createSchema('to');

  await db.dropSchema('from');
});
`);
  });

  it('should rename schema when selecting `rename schema` option', async () => {
    arrange({
      tables: [
        class One extends BaseTable {
          schema = 'to';
          table = 'one';
        },
      ],
      structure: makeStructure({
        schemas: ['public', 'from'],
        tables: [{ schemaName: 'from', name: 'one' }],
      }),
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');
});
`);
  });

  it('should rename schema and drop other schema', async () => {
    arrange({
      tables: [
        class One extends BaseTable {
          schema = 'to';
          table = 'one';
        },
      ],
      structure: makeStructure({
        schemas: ['public', 'drop', 'from'],
        tables: [
          {
            schemaName: 'from',
            name: 'one',
          },
        ],
      }),
      selects: [2],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');

  await db.dropSchema('drop');
});
`);
  });

  it('should change table schema when both schemas exist', async () => {
    arrange({
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
      structure: makeStructure({
        schemas: ['public', 'from', 'to'],
        tables: [
          {
            schemaName: 'from',
            name: 'one',
          },
          {
            schemaName: 'to',
            name: 'two',
          },
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTableSchema('one', 'from', 'to');

  await db.changeTableSchema('two', 'to', 'from');
});
`);
  });
});
