import { generatorsTestUtils } from './generators/generators.test-utils';

jest.mock('../generate/dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../prompt');

const { arrange, act, defaultConfig, BaseTable, makeStructure } =
  generatorsTestUtils;

describe('generate', () => {
  beforeEach(jest.clearAllMocks);

  it('should throw if no `db` setting in the config', async () => {
    arrange({
      config: { ...defaultConfig, db: undefined },
    });

    await expect(act()).rejects.toThrow(
      '`db` setting must be set in the rake-db config for the generator to work',
    );
  });

  it('should throw if db options is empty', async () => {
    arrange({
      options: [],
    });

    await expect(act()).rejects.toThrow('Database options must not be empty');
  });

  it('should throw if table`s table is not set', async () => {
    arrange({
      tables: [class One extends BaseTable {}],
    });

    await expect(act()).rejects.toThrow(`Table One is missing table property`);
  });

  it('should throw if one db schema does not match the other', async () => {
    arrange({
      options: [
        { databaseURL: 'postgres://user@localhost/dbname' },
        { databaseURL: 'postgres://user@localhost/dbname-test' },
      ],
      structures: [
        makeStructure({ schemas: ['one'] }),
        makeStructure({ schemas: ['two'] }),
      ],
    });

    await expect(act()).rejects.toThrow(
      'schemas[0] in the db 0 does not match db 1',
    );
  });
});
