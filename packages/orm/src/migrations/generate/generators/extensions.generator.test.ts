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

const { green, red, pale } = colors;

describe('extensions', () => {
  const { arrange, act, assert } = useGeneratorsTestUtils();

  it('should create extension', async () => {
    await arrange({
      dbOptions: {
        extensions: ['seg', { 'schema.cube': '1.5' }],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createSchema('schema');

  await db.createExtension('seg');
});

change(async (db) => {
  await db.createExtension('schema.cube', {
    version: '1.5',
  });
});
`);

    assert.report(`${green('+ create schema')} schema
${green('+ create extension')} seg
${green('+ create extension')} schema.cube ${pale('1.5')}`);
  });

  it('should drop extension', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createExtension('schema.cube', { version: '1.5' });
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropExtension('schema.cube', {
    version: '1.5',
  });
});

change(async (db) => {
  await db.dropSchema('schema');
});
`);

    assert.report(`${red('- drop schema')} schema
${red('- drop extension')} schema.cube ${pale('1.5')}`);
  });

  it('should not recreate extension when it is not changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createExtension('cube', { version: '1.5' });
      },
      dbOptions: {
        extensions: [{ cube: '1.5' }],
      },
    });

    await act();

    assert.migration();
  });

  // later, if needed, this can be handled with special `ALTER EXTENSION ... UPDATE TO 1.5`
  // but for now it should be fine to recreate instead
  it('should recreate extension with a new version', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createExtension('cube', { version: '1.4' });
      },
      dbOptions: {
        extensions: [{ cube: '1.5' }],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropExtension('cube', {
    version: '1.4',
  });
});

change(async (db) => {
  await db.createExtension('cube', {
    version: '1.5',
  });
});
`);

    assert.report(`${red('- drop extension')} cube ${pale('1.4')}
${green('+ create extension')} cube ${pale('1.5')}`);
  });
});
