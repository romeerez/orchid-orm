import { introspectDbSchema } from 'rake-db';
import { useGeneratorsTestUtils } from './generators/generators.test-utils';
import { asMock } from 'test-utils';
import { verifyMigration } from './verifyMigration';

jest.mock('rake-db', () => {
  const actual = jest.requireActual('rake-db');
  return {
    ...actual,
    migrate: jest.fn(),
    promptSelect: jest.fn(),
    introspectDbSchema: jest.fn((...args: unknown[]) =>
      actual.introspectDbSchema(...args),
    ),
  };
});
jest.mock('./verifyMigration');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

describe('generate', () => {
  const { arrange, act, defaultConfig, BaseTable, table } =
    useGeneratorsTestUtils();

  it('should throw if no `dbPath` setting in the config', async () => {
    await arrange({
      config: { ...defaultConfig, dbPath: undefined },
    });

    await expect(act()).rejects.toThrow(
      '`dbPath` setting must be set in the migrations config for the generator to work',
    );
  });

  it('should throw if db options is empty', async () => {
    await arrange({
      options: [],
    });

    await expect(act()).rejects.toThrow('Database options must not be empty');
  });

  it('should throw if table`s table is not set', async () => {
    await arrange({
      tables: [class One extends BaseTable {}],
    });

    await expect(act()).rejects.toThrow(`Table One is missing table property`);
  });

  it('should throw if one db schema does not match the other', async () => {
    await arrange({
      options: [
        { databaseURL: 'postgres://user@localhost/dbname' },
        { databaseURL: 'postgres://user@localhost/dbname-test' },
      ],
    });

    asMock(introspectDbSchema).mockResolvedValueOnce({
      schemas: ['one'],
    });
    asMock(introspectDbSchema).mockResolvedValueOnce({
      schemas: ['two'],
    });

    await expect(act()).rejects.toThrow(
      'schemas[0] in the db 0 does not match db 1',
    );
  });

  it('should throw when migration verification fails', async () => {
    await arrange({
      tables: [table()],
    });

    asMock(verifyMigration).mockImplementation(() => false);

    await expect(act()).rejects.toThrow('Failed to verify generated migration');
  });
});
