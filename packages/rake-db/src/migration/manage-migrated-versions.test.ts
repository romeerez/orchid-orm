import {
  createMigrationsSchemaAndTable,
  deleteMigratedVersion,
  getMigratedVersionsMap,
  NoMigrationsTableError,
  saveMigratedVersion,
} from './manage-migrated-versions';
import { SilentQueries } from './migration';
import { testConfig } from '../rake-db.test-utils';
import { RakeDbCtx } from '../common';
import { Adapter, AdapterClass, AdapterConfigBase } from 'pqb/internal';
import { TestAdapter } from 'test-utils';
import { createSchema, createTable } from '../commands/create-or-drop';

jest.mock('../commands/create-or-drop', () => ({
  createSchema: jest.fn(() => 'done'),
  createTable: jest.fn(() => 'done'),
}));

const logger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('manageMigratedVersions', () => {
  beforeEach(jest.clearAllMocks);

  describe('createMigrationsTable', () => {
    const mockedQuery = jest.fn();

    const db = new AdapterClass({
      driverAdapter: TestAdapter,
      config: { databaseURL: 'postgres://user:password@host:1234/db-name' },
    });
    db.query = mockedQuery;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a "schemaMigrations" table with a schema', async () => {
      await createMigrationsSchemaAndTable(db, {
        migrationsTable: 'schema.table',
        logger,
      });

      expect(createSchema).toHaveBeenCalledWith(db, 'schema');
      expect(logger.log).toHaveBeenCalledWith(`Created schema "schema"`);

      expect(createTable).toHaveBeenCalledWith(
        db,
        '"schema"."table" (version TEXT NOT NULL, name TEXT NOT NULL)',
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Created migration versions table "schema"."table"`,
      );
    });

    it('should create a "schemaMigrations" table without a schema', async () => {
      await createMigrationsSchemaAndTable(db, {
        migrationsTable: 'table',
        logger,
      });

      expect(createSchema).not.toHaveBeenCalledWith(db, 'schema');

      expect(createTable).toHaveBeenCalledWith(
        db,
        '"table" (version TEXT NOT NULL, name TEXT NOT NULL)',
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Created migration versions table "table"`,
      );
    });

    it('should create and use a schema set in the config', async () => {
      const db = new AdapterClass({
        driverAdapter: TestAdapter,
        config: {
          databaseURL: 'postgres://user:password@host:1234/db-name',
          schema: () => 'schema',
        } as AdapterConfigBase,
      });
      db.query = mockedQuery;

      await createMigrationsSchemaAndTable(db, {
        migrationsTable: 'table',
        logger,
      });

      expect(createSchema).toHaveBeenCalledWith(db, 'schema');
      expect(logger.log).toHaveBeenCalledWith(`Created schema "schema"`);

      expect(createTable).toHaveBeenCalledWith(
        db,
        '"schema"."table" (version TEXT NOT NULL, name TEXT NOT NULL)',
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Created migration versions table "schema"."table"`,
      );
    });
  });

  describe('saveMigratedVersion', () => {
    it('should save migrated version', async () => {
      const db = {
        silentArrays: jest.fn(),
        getSchema() {},
      };

      await saveMigratedVersion(db as unknown as SilentQueries, '123', 'name', {
        migrationsTable: 'schema.table',
      });

      expect(db.silentArrays).toHaveBeenCalledWith(
        'INSERT INTO "schema"."table"(version, name) VALUES ($1, $2)',
        ['123', 'name'],
      );
    });
  });

  describe('deleteMigratedVersion', () => {
    it('should delete migrated version', async () => {
      const db = {
        silentArrays: jest.fn(() => ({ rowCount: 1 })),
        getSchema() {},
      };

      await deleteMigratedVersion(
        db as unknown as SilentQueries,
        '123',
        'name',
        {
          migrationsTable: 'schema.table',
        },
      );

      expect(db.silentArrays).toHaveBeenCalledWith(
        'DELETE FROM "schema"."table" WHERE version = $1 AND name = $2',
        ['123', 'name'],
      );
    });

    it('should throw when version was not found', async () => {
      const db = {
        silentArrays: jest.fn(() => ({ rowCount: 0 })),
        getSchema() {},
      };

      await expect(
        deleteMigratedVersion(db as unknown as SilentQueries, '123', 'name', {
          migrationsTable: 'schema.table',
        }),
      ).rejects.toThrow('Migration 123_name was not found in db');
    });
  });

  describe('getMigratedVersionsMap', () => {
    const adapter = {
      isInTransaction: () => false,
      query: jest.fn(),
      arrays: jest.fn(),
      getSchema() {},
    };

    const ctx: RakeDbCtx = {};

    const act = () =>
      getMigratedVersionsMap(ctx, adapter as unknown as Adapter, testConfig);

    it('should throw NoMigrationsTableError if no migration table', async () => {
      adapter.query.mockRejectedValueOnce(
        Object.assign(new Error(), { code: '42P01' }),
      );

      await expect(act()).rejects.toThrow(NoMigrationsTableError);
    });

    it('should rethrow unknown errors', async () => {
      const err = new Error();

      adapter.query.mockRejectedValueOnce(err);

      await expect(act()).rejects.toThrow(err);
    });
  });
});
