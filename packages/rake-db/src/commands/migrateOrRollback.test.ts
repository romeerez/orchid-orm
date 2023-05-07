import { changeCache, migrate, redo, rollback } from './migrateOrRollback';
import {
  createSchemaMigrations,
  getMigrationFiles,
  AppCodeUpdater,
} from '../common';
import { Adapter, DefaultColumnTypes, TransactionAdapter } from 'pqb';
import { pathToLog } from 'orchid-core';
import { RakeDbAst } from '../ast';
import { ChangeCallback, pushChange } from '../migration/change';
import { asMock } from 'test-utils';
import { testConfig } from '../rake-db.test-utils';

jest.mock('../common', () => ({
  ...jest.requireActual('../common'),
  getMigrationFiles: jest.fn(),
  createSchemaMigrations: jest.fn(),
}));

const options = { databaseURL: 'postgres://user@localhost/dbname' };

const files = [
  { path: 'file1', version: '1' },
  { path: 'file2', version: '2' },
  { path: 'file3', version: '3' },
  { path: 'file4', version: '4' },
];

const getMigratedVersionsArrayMock = jest.fn();
Adapter.prototype.arrays = getMigratedVersionsArrayMock;

const queryMock = jest.fn();
Adapter.prototype.query = queryMock;
queryMock.mockImplementation(() => undefined);

Adapter.prototype.transaction = (_, cb) => {
  return cb({} as unknown as TransactionAdapter);
};

const transactionQueryMock = jest.fn();
TransactionAdapter.prototype.query = transactionQueryMock;
TransactionAdapter.prototype.arrays = transactionQueryMock;

const importMock = jest.fn();
const config = {
  ...testConfig,
  import: importMock,
};

const change = (fn: ChangeCallback<DefaultColumnTypes>) => {
  pushChange(fn as unknown as ChangeCallback);
};

const createTableCallback = () => {
  change(async (db) => {
    await db.createTable('table', (t) => ({
      id: t.identity().primaryKey(),
    }));
  });
};

let migrationFiles: { path: string; version: string }[] = [];
asMock(getMigrationFiles).mockImplementation((_, up) =>
  up ? migrationFiles : [...migrationFiles].reverse(),
);

let migratedVersions: string[] = [];
getMigratedVersionsArrayMock.mockImplementation(() => ({
  rows: migratedVersions.map((version) => [version]),
}));

const appCodeUpdater: AppCodeUpdater = {
  process: jest.fn(),
  afterAll: jest.fn(),
};

describe('migrateOrRollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    importMock.mockImplementation(() => undefined);
    for (const key in changeCache) {
      delete changeCache[key];
    }
  });

  describe('migrate', () => {
    it('should work properly', async () => {
      migrationFiles = files.slice(0, 3);
      migratedVersions = ['1'];
      const conf = {
        ...config,
        basePath: __dirname,
        beforeMigrate: jest.fn(),
        afterMigrate: jest.fn(),
      };

      await migrate(options, conf, []);

      expect(getMigrationFiles).toBeCalledWith(conf, true);

      expect(conf.beforeMigrate).toBeCalled();
      expect(conf.afterMigrate).toBeCalled();

      expect(importMock).toBeCalledWith('file2');
      expect(importMock).toBeCalledWith('file3');

      expect(transactionQueryMock).toBeCalledWith(
        `INSERT INTO "schemaMigrations" VALUES ('2')`,
      );
      expect(transactionQueryMock).toBeCalledWith(
        `INSERT INTO "schemaMigrations" VALUES ('3')`,
      );

      expect(config.logger?.log).toBeCalledWith(
        `Migrated ${pathToLog('file2')}`,
      );
      expect(config.logger?.log).toBeCalledWith(
        `Migrated ${pathToLog('file3')}`,
      );
    });

    it('should create migrations table if it not exist', async () => {
      migrationFiles = [];
      getMigratedVersionsArrayMock.mockRejectedValueOnce({ code: '42P01' });
      (createSchemaMigrations as jest.Mock).mockResolvedValueOnce(undefined);

      await migrate(options, config, []);

      expect(getMigrationFiles).toBeCalledWith(config, true);
      expect(createSchemaMigrations).toBeCalled();
      expect(importMock).not.toBeCalled();
      expect(transactionQueryMock).not.toBeCalled();
      expect(config.logger?.log).not.toBeCalled();
    });

    it('should call appCodeUpdater only for the first db options', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [];
      importMock.mockImplementationOnce(createTableCallback);

      await migrate(
        [options, options],
        { ...config, appCodeUpdater, useCodeUpdater: true },
        [],
      );

      expect(appCodeUpdater.process).toBeCalledTimes(1);
      expect(appCodeUpdater.afterAll).toBeCalledTimes(1);
    });

    it('should not call appCodeUpdater when useCodeUpdater is set to false in config', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [];
      importMock.mockImplementation(createTableCallback);

      await migrate(
        options,
        { ...config, appCodeUpdater, useCodeUpdater: false },
        [],
      );

      expect(appCodeUpdater.process).not.toBeCalled();
      expect(appCodeUpdater.afterAll).not.toBeCalled();
    });

    it('should not call appCodeUpdater when having argument --code false', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [];
      importMock.mockImplementation(createTableCallback);

      await migrate(
        options,
        { ...config, appCodeUpdater, useCodeUpdater: true },
        ['--code', 'false'],
      );

      expect(appCodeUpdater.process).not.toBeCalled();
      expect(appCodeUpdater.afterAll).not.toBeCalled();
    });

    it('should call appCodeUpdater when having argument --code', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [];
      importMock.mockImplementation(createTableCallback);

      await migrate(
        options,
        { ...config, appCodeUpdater, useCodeUpdater: false },
        ['--code'],
      );

      expect(appCodeUpdater.process).toBeCalled();
      expect(appCodeUpdater.afterAll).toBeCalled();
    });

    it('should call multiple change callbacks from top to bottom', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [];

      const called: string[] = [];
      importMock.mockImplementation(() => {
        change(async () => {
          called.push('one');
        });
        change(async () => {
          called.push('two');
        });
      });

      await migrate(options, config, []);

      expect(called).toEqual(['one', 'two']);
    });
  });

  describe('rollback', () => {
    it('should work properly', async () => {
      migrationFiles = files.slice(0, 3);
      migratedVersions = ['1', '2'];
      const conf = {
        ...config,
        beforeRollback: jest.fn(),
        afterRollback: jest.fn(),
      };

      await rollback(options, conf, []);

      expect(conf.beforeRollback).toBeCalled();
      expect(conf.afterRollback).toBeCalled();

      expect(getMigrationFiles).toBeCalledWith(conf, false);

      expect(importMock).toBeCalledTimes(1);
      expect(importMock).toBeCalledWith('file2');

      expect(transactionQueryMock).toBeCalledTimes(1);
      expect(transactionQueryMock).toBeCalledWith(
        `DELETE FROM "schemaMigrations" WHERE version = '2'`,
      );

      expect(config.logger?.log).toBeCalledTimes(1);
      expect(config.logger?.log).toBeCalledWith(
        `Rolled back ${pathToLog('file2')}`,
      );
    });

    it('should create migrations table if it not exist', async () => {
      migrationFiles = [];
      getMigratedVersionsArrayMock.mockRejectedValueOnce({ code: '42P01' });
      (createSchemaMigrations as jest.Mock).mockResolvedValueOnce(undefined);

      await rollback(options, config, []);

      expect(getMigrationFiles).toBeCalledWith(config, false);
      expect(createSchemaMigrations).toBeCalled();
      expect(importMock).not.toBeCalled();
      expect(transactionQueryMock).not.toBeCalled();
      expect(config.logger?.log).not.toBeCalled();
    });

    it('should call multiple change callbacks from top to bottom', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [files[0].version];

      const called: string[] = [];
      importMock.mockImplementation(() => {
        change(async () => {
          called.push('one');
        });
        change(async () => {
          called.push('two');
        });
      });

      await rollback(options, config, []);

      expect(called).toEqual(['two', 'one']);
    });
  });

  describe('redo', () => {
    it('should rollback and migrate', async () => {
      migrationFiles = files;
      migratedVersions = files.slice(0, 3).map((file) => file.version);

      const callbackCalls: string[] = [];
      const conf = {
        ...config,
        appCodeUpdater,
        basePath: __dirname,
        beforeMigrate: jest.fn(async () => {
          callbackCalls.push('beforeMigrate');
        }),
        afterMigrate: jest.fn(async () => {
          callbackCalls.push('afterMigrate');
        }),
        beforeRollback: jest.fn(async () => {
          callbackCalls.push('beforeRollback');
        }),
        afterRollback: jest.fn(async () => {
          callbackCalls.push('afterRollback');
          migratedVersions = [files[0].version];
        }),
      };

      const ranMigrations: [string, boolean][] = [];
      importMock.mockImplementation((path) => {
        change(async (db, up) => {
          ranMigrations.push([path, up]);
          db.migratedAsts.push(true as unknown as RakeDbAst);
        });
      });

      const queries: string[] = [];
      transactionQueryMock.mockImplementation((q) => queries.push(q));

      await redo(options, conf, ['2']);

      expect(callbackCalls).toEqual([
        'beforeRollback',
        'afterRollback',
        'beforeMigrate',
        'afterMigrate',
      ]);

      expect(getMigrationFiles).toBeCalledTimes(2);
      expect(getMigrationFiles).toBeCalledWith(expect.any(Object), false);
      expect(getMigrationFiles).toBeCalledWith(expect.any(Object), true);

      expect(ranMigrations).toEqual([
        ['file3', false],
        ['file2', false],
        ['file2', true],
        ['file3', true],
      ]);

      expect(queries).toEqual([
        `DELETE FROM "schemaMigrations" WHERE version = '3'`,
        `DELETE FROM "schemaMigrations" WHERE version = '2'`,
        `INSERT INTO "schemaMigrations" VALUES ('2')`,
        `INSERT INTO "schemaMigrations" VALUES ('3')`,
      ]);

      expect(asMock(config.logger?.log).mock.calls).toEqual([
        [`Rolled back ${pathToLog('file3')}`],
        [`Rolled back ${pathToLog('file2')}`],
        [`Migrated ${pathToLog('file2')}`],
        [`Migrated ${pathToLog('file3')}`],
      ]);

      expect(appCodeUpdater.process).toBeCalledTimes(4);
      expect(appCodeUpdater.afterAll).toBeCalledTimes(2);
    });

    it('should migrate just one if number argument is not provided', async () => {
      migrationFiles = files;
      migratedVersions = files.slice(0, 2).map((file) => file.version);

      await redo(
        options,
        {
          ...config,
          afterRollback: async () => {
            migratedVersions = [files[0].version];
          },
        },
        ['1'],
      );

      expect(asMock(config.logger?.log).mock.calls).toEqual([
        [`Rolled back ${pathToLog('file2')}`],
        [`Migrated ${pathToLog('file2')}`],
      ]);
    });
  });
});
