import { createDb, dropDb, resetDb } from './commands/create-or-drop';
import {
  migrateCommand,
  redoCommand,
  rollbackCommand,
} from './commands/migrate-or-rollback';
import { newMigration } from './commands/new-migration';
import { pullDbStructure } from './generate/pull';
import { RakeDbError } from './errors';
import { runRecurrentMigrations } from './commands/recurrent';
import { asMock, assertType, TestAdapter, testRakeDb } from 'test-utils';
import { clearChanges, getCurrentChanges } from './migration/change';
import { processRakeDbConfig } from './config';
import { noop, DefaultSchemaConfig, IntegerColumn } from 'pqb';

jest.mock('./commands/create-or-drop', () => ({
  createDb: jest.fn(() => Promise.resolve()),
  dropDb: jest.fn(() => Promise.resolve()),
  resetDb: jest.fn(() => Promise.resolve()),
}));
jest.mock('./commands/migrate-or-rollback', () => ({
  migrateCommand: jest.fn(() => Promise.resolve()),
  rollbackCommand: jest.fn(() => Promise.resolve()),
  redoCommand: jest.fn(() => Promise.resolve()),
}));
jest.mock('./commands/new-migration');
jest.mock('./commands/recurrent', () => ({
  runRecurrentMigrations: jest.fn(() => Promise.resolve()),
}));
jest.mock('./generate/pull', () => ({
  pullDbStructure: jest.fn(() => Promise.resolve()),
}));

const options = [
  {
    databaseURL: 'postgres://user:pass@host:1234/one',
  },
  {
    databaseURL: 'postgres://user:pass@host:1234/two',
  },
];

const expectedAdapters = [expect.any(TestAdapter), expect.any(TestAdapter)];

const config = {
  columnTypes: {},
  basePath: '/rake-db',
  dbScript: '/rake-db/script.ts',
  commands: {},
  import: (path: string) => import(path),
};

const processedConfig = processRakeDbConfig(config);

describe('rakeDb', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should support create command', async () => {
    await testRakeDb(options, config, ['create']).promise;

    expect(createDb).toBeCalledWith(expectedAdapters, processedConfig, []);
  });

  it('should support drop command', async () => {
    await testRakeDb(options, config, ['drop']).promise;

    expect(dropDb).toBeCalledWith(expectedAdapters, processedConfig, []);
  });

  it('should support reset command, run recurrent migrations', async () => {
    await testRakeDb(options, config, ['reset']).promise;

    expect(resetDb).toBeCalledWith(expectedAdapters, processedConfig);

    expect(runRecurrentMigrations).toBeCalledWith(
      expectedAdapters,
      processedConfig,
    );
  });

  it('should run migrations and recurrent on `up` command', async () => {
    await testRakeDb(options, config, ['up', 'arg']).promise;

    expect(migrateCommand).toBeCalledWith(expectedAdapters, processedConfig, [
      'arg',
    ]);
    expect(runRecurrentMigrations).toBeCalledWith(
      expectedAdapters,
      processedConfig,
    );
  });

  it('should run rollback on `rollback` and `down` commands', async () => {
    await testRakeDb(options, config, ['rollback', 'arg']).promise;
    await testRakeDb(options, config, ['down', 'arg']).promise;

    expect(asMock(rollbackCommand).mock.calls).toEqual([
      [expectedAdapters, processedConfig, ['arg']],
      [expectedAdapters, processedConfig, ['arg']],
    ]);
  });

  it('should run redo and recurrent on `redo` command', async () => {
    await testRakeDb(options, config, ['redo', 'arg']).promise;

    expect(redoCommand).toBeCalledWith(expectedAdapters, processedConfig, [
      'arg',
    ]);
    expect(runRecurrentMigrations).toBeCalledWith(
      expectedAdapters,
      processedConfig,
    );
  });

  it('should support new command', async () => {
    await testRakeDb(options, config, ['new', 'arg']).promise;

    expect(newMigration).toBeCalledWith(processedConfig, ['arg']);
  });

  it('should support pull command', async () => {
    await testRakeDb(options, config, ['pull']).promise;

    expect(pullDbStructure).toBeCalledWith(
      expect.any(TestAdapter),
      processedConfig,
    );
  });

  it('should call recurrent migration by `rec` and `recurrent` command', async () => {
    await testRakeDb(options, config, ['rec']).promise;
    await testRakeDb(options, config, ['recurrent']).promise;

    expect(asMock(runRecurrentMigrations).mock.calls).toEqual([
      [expectedAdapters, processedConfig],
      [expectedAdapters, processedConfig],
    ]);
  });

  it('should call a custom command', async () => {
    const custom = jest.fn();

    await testRakeDb(options, { ...config, commands: { custom } }, [
      'custom',
      'arg',
    ]).promise;

    expect(custom).toBeCalledWith(
      expectedAdapters,
      { ...processedConfig, commands: { custom } },
      ['arg'],
    );
  });

  it('should log help when other command is sent', async () => {
    const log = jest.fn();

    await testRakeDb(options, { ...config, logger: { ...console, log } }, [
      'other',
    ]).promise;

    expect(log).toBeCalled();
  });

  it('should log error and exit process with 1 when RakeDbError thrown', async () => {
    const errorLog = jest.fn();
    const exit = jest.fn(() => undefined as never);
    process.exit = exit;

    const err = new RakeDbError('message');
    const custom = () => {
      throw err;
    };

    const conf = {
      ...config,
      logger: { ...console, error: errorLog },
      commands: { custom },
    };

    await expect(
      () => testRakeDb(options, conf, ['custom']).promise,
    ).rejects.toThrow(err);

    expect(errorLog).toBeCalledWith('message');
    expect(exit).toBeCalledWith(1);
  });

  it('should return a `change` function that saves a change callback, and also returns it', () => {
    const change = testRakeDb(
      options,
      { ...config, commands: { custom: noop } },
      ['custom'],
    );

    const fn = async () => {};
    const result = change(fn);

    expect(getCurrentChanges()).toEqual([{ fn, config: expect.any(Object) }]);
    expect(result.fn).toBe(fn);
  });

  describe('testRakeDb.lazy', () => {
    beforeEach(clearChanges);

    // for issue https://github.com/romeerez/orchid-orm/issues/538
    it('should have proper types for columns', () => {
      const { change } = testRakeDb.lazy(options, {
        migrations: {} as never,
      });

      change(async (db) => {
        db.createTable('table', (t) => {
          const column = t.integer();
          assertType<typeof column, IntegerColumn<DefaultSchemaConfig>>();
          return {};
        });
      });
    });

    it('should return `change` and `run` functions', () => {
      const custom = jest.fn();

      const { change, run } = testRakeDb.lazy(options, {
        ...config,
        commands: { custom },
      });

      const fn = async () => {};
      const result = change(fn);

      expect(getCurrentChanges()).toEqual([{ fn, config: expect.any(Object) }]);
      expect(result.fn).toBe(fn);

      run(['custom']);

      expect(custom).toBeCalled();
    });

    it('should take optional partial config as the second arg', () => {
      const { change, run } = testRakeDb.lazy(options, {
        ...config,
        commands: {
          custom(_, config) {
            config.logger?.log('hello');
          },
        },
      });

      const fn = async () => {};
      const result = change(fn);

      expect(getCurrentChanges()).toEqual([{ fn, config: expect.any(Object) }]);
      expect(result.fn).toBe(fn);

      const log = jest.fn();
      run(['custom'], {
        log: true,
        logger: {
          ...console,
          log,
        },
      });

      expect(log).toBeCalledWith('hello');
    });
  });
});
