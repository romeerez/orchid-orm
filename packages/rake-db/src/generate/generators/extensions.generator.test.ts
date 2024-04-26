import { generatorsTestUtils } from './generators.test-utils';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';

jest.mock('../dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../prompt');

const { arrange, act, assert, makeStructure } = generatorsTestUtils;

describe('extensions', () => {
  beforeEach(jest.clearAllMocks);

  it('should create extension', async () => {
    arrange({
      dbOptions: {
        extensions: ['one', { 'schema.two': 'v1' }],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createExtension('one');

  await db.createExtension('schema.two', {
    version: 'v1',
  });
});
`);
  });

  it('should drop extension', async () => {
    arrange({
      structure: makeStructure({
        extensions: [
          dbStructureMockFactory.extension({
            schemaName: 'schema',
            name: 'name',
            version: 'v1',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropExtension('schema.name', {
    version: 'v1',
  });
});
`);
  });

  it('should not recreate extension when it is not changed', async () => {
    arrange({
      dbOptions: {
        extensions: [{ name: 'v1' }],
      },
      structure: makeStructure({
        extensions: [
          dbStructureMockFactory.extension({
            schemaName: 'public',
            name: 'name',
            version: 'v1',
          }),
        ],
      }),
    });

    await act();

    assert.migration();
  });

  // later, if needed, this can be handled with special `ALTER EXTENSION ... UPDATE TO v2`
  // but for now it should be fine to recreate instead
  it('should recreate extension with a new version', async () => {
    arrange({
      dbOptions: {
        extensions: [{ 'schema.name': 'v2' }],
      },
      structure: makeStructure({
        extensions: [
          dbStructureMockFactory.extension({
            schemaName: 'schema',
            name: 'name',
            version: 'v1',
          }),
        ],
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropExtension('schema.name', {
    version: 'v1',
  });
});

change(async (db) => {
  await db.createExtension('schema.name', {
    version: 'v2',
  });
});
`);
  });
});
