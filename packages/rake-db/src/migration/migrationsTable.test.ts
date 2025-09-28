import { asMock, TestAdapter } from 'test-utils';
import { testConfig } from '../rake-db.test-utils';
import { createMigrationsTable } from './migrationsTable';

const config = testConfig;

describe('migrationsTable', () => {
  describe('createMigrationsTable', () => {
    const mockedQuery = jest.fn();

    const db = new TestAdapter({
      databaseURL: 'postgres://user:password@host:1234/db-name',
    });
    db.query = mockedQuery;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a "schemaMigrations" table', async () => {
      mockedQuery.mockReturnValueOnce(undefined);

      await createMigrationsTable(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [
          `CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
        ],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created versions table'],
      ]);
    });

    it('should inform if table already exists', async () => {
      mockedQuery.mockRejectedValueOnce({ code: '42P07' });

      await createMigrationsTable(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [
          `CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
        ],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Versions table exists'],
      ]);
    });

    it('should create a custom schema if config has a schema other than public', async () => {
      db.schema = 'custom';

      await createMigrationsTable(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE SCHEMA "custom"`],
        [
          `CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
        ],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created schema custom'],
        ['Created versions table'],
      ]);

      db.schema = undefined;
    });

    it('should be fine when the custom schema already exists', async () => {
      mockedQuery.mockRejectedValueOnce({ code: '42P06' });
      mockedQuery.mockResolvedValue(null);

      db.schema = 'custom';

      await createMigrationsTable(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE SCHEMA "custom"`],
        [
          `CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
        ],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created versions table'],
      ]);

      db.schema = undefined;
    });
  });
});
