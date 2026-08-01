import { introspectDbSchema } from 'rake-db';
import {
  defineTable,
  sql,
  useGeneratorsTestUtils,
} from './generators/generators.test-utils';
import { asMock } from 'test-utils';
import { verifyMigration } from './verify-migration';
import { defineRls } from '../../orm';

jest.mock('rake-db', () => {
  const actual = jest.requireActual('../../../../rake-db/src');
  return {
    ...actual,
    migrate: jest.fn(),
    promptSelect: jest.fn(),
    introspectDbSchema: jest.fn((...args: unknown[]) =>
      actual.introspectDbSchema(...args),
    ),
  };
});
jest.mock('./verify-migration');
jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

describe('generate', () => {
  const { arrange, act, defaultConfig } = useGeneratorsTestUtils();

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
      tables: [
        {
          instance: () => ({
            noPrimaryKey: true,
            columns: { shape: {}, data: [] },
            q: {},
          }),
        },
      ],
    });

    await expect(act()).rejects.toThrow(
      `Table table0 is missing table property`,
    );
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
      tables: [defineTable('table', { noPrimaryKey: true }, () => ({}))],
    });

    asMock(verifyMigration).mockImplementation(() => false);

    await expect(act()).rejects.toThrow('Failed to verify generated migration');
  });

  it('should introspect rls when at least one code table has rls declaration', async () => {
    asMock(verifyMigration).mockResolvedValue(undefined);

    await arrange({
      tables: [
        defineTable(
          'one',
          { noPrimaryKey: true, nameInDb: 'one' },
          () => ({}),
        ).rls(
          defineRls({
            enable: true,
            permit: [
              {
                name: 'one_select_policy',
                for: 'SELECT',
                to: 'public',
                using: sql`id > 0`,
              },
            ],
          }),
        ),
      ],
    });

    await act();

    expect(asMock(introspectDbSchema).mock.calls[0][1]).toMatchObject({
      rls: true,
    });
  });

  it('should not introspect rls when no code table has rls declaration', async () => {
    asMock(verifyMigration).mockResolvedValue(undefined);

    await arrange({
      tables: [defineTable('table', { noPrimaryKey: true }, () => ({}))],
    });

    await act();

    expect(asMock(introspectDbSchema).mock.calls[0][1]).toMatchObject({
      rls: false,
    });
  });

  it('should not load default privileges when roles do not have defaultPrivileges', async () => {
    asMock(verifyMigration).mockResolvedValue(undefined);

    await arrange({
      dbOptions: {
        roles: [{ name: 'name' }],
      },
      tables: [defineTable('table', { noPrimaryKey: true }, () => ({}))],
    });

    await act();

    expect(asMock(introspectDbSchema).mock.calls[0][1]).toMatchObject({
      loadDefaultPrivileges: false,
    });
    expect(asMock(verifyMigration).mock.calls[0][5]).toMatchObject({
      loadDefaultPrivileges: false,
    });
  });

  it('should load default privileges when at least one role has defaultPrivileges defined', async () => {
    asMock(verifyMigration).mockResolvedValue(undefined);

    await arrange({
      dbOptions: {
        roles: [{ name: 'name', defaultPrivileges: [] }],
      },
      tables: [defineTable('table', { noPrimaryKey: true }, () => ({}))],
    });

    await act();

    expect(asMock(introspectDbSchema).mock.calls[0][1]).toMatchObject({
      loadDefaultPrivileges: true,
    });
    expect(asMock(verifyMigration).mock.calls[0][5]).toMatchObject({
      loadDefaultPrivileges: true,
    });
  });
});
