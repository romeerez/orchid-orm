import {
  changeCache,
  migrate,
  RAKE_DB_LOCK_KEY,
  redo,
  rollback,
} from './migrateOrRollback';
import {
  createSchemaMigrations,
  getMigrations,
  AppCodeUpdater,
  RakeDbColumnTypes,
} from '../common';
import {
  Adapter,
  DefaultColumnTypes,
  TransactionAdapter,
  DefaultSchemaConfig,
} from 'pqb';
import { ColumnSchemaConfig, noop, pathToLog } from 'orchid-core';
import { RakeDbAst } from '../ast';
import { ChangeCallback, pushChange } from '../migration/change';
import { asMock } from 'test-utils';
import { testConfig } from '../rake-db.test-utils';

jest.mock('../common', () => ({
  ...jest.requireActual('../common'),
  getMigrations: jest.fn(),
  createSchemaMigrations: jest.fn(),
}));

const options = { databaseURL: 'postgres://user@localhost/dbname' };

const files = [
  { path: 'file1', version: '1', load: jest.fn() },
  { path: 'file2', version: '2', load: jest.fn() },
  { path: 'file3', version: '3', load: jest.fn() },
  { path: 'file4', version: '4', load: jest.fn() },
];

Adapter.prototype.transaction = (_, cb) => {
  return cb({
    query: transactionQueryMock,
    arrays: transactionQueryMock,
  } as unknown as TransactionAdapter);
};

let migratedVersions: string[] = [];
const queries: string[] = [];
const transactionQueryMock = jest.fn().mockImplementation((q) => {
  if (q === 'SELECT * FROM "schemaMigrations"') {
    return {
      rows: migratedVersions.map((version) => [version]),
    };
  } else {
    queries.push(q);
    return {
      rows: [],
    };
  }
});

TransactionAdapter.prototype.query = transactionQueryMock;
TransactionAdapter.prototype.arrays = transactionQueryMock;

const config = testConfig;

const change = (
  fn: ChangeCallback<
    ColumnSchemaConfig,
    DefaultColumnTypes<DefaultSchemaConfig>
  >,
) => {
  pushChange(
    fn as unknown as ChangeCallback<ColumnSchemaConfig, RakeDbColumnTypes>,
  );
};

const createTableCallback = () => {
  change(async (db) => {
    await db.createTable('table', (t) => ({
      id: t.identity().primaryKey(),
    }));
  });
};

let migrationFiles: { path: string; version: string; load(): void }[] = [];
asMock(getMigrations).mockImplementation((_, up) =>
  up ? migrationFiles : [...migrationFiles].reverse(),
);

const appCodeUpdater: AppCodeUpdater = {
  process: jest.fn(),
  afterAll: jest.fn(),
};

describe('migrateOrRollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queries.length = 0;
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

      expect(getMigrations).toBeCalledWith(conf, true);

      expect(conf.beforeMigrate).toBeCalled();
      expect(conf.afterMigrate).toBeCalled();

      files.forEach((file, i) => {
        if (i === 1 || i === 2) {
          expect(file.load).toBeCalled();
        } else {
          expect(file.load).not.toBeCalled();
        }
      });

      expect(queries).toEqual([
        `SELECT pg_advisory_xact_lock('${RAKE_DB_LOCK_KEY}')`,
        `INSERT INTO "schemaMigrations" VALUES ('2')`,
        `INSERT INTO "schemaMigrations" VALUES ('3')`,
      ]);

      expect(asMock(config.logger?.log).mock.calls).toEqual([
        [`Migrated ${pathToLog('file2')}`],
        [`Migrated ${pathToLog('file3')}`],
      ]);
    });

    it('should create migrations table if it not exist', async () => {
      migrationFiles = [];
      transactionQueryMock.mockResolvedValueOnce({});
      transactionQueryMock.mockRejectedValueOnce({ code: '42P01' });
      (createSchemaMigrations as jest.Mock).mockResolvedValueOnce(undefined);

      await migrate(options, config, []);

      expect(getMigrations).toBeCalledWith(config, true);
      expect(createSchemaMigrations).toBeCalled();

      for (const file of files) {
        expect(file.load).not.toBeCalled();
      }

      expect(queries).toHaveLength(0);
      expect(config.logger?.log).not.toBeCalled();
    });

    it('should call appCodeUpdater only for the first db options', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [];
      files[0].load.mockImplementationOnce(createTableCallback);

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
      files[0].load.mockImplementation(createTableCallback);

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
      files[0].load.mockImplementation(createTableCallback);

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
      files[0].load.mockImplementation(createTableCallback);

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
      files[0].load.mockImplementation(() => {
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

    it('should use the returned `default` from `load` fn for a changes if it exists', async () => {
      const changes1 = jest.fn();
      const changes2 = jest.fn();

      migrationFiles = [
        {
          ...files[0],
          load: async () => {
            return { default: changes1 };
          },
        },
        {
          ...files[1],
          load: async () => {
            return { default: changes2 };
          },
        },
      ];
      migratedVersions = [];

      await migrate(options, config, []);

      expect(changes1).toBeCalled();
      expect(changes2).toBeCalled();
    });

    it('should migrate array of changes returned in `default` from `load`', async () => {
      const changes1 = jest.fn();
      const changes2 = jest.fn();

      migrationFiles = [
        {
          ...files[0],
          load: async () => {
            return { default: [changes1, changes2] };
          },
        },
      ];
      migratedVersions = [];

      await migrate(options, config, []);

      expect(changes1).toBeCalled();
      expect(changes2).toBeCalled();
    });

    it('should throw when `forceDefaultExports` is true and migration has no default export', async () => {
      migrationFiles = [
        {
          ...files[0],
          load: noop,
        },
      ];
      migratedVersions = [];

      await expect(
        migrate(options, { ...config, forceDefaultExports: true }, []),
      ).rejects.toThrow(
        `Missing a default export in ${files[0].path} migration`,
      );
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

      expect(getMigrations).toBeCalledWith(conf, false);

      files.forEach((file, i) => {
        if (i === 1) {
          expect(file.load).toBeCalled();
        } else {
          expect(file.load).not.toBeCalled();
        }
      });

      expect(queries).toEqual([
        `SELECT pg_advisory_xact_lock('${RAKE_DB_LOCK_KEY}')`,
        `DELETE FROM "schemaMigrations" WHERE version = '2'`,
      ]);

      expect(asMock(config.logger?.log).mock.calls).toEqual([
        [`Rolled back ${pathToLog('file2')}`],
      ]);
    });

    it('should create migrations table if it not exist', async () => {
      migrationFiles = [];
      transactionQueryMock.mockResolvedValueOnce({});
      transactionQueryMock.mockRejectedValueOnce({ code: '42P01' });
      (createSchemaMigrations as jest.Mock).mockResolvedValueOnce(undefined);

      await rollback(options, config, []);

      expect(getMigrations).toBeCalledWith(config, false);
      expect(createSchemaMigrations).toBeCalled();

      for (const file of files) {
        expect(file.load).not.toBeCalled();
      }

      expect(queries).toHaveLength(0);
      expect(config.logger?.log).not.toBeCalled();
    });

    it('should call multiple change callbacks from top to bottom', async () => {
      migrationFiles = [files[0]];
      migratedVersions = [files[0].version];

      const called: string[] = [];
      files[0].load.mockImplementation(() => {
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
      for (const file of files) {
        file.load.mockImplementationOnce(() => {
          change(async (db, up) => {
            ranMigrations.push([file.path, up]);
            db.migratedAsts.push(true as unknown as RakeDbAst);
          });
        });
      }

      await redo(options, conf, ['2']);

      expect(callbackCalls).toEqual([
        'beforeRollback',
        'afterRollback',
        'beforeMigrate',
        'afterMigrate',
      ]);

      expect(asMock(getMigrations).mock.calls).toEqual([
        [expect.any(Object), false],
      ]);

      expect(ranMigrations).toEqual([
        ['file3', false],
        ['file2', false],
        ['file2', true],
        ['file3', true],
      ]);

      expect(queries).toEqual([
        `SELECT pg_advisory_xact_lock('${RAKE_DB_LOCK_KEY}')`,
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
      expect(appCodeUpdater.afterAll).toBeCalledTimes(1);
    });

    it('should migrate just one if number argument is not provided', async () => {
      migrationFiles = files;
      migratedVersions = files.map((file) => file.version);

      await redo(
        options,
        {
          ...config,
          afterRollback: async () => {
            const last = migratedVersions[migratedVersions.length - 1];
            migratedVersions = migratedVersions.filter(
              (version) => version !== last,
            );
          },
        },
        [],
      );

      expect(asMock(config.logger?.log).mock.calls).toEqual([
        [`Rolled back ${pathToLog('file4')}`],
        [`Migrated ${pathToLog('file4')}`],
      ]);
    });

    it('should rollback migration changes bottom to top, then migrate them top to bottom', async () => {
      const executed: string[] = [];

      const file = {
        path: 'file1',
        version: '1',
        load() {
          pushChange(async () => {
            executed.push('top');
          });

          pushChange(async () => {
            executed.push('bottom');
          });
        },
      };

      migrationFiles = [file];
      migratedVersions = ['1'];

      await redo(
        options,
        {
          ...config,
          afterRollback: async () => {
            migratedVersions = [];
          },
        },
        [],
      );

      expect(executed).toEqual(['bottom', 'top', 'top', 'bottom']);
    });
  });
});
