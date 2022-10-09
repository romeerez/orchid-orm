import {
  createSchemaMigrations,
  getDatabaseAndUserFromOptions,
  getMigrationConfigWithDefaults,
  migrationConfigDefaults,
  setAdapterOptions,
  setAdminCredentialsToOptions,
} from './common';
import Enquirer from 'enquirer';
import { Adapter } from 'pqb';

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

describe('common', () => {
  describe('getMigrationConfigWithDefaults', () => {
    it('should return config with defaults', () => {
      const result = getMigrationConfigWithDefaults({
        migrationsPath: 'custom-path',
      });

      expect(result).toEqual({
        migrationsPath: 'custom-path',
        migrationsTable: 'schemaMigrations',
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
});
