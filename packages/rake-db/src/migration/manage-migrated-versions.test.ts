import {
  createMigrationsTable,
  deleteMigratedVersion,
  getMigratedVersionsMap,
  NoMigrationsTableError,
  saveMigratedVersion,
} from './manage-migrated-versions';
import { SilentQueries } from './migration';
import { testConfig } from '../rake-db.test-utils';
import { RakeDbCtx } from '../common';
import { AdapterBase } from 'pqb';
import { asMock, TestAdapter } from 'test-utils';

const config = testConfig;

describe('manageMigratedVersions', () => {
  beforeEach(jest.resetAllMocks);

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

    it('supports migrationTable config with schema', async () => {
      mockedQuery.mockReturnValueOnce(undefined);

      await createMigrationsTable(db, {
        ...config,
        migrationsTable: 'custom-schema.custom-table',
      });

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE SCHEMA "custom-schema"`],
        [
          `CREATE TABLE "custom-schema"."custom-table" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
        ],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created schema custom-schema'],
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
      config.schema = 'custom';

      await createMigrationsTable(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE SCHEMA "custom"`],
        [
          `CREATE TABLE "custom"."schemaMigrations" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
        ],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created schema custom'],
        ['Created versions table'],
      ]);

      config.schema = undefined;
    });

    it('should be fine when the custom schema already exists', async () => {
      mockedQuery.mockRejectedValueOnce({ code: '42P06' });
      mockedQuery.mockResolvedValue(null);

      config.schema = 'custom';

      await createMigrationsTable(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE SCHEMA "custom"`],
        [
          `CREATE TABLE "custom"."schemaMigrations" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
        ],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created versions table'],
      ]);

      config.schema = undefined;
    });
  });

  describe('saveMigratedVersion', () => {
    it('should save migrated version', async () => {
      const db = {
        silentArrays: jest.fn(),
      };

      await saveMigratedVersion(
        db as unknown as SilentQueries,
        '123',
        'name',
        config,
      );

      expect(db.silentArrays).toBeCalledWith(
        'INSERT INTO "schemaMigrations"(version, name) VALUES ($1, $2)',
        ['123', 'name'],
      );
    });
  });

  describe('deleteMigratedVersion', () => {
    it('should delete migrated version', async () => {
      const db = {
        silentArrays: jest.fn(() => ({ rowCount: 1 })),
      };

      await deleteMigratedVersion(
        db as unknown as SilentQueries,
        '123',
        'name',
        config,
      );

      expect(db.silentArrays).toBeCalledWith(
        'DELETE FROM "schemaMigrations" WHERE version = $1 AND name = $2',
        ['123', 'name'],
      );
    });

    it('should throw when version was not found', async () => {
      const db = {
        silentArrays: jest.fn(() => ({ rowCount: 0 })),
      };

      await expect(
        deleteMigratedVersion(
          db as unknown as SilentQueries,
          '123',
          'name',
          config,
        ),
      ).rejects.toThrow('Migration 123_name was not found in db');
    });
  });

  describe('getMigratedVersionsMap', () => {
    const adapter = {
      arrays: jest.fn(),
    };

    const ctx: RakeDbCtx = {};

    const act = () =>
      getMigratedVersionsMap(ctx, adapter as unknown as AdapterBase, config);

    it('should throw NoMigrationsTableError if no migration table', async () => {
      adapter.arrays.mockRejectedValueOnce(
        Object.assign(new Error(), { code: '42P01' }),
      );

      await expect(act()).rejects.toThrow(NoMigrationsTableError);
    });

    it('should rethrow unknown errors', async () => {
      const err = new Error();

      adapter.arrays.mockRejectedValueOnce(err);

      await expect(act()).rejects.toThrow(err);
    });

    it('should add the name column and fill it from migrations if the column does not exist', async () => {
      const rows = [['123'], ['124']];

      adapter.arrays.mockResolvedValueOnce({
        fields: [{}],
        rows,
      });

      ctx.migrationsPromise = Promise.resolve({
        migrations: [
          { path: '/path/to/123_a', version: '123', load: async () => {} },
          { path: '/path/to/124_b', version: '124', load: async () => {} },
        ],
      });

      await act();

      expect(adapter.arrays.mock.calls).toEqual([
        ['SELECT * FROM "schemaMigrations" ORDER BY version'],
        ['ALTER TABLE "schemaMigrations" ADD COLUMN name TEXT'],
        [
          'UPDATE "schemaMigrations" SET name = $2 WHERE version = $1',
          ['123', 'a'],
        ],
        [
          'UPDATE "schemaMigrations" SET name = $2 WHERE version = $1',
          ['124', 'b'],
        ],
        ['ALTER TABLE "schemaMigrations" ALTER COLUMN name SET NOT NULL'],
      ]);

      expect(rows).toEqual([
        ['123', 'a'],
        ['124', 'b'],
      ]);
    });
  });
});
