import {
  deleteMigratedVersion,
  getMigratedVersionsMap,
  NoMigrationsTableError,
  saveMigratedVersion,
} from './manageMigratedVersions';
import { SilentQueries } from './migration';
import { testConfig } from '../rake-db.test-utils';
import { RakeDbCtx } from '../common';
import { AdapterBase } from 'orchid-core';

const config = testConfig;

describe('manageMigratedVersions', () => {
  beforeEach(jest.resetAllMocks);

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
