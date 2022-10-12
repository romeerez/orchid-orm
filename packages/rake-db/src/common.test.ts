import {
  createSchemaMigrations,
  getDatabaseAndUserFromOptions,
  getFirstWordAndRest,
  getMigrationConfigWithDefaults,
  getMigrationFiles,
  getTextAfterTo,
  joinColumns,
  joinWords,
  migrationConfigDefaults,
  setAdapterOptions,
  setAdminCredentialsToOptions,
  sortAsc,
  sortDesc,
} from './common';
import Enquirer from 'enquirer';
import { Adapter } from 'pqb';
import { readdir } from 'fs/promises';
import path from 'path';

jest.mock('enquirer', () => {
  class Snippet {
    constructor(public params: Record<string, unknown>) {}
    run() {}
  }
  Snippet.prototype.run = jest.fn();

  return {
    Snippet,
  };
});

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
}));

describe('common', () => {
  describe('getMigrationConfigWithDefaults', () => {
    it('should return config with defaults', () => {
      const result = getMigrationConfigWithDefaults({
        migrationsPath: 'custom-path',
      });

      expect(result).toEqual({
        migrationsPath: 'custom-path',
        migrationsTable: 'schemaMigrations',
        requireTs: expect.any(Function),
      });
    });
  });

  describe('getDatabaseAndUserFromOptions', () => {
    it('should return data from connectionString', () => {
      const result = getDatabaseAndUserFromOptions({
        connectionString: 'postgres://user:password@localhost:5432/dbname',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'user',
      });
    });

    it('should return data from options when no connectionString', () => {
      const result = getDatabaseAndUserFromOptions({
        database: 'dbname',
        user: 'user',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'user',
      });
    });
  });

  describe('setAdapterOptions', () => {
    it('should set options in connectionString to postgres', () => {
      const result = setAdapterOptions(
        {
          connectionString: 'postgres://user:password@localhost:5432/dbname',
        },
        {
          database: 'updated-db',
          user: 'updated-user',
          password: 'updated-password',
        },
      );

      expect(result).toEqual({
        connectionString:
          'postgres://updated-user:updated-password@localhost:5432/updated-db',
      });
    });

    it('should set object options', () => {
      const result = setAdapterOptions(
        {
          database: 'dbname',
          user: 'user',
          password: 'password',
        },
        {
          database: 'updated-db',
          user: 'updated-user',
          password: 'updated-password',
        },
      );

      expect(result).toEqual({
        database: 'updated-db',
        user: 'updated-user',
        password: 'updated-password',
      });
    });
  });

  describe('setAdminCredentialsToOptions', () => {
    beforeEach(() => {
      (Enquirer as any).Snippet.prototype.run.mockReturnValueOnce({
        values: {
          user: 'admin-user',
          password: 'admin-password',
        },
      });
    });

    it('should set admin credentials to connectionString', async () => {
      const result = await setAdminCredentialsToOptions({
        connectionString: 'postgres://user:password@localhost:5432/dbname',
      });

      expect(result).toEqual({
        connectionString:
          'postgres://admin-user:admin-password@localhost:5432/dbname',
      });
    });

    it('should set admin credentials to options', async () => {
      const result = await setAdminCredentialsToOptions({
        database: 'dbname',
        user: 'user',
        password: 'password',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'admin-user',
        password: 'admin-password',
      });
    });
  });

  describe('createSchemaMigrations', () => {
    const log = console.log;
    const mockedLog = jest.fn();
    const mockedQuery = jest.fn();

    const db = new Adapter({ connectionString: 'test' });
    db.query = mockedQuery;

    beforeAll(() => {
      console.log = mockedLog;
    });
    beforeEach(() => {
      jest.clearAllMocks();
    });
    afterAll(() => {
      console.log = log;
    });

    it('should create a "schemaMigrations" table', async () => {
      mockedQuery.mockReturnValueOnce(undefined);

      await createSchemaMigrations(db, migrationConfigDefaults);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL )`],
      ]);

      expect(mockedLog.mock.calls).toEqual([['Created versions table']]);
    });

    it('should inform if table already exists', async () => {
      mockedQuery.mockRejectedValue({ code: '42P07' });

      await createSchemaMigrations(db, migrationConfigDefaults);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL )`],
      ]);

      expect(mockedLog.mock.calls).toEqual([['Versions table exists']]);
    });
  });

  describe('getFirstWordAndRest', () => {
    it('should return pair of first word and rest', () => {
      expect(getFirstWordAndRest('fooBarBaz')).toEqual(['foo', 'barBaz']);
      expect(getFirstWordAndRest('foo-barBaz')).toEqual(['foo', 'barBaz']);
      expect(getFirstWordAndRest('foo_barBaz')).toEqual(['foo', 'barBaz']);
    });

    it('should return input when it is a single word', () => {
      expect(getFirstWordAndRest('foo')).toEqual(['foo']);
    });
  });

  describe('getTextAfterTo', () => {
    it('should return text after To or to', () => {
      expect(getTextAfterTo('addColumnToTable')).toBe('table');
      expect(getTextAfterTo('add-column-to-table')).toBe('table');
      expect(getTextAfterTo('add_column_to_table')).toBe('table');
    });
  });

  describe('getMigrationFiles', () => {
    it('should return files with versions', async () => {
      const version = '12345678901234';
      const files = [`${version}_a.ts`, `${version}_b.ts`, `${version}_c.ts`];
      (readdir as jest.Mock).mockReturnValueOnce(files);

      const result = await getMigrationFiles(migrationConfigDefaults, true);
      expect(result).toEqual(
        files.map((file) => ({
          path: path.join(migrationConfigDefaults.migrationsPath, file),
          version,
        })),
      );
    });

    it('should return empty array on error', async () => {
      (readdir as jest.Mock).mockRejectedValue(new Error());

      const result = await getMigrationFiles(migrationConfigDefaults, true);
      expect(result).toEqual([]);
    });

    it('should throw if file is not a .ts file', async () => {
      (readdir as jest.Mock).mockReturnValueOnce(['file.js']);

      await expect(
        getMigrationFiles(migrationConfigDefaults, true),
      ).rejects.toThrow('Only .ts files are supported');
    });

    it('should throw on improper version', async () => {
      (readdir as jest.Mock).mockReturnValueOnce(['1234567890_file.ts']);

      await expect(
        getMigrationFiles(migrationConfigDefaults, true),
      ).rejects.toThrow(
        'Migration file name should start with 14 digit version',
      );
    });
  });

  describe('sortAsc', () => {
    it('should sort ascending', () => {
      expect(sortAsc(['a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('sortDesc', () => {
    it('should sort descending', () => {
      expect(sortDesc(['a', 'c', 'b'])).toEqual(['c', 'b', 'a']);
    });
  });

  describe('joinWords', () => {
    it('should join words', () => {
      expect(joinWords('foo', 'bar', 'baz')).toEqual('fooBarBaz');
    });
  });

  describe('joinColumns', () => {
    it('should join columns', () => {
      expect(joinColumns(['a', 'b', 'c'])).toBe('"a", "b", "c"');
    });
  });
});
