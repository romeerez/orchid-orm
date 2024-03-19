import {
  changeCache,
  migrate,
  RAKE_DB_LOCK_KEY,
  redo,
  rollback,
} from './migrateOrRollback';
import {
  Adapter,
  DefaultColumnTypes,
  TransactionAdapter,
  DefaultSchemaConfig,
} from 'pqb';
import { noop, pathToLog, Sql } from 'orchid-core';
import { RakeDbAst } from '../ast';
import { ChangeCallback, pushChange } from '../migration/change';
import { asMock } from 'test-utils';
import { testConfig } from '../rake-db.test-utils';
import { AppCodeUpdater, RakeDbColumnTypes } from 'rake-db';
import { AnyRakeDbConfig } from '../config';
import { createMigrationsTable } from '../migration/migrationsTable';
import { getMigrations } from '../migration/migrationsSet';

jest.mock('../migration/migrationsSet', () => ({
  getMigrations: jest.fn(),
}));

jest.mock('../migration/migrationsTable', () => ({
  createMigrationsTable: jest.fn(),
}));

const options = { databaseURL: 'postgres://user@localhost/dbname' };

const makeFile = (version: number, load = jest.fn()) => ({
  path: `path/000${version}_file.ts`,
  name: `file.ts`,
  version: `000${version}`,
  load,
});

const files = [makeFile(1), makeFile(2), makeFile(3), makeFile(4)];

Adapter.prototype.transaction = (_, cb) => {
  return cb({
    query: transactionQueryMock,
    arrays: transactionQueryMock,
  } as unknown as TransactionAdapter);
};

let migratedVersions: string[] = [];
const queries: string[] = [];
const transactionQueryMock = jest.fn().mockImplementation((q) => {
  if (q === 'SELECT * FROM "schemaMigrations" ORDER BY version') {
    return {
      rows: migratedVersions.map((version) => [version, 'name']),
      fields: [{}, {}],
    };
  } else {
    queries.push(q);
    return {
      rows: [],
      fields: [{}, {}],
    };
  }
});

TransactionAdapter.prototype.query = transactionQueryMock;
TransactionAdapter.prototype.arrays = transactionQueryMock;

const config = testConfig;

const change = (
  fn: ChangeCallback<DefaultColumnTypes<DefaultSchemaConfig>>,
) => {
  pushChange(fn as unknown as ChangeCallback<RakeDbColumnTypes>);
};

const createTableCallback = () => {
  change(async (db) => {
    await db.createTable('table', (t) => ({
      id: t.identity().primaryKey(),
    }));
  });
};

let migrationFiles: { path: string; version: string; load(): void }[] = [];
asMock(getMigrations).mockImplementation((_ctx, _config, up) => ({
  migrations: up ? migrationFiles : [...migrationFiles].reverse(),
}));

let currentConfig = undefined as unknown as AnyRakeDbConfig;

const arrange = <
  T extends {
    files?: typeof migrationFiles;
    versions?: string[];
    config?: AnyRakeDbConfig;
  },
>(
  config: T,
): T => {
  if (config.files) migrationFiles = config.files;
  if (config.versions) migratedVersions = config.versions;
  currentConfig = config.config ??= testConfig;
  return config;
};

const act = (
  fn: typeof migrate | typeof rollback | typeof redo,
  args?: string[],
) => fn({}, options, currentConfig, args ?? []);

const appCodeUpdater: AppCodeUpdater = {
  process: jest.fn(),
  afterAll: jest.fn(),
};

const sql = (text: string, values: unknown[]) => ({
  text,
  values,
});

const insertMigration = ({
  version,
  name,
}: {
  version: string;
  name: string;
}) =>
  sql('INSERT INTO "schemaMigrations"(version, name) VALUES ($1, $2)', [
    version,
    name,
  ]);

const deleteMigration = ({
  version,
  name,
}: {
  version: string;
  name: string;
}) =>
  sql('DELETE FROM "schemaMigrations" WHERE version = $1 AND name = $2', [
    version,
    name,
  ]);

const assert = {
  getMigrationsUp: (conf: AnyRakeDbConfig) =>
    expect(getMigrations).toBeCalledWith(expect.any(Object), conf, true),

  getMigrationsDown: (conf: AnyRakeDbConfig) =>
    expect(getMigrations).toBeCalledWith(expect.any(Object), conf, false),

  queries: (sqls: Sql[]) =>
    expect(queries).toEqual([
      `SELECT pg_advisory_xact_lock('${RAKE_DB_LOCK_KEY}')`,
      ...sqls,
    ]),

  logs: (
    args: ({ migrated: { path: string } } | { rolledBack: { path: string } })[],
  ) =>
    expect(asMock(config.logger?.log).mock.calls).toEqual(
      args.map((arg) =>
        'migrated' in arg
          ? [`Migrated ${pathToLog(arg.migrated.path)}`]
          : [`Rolled back ${pathToLog(arg.rolledBack.path)}`],
      ),
    ),
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
      const env = arrange({
        files: files.slice(0, 3),
        versions: ['0001'],
        config: {
          ...config,
          basePath: __dirname,
          beforeMigrate: jest.fn(),
          afterMigrate: jest.fn(),
        },
      });

      await act(migrate);

      assert.getMigrationsUp(env.config);

      expect(env.config.beforeMigrate).toBeCalled();
      expect(env.config.afterMigrate).toBeCalled();

      files.forEach((file, i) => {
        if (i === 1 || i === 2) {
          expect(file.load).toBeCalled();
        } else {
          expect(file.load).not.toBeCalled();
        }
      });

      assert.queries([insertMigration(files[1]), insertMigration(files[2])]);

      assert.logs([{ migrated: files[1] }, { migrated: files[2] }]);
    });

    it('should create migrations table if it not exist', async () => {
      arrange({
        files: [],
        config,
      });

      transactionQueryMock.mockRejectedValueOnce({ code: '42P01' });
      asMock(createMigrationsTable).mockResolvedValueOnce(undefined);

      await act(migrate);

      assert.getMigrationsUp(config);
      expect(createMigrationsTable).toBeCalled();

      for (const file of files) {
        expect(file.load).not.toBeCalled();
      }

      expect(queries).toHaveLength(1);
      assert.logs([]);
    });

    it('should call appCodeUpdater only for the first db options', async () => {
      arrange({
        files: [files[0]],
        versions: [],
        config: {
          ...config,
          appCodeUpdater,
          useCodeUpdater: true,
        },
      });

      files[0].load.mockImplementationOnce(createTableCallback);

      await act(migrate);

      expect(appCodeUpdater.process).toBeCalledTimes(1);
      expect(appCodeUpdater.afterAll).toBeCalledTimes(1);
    });

    it('should not call appCodeUpdater when useCodeUpdater is set to false in config', async () => {
      arrange({
        files: [files[0]],
        versions: [],
        config: {
          ...config,
          appCodeUpdater,
          useCodeUpdater: false,
        },
      });

      files[0].load.mockImplementation(createTableCallback);

      await act(migrate);

      expect(appCodeUpdater.process).not.toBeCalled();
      expect(appCodeUpdater.afterAll).not.toBeCalled();
    });

    it('should not call appCodeUpdater when having argument --code false', async () => {
      arrange({
        files: [files[0]],
        versions: [],
        config: {
          ...config,
          appCodeUpdater,
          useCodeUpdater: true,
        },
      });

      files[0].load.mockImplementation(createTableCallback);

      await act(migrate, ['--code', 'false']);

      expect(appCodeUpdater.process).not.toBeCalled();
      expect(appCodeUpdater.afterAll).not.toBeCalled();
    });

    it('should call appCodeUpdater when having argument --code', async () => {
      arrange({
        files: [files[0]],
        versions: [],
        config: {
          ...config,
          appCodeUpdater,
          useCodeUpdater: false,
        },
      });

      files[0].load.mockImplementation(createTableCallback);

      await act(migrate, ['--code']);

      expect(appCodeUpdater.process).toBeCalled();
      expect(appCodeUpdater.afterAll).toBeCalled();
    });

    it('should call multiple change callbacks from top to bottom', async () => {
      arrange({
        files: [files[0]],
        versions: [],
        config,
      });

      const called: string[] = [];
      files[0].load.mockImplementation(() => {
        change(async () => {
          called.push('one');
        });
        change(async () => {
          called.push('two');
        });
      });

      await act(migrate);

      expect(called).toEqual(['one', 'two']);
    });

    it('should use the returned `default` from `load` fn for a changes if it exists', async () => {
      const changes1 = jest.fn();
      const changes2 = jest.fn();

      arrange({
        files: [
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
        ],
        versions: [],
        config,
      });

      await act(migrate);

      expect(changes1).toBeCalled();
      expect(changes2).toBeCalled();
    });

    it('should migrate array of changes returned in `default` from `load`', async () => {
      const changes1 = jest.fn();
      const changes2 = jest.fn();

      arrange({
        files: [
          {
            ...files[0],
            load: async () => {
              return { default: [changes1, changes2] };
            },
          },
        ],
        versions: [],
      });

      await act(migrate);

      expect(changes1).toBeCalled();
      expect(changes2).toBeCalled();
    });

    it('should throw when `forceDefaultExports` is true and migration has no default export', async () => {
      arrange({
        files: [
          {
            ...files[0],
            load: noop,
          },
        ],
        versions: [],
        config: {
          ...config,
          forceDefaultExports: true,
        },
      });

      await expect(act(migrate)).rejects.toThrow(
        `Missing a default export in ${files[0].path} migration`,
      );
    });

    it('should throw if there is a not migrated migration of version lower than the last migrated', async () => {
      arrange({
        files: [makeFile(1), makeFile(2), makeFile(3)],
        versions: ['0001', '0003'],
      });

      await expect(act(migrate)).rejects.toThrow(
        `Cannot migrate 0002_file.ts because the higher position name was already migrated.\nRun \`**db command** up force\` to rollback the above migrations and migrate all`,
      );
    });
  });

  describe('migrate force', () => {
    it('should rollback to the first out of order migration and then migrate all', async () => {
      const called: [version: number, dir: 'up' | 'down'][] = [];
      const load = (version: number) =>
        jest.fn(() => {
          pushChange(async (_, up) => {
            called.push([version, up ? 'up' : 'down']);
          });
        });

      const env = arrange({
        files: [
          makeFile(1, load(1)),
          makeFile(2, load(2)),
          makeFile(3, load(3)),
          makeFile(4, load(4)),
          makeFile(5, load(5)),
        ],
        versions: ['0001', '0004', '0005'],
        config: {
          ...config,
          beforeRollback: jest.fn(),
          afterRollback: jest.fn(),
          beforeMigrate: jest.fn(),
          afterMigrate: jest.fn(),
        },
      });

      await act(migrate, ['force']);

      expect(env.config.beforeRollback).toBeCalled();
      expect(env.config.afterRollback).toBeCalled();
      expect(env.config.beforeMigrate).toBeCalled();
      expect(env.config.afterMigrate).toBeCalled();

      assert.getMigrationsUp(env.config);

      expect(called).toEqual([
        [5, 'down'],
        [4, 'down'],
        [2, 'up'],
        [3, 'up'],
        [4, 'up'],
        [5, 'up'],
      ]);
    });
  });

  describe('rollback', () => {
    it('should work properly', async () => {
      const env = arrange({
        files: files.slice(0, 3),
        versions: ['0001', '0002'],
        config: {
          ...config,
          beforeRollback: jest.fn(),
          afterRollback: jest.fn(),
        },
      });

      await act(rollback);

      expect(env.config.beforeRollback).toBeCalled();
      expect(env.config.afterRollback).toBeCalled();

      assert.getMigrationsDown(env.config);

      files.forEach((file, i) => {
        if (i === 1) {
          expect(file.load).toBeCalled();
        } else {
          expect(file.load).not.toBeCalled();
        }
      });

      assert.queries([deleteMigration(files[1])]);

      assert.logs([{ rolledBack: files[1] }]);
    });

    it('should create migrations table if it not exist', async () => {
      arrange({
        files: [],
        config,
      });

      transactionQueryMock.mockRejectedValueOnce({ code: '42P01' });
      asMock(createMigrationsTable).mockResolvedValueOnce(undefined);

      await act(rollback);

      assert.getMigrationsDown(config);
      expect(createMigrationsTable).toBeCalled();

      for (const file of files) {
        expect(file.load).not.toBeCalled();
      }

      assert.queries([]);
      assert.logs([]);
    });

    it('should call multiple change callbacks from top to bottom', async () => {
      arrange({
        files: [files[0]],
        versions: [files[0].version],
      });

      const called: string[] = [];
      files[0].load.mockImplementation(() => {
        change(async () => {
          called.push('one');
        });
        change(async () => {
          called.push('two');
        });
      });

      await act(rollback);

      expect(called).toEqual(['two', 'one']);
    });
  });

  describe('redo', () => {
    it('should rollback and migrate', async () => {
      const callbackCalls: string[] = [];

      arrange({
        files,
        versions: files.slice(0, 3).map((file) => file.version),
        config: {
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
            migratedVersions = [files[3].version];
          }),
        },
      });

      const ranMigrations: [string, boolean][] = [];
      for (const file of files) {
        file.load.mockImplementationOnce(() => {
          change(async (db, up) => {
            ranMigrations.push([file.path, up]);
            db.migratedAsts.push(true as unknown as RakeDbAst);
          });
        });
      }

      await act(redo, ['0002']);

      expect(callbackCalls).toEqual([
        'beforeRollback',
        'afterRollback',
        'beforeMigrate',
        'afterMigrate',
      ]);

      expect(asMock(getMigrations).mock.calls).toEqual([
        [expect.any(Object), expect.any(Object), true],
      ]);

      expect(ranMigrations).toEqual([
        [files[2].path, false],
        [files[1].path, false],
        [files[1].path, true],
        [files[2].path, true],
      ]);

      assert.queries([
        sql(`DELETE FROM "schemaMigrations" WHERE version = $1 AND name = $2`, [
          '0003',
          'file.ts',
        ]),
        sql(`DELETE FROM "schemaMigrations" WHERE version = $1 AND name = $2`, [
          '0002',
          'file.ts',
        ]),
        sql(`INSERT INTO "schemaMigrations"(version, name) VALUES ($1, $2)`, [
          '0002',
          'file.ts',
        ]),
        sql(`INSERT INTO "schemaMigrations"(version, name) VALUES ($1, $2)`, [
          '0003',
          'file.ts',
        ]),
      ]);

      assert.logs([
        { rolledBack: files[2] },
        { rolledBack: files[1] },
        { migrated: files[1] },
        { migrated: files[2] },
      ]);

      expect(appCodeUpdater.process).toBeCalledTimes(4);
      expect(appCodeUpdater.afterAll).toBeCalledTimes(1);
    });

    it('should migrate just one if number argument is not provided', async () => {
      arrange({
        files,
        versions: files.map((file) => file.version),
        config: {
          ...config,
          afterRollback: async () => {
            const last = migratedVersions[migratedVersions.length - 1];
            migratedVersions = migratedVersions.filter(
              (version) => version !== last,
            );
          },
        },
      });

      await act(redo);

      assert.logs([{ rolledBack: files[3] }, { migrated: files[3] }]);
    });

    it('should rollback migration changes bottom to top, then migrate them top to bottom', async () => {
      const executed: string[] = [];

      const file = {
        path: 'file1',
        version: '0001',
        load() {
          pushChange(top);
          async function top() {
            executed.push('top');
          }

          pushChange(bottom);
          async function bottom() {
            executed.push('bottom');
          }
        },
      };

      arrange({
        files: [file],
        versions: ['0001'],
        config: {
          ...config,
          afterRollback: async () => {
            migratedVersions = [];
          },
        },
      });

      await act(redo);

      expect(executed).toEqual(['bottom', 'top', 'top', 'bottom']);
    });
  });
});
