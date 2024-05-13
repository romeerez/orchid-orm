import { rakeDb } from './rakeDb';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, redo, rollback } from './commands/migrateOrRollback';
import { newMigration } from './commands/newMigration';
import { pullDbStructure } from './generate/pull';
import { RakeDbError } from './errors';
import { runRecurrentMigrations } from './commands/recurrent';
import { asMock } from 'test-utils';
import { noop } from 'orchid-core';
import { clearChanges, getCurrentChanges } from './migration/change';
import { processRakeDbConfig } from './config';

jest.mock('./commands/createOrDrop');
jest.mock('./commands/migrateOrRollback', () => ({
  migrate: jest.fn(() => Promise.resolve()),
  rollback: jest.fn(() => Promise.resolve()),
  redo: jest.fn(() => Promise.resolve()),
}));
jest.mock('./commands/newMigration');
jest.mock('./commands/recurrent');
jest.mock('./generate/pull');

const options = [
  {
    databaseURL: 'one',
  },
  {
    databaseURL: 'two',
  },
];

const config = {
  basePath: '/rake-db',
  dbScript: '/rake-db/script.ts',
  commands: {},
  import: (path: string) => import(path),
};

const processedConfig = processRakeDbConfig(config);

describe('rakeDb', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should support create command', async () => {
    await rakeDb(options, config, ['create']).promise;

    expect(createDb).toBeCalledWith(options, processedConfig, []);
  });

  it('should support drop command', async () => {
    await rakeDb(options, config, ['drop']).promise;

    expect(dropDb).toBeCalledWith(options, processedConfig, []);
  });

  it('should support reset command', async () => {
    await rakeDb(options, config, ['reset']).promise;

    expect(resetDb).toBeCalledWith(options, processedConfig, []);
  });

  it('should run migrations and recurrent on `up` command', async () => {
    await rakeDb(options, config, ['up', 'arg']).promise;

    expect(migrate).toBeCalledWith(
      expect.any(Object),
      options,
      processedConfig,
      ['arg'],
    );
    expect(runRecurrentMigrations).toBeCalledWith(options, processedConfig);
  });

  it('should run rollback on `rollback` and `down` commands', async () => {
    await rakeDb(options, config, ['rollback', 'arg']).promise;
    await rakeDb(options, config, ['down', 'arg']).promise;

    expect(asMock(rollback).mock.calls).toEqual([
      [expect.any(Object), options, processedConfig, ['arg']],
      [expect.any(Object), options, processedConfig, ['arg']],
    ]);
  });

  it('should run redo and recurrent on `redo` command', async () => {
    await rakeDb(options, config, ['redo', 'arg']).promise;

    expect(redo).toBeCalledWith(expect.any(Object), options, processedConfig, [
      'arg',
    ]);
    expect(runRecurrentMigrations).toBeCalledWith(options, processedConfig);
  });

  it('should support new command', async () => {
    await rakeDb(options, config, ['new', 'arg']).promise;

    expect(newMigration).toBeCalledWith(processedConfig, ['arg']);
  });

  it('should support pull command', async () => {
    await rakeDb(options, config, ['pull']).promise;

    expect(pullDbStructure).toBeCalledWith(options[0], processedConfig);
  });

  it('should call recurrent migration by `rec` and `recurrent` command', async () => {
    await rakeDb(options, config, ['rec']).promise;
    await rakeDb(options, config, ['recurrent']).promise;

    expect(asMock(runRecurrentMigrations).mock.calls).toEqual([
      [options, processedConfig, []],
      [options, processedConfig, []],
    ]);
  });

  it('should call a custom command', async () => {
    const custom = jest.fn();

    await rakeDb(options, { ...config, commands: { custom } }, [
      'custom',
      'arg',
    ]).promise;

    expect(custom).toBeCalledWith(
      options,
      { ...processedConfig, commands: { custom } },
      ['arg'],
    );
  });

  it('should log help when other command is sent', async () => {
    const log = jest.fn();

    await rakeDb(options, { ...config, logger: { ...console, log } }, ['other'])
      .promise;

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
      () => rakeDb(options, conf, ['custom']).promise,
    ).rejects.toThrow(err);

    expect(errorLog).toBeCalledWith('message');
    expect(exit).toBeCalledWith(1);
  });

  it('should return a `change` function that saves a change callback, and also returns it', () => {
    const change = rakeDb(options, { ...config, commands: { custom: noop } }, [
      'custom',
    ]);

    const fn = async () => {};
    const result = change(fn);

    expect(getCurrentChanges()).toEqual([fn]);
    expect(result).toBe(fn);
  });

  describe('rakeDb.lazy', () => {
    beforeEach(clearChanges);

    it('should return `change` and `run` functions', () => {
      const custom = jest.fn();

      const { change, run } = rakeDb.lazy(options, {
        ...config,
        commands: { custom },
      });

      const fn = async () => {};
      const result = change(fn);

      expect(getCurrentChanges()).toEqual([fn]);
      expect(result).toBe(fn);

      run(['custom']);

      expect(custom).toBeCalled();
    });

    it('should take optional partial config as the second arg', () => {
      const { change, run } = rakeDb.lazy(options, {
        ...config,
        commands: {
          custom(_, config) {
            config.logger?.log('hello');
          },
        },
      });

      const fn = async () => {};
      const result = change(fn);

      expect(getCurrentChanges()).toEqual([fn]);
      expect(result).toBe(fn);

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
