import { rakeDb } from './rakeDb';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, redo, rollback } from './commands/migrateOrRollback';
import { generate } from './commands/generate';
import { pullDbStructure } from './pull/pull';
import { RakeDbError } from './errors';
import { runRecurrentMigrations } from './commands/recurrent';
import { asMock } from 'test-utils';
import { noop } from 'orchid-core';
import { clearChanges, getCurrentChanges } from './migration/change';

jest.mock('./common', () => ({
  processRakeDbConfig: (config: unknown) => config,
}));

jest.mock('./commands/createOrDrop', () => ({
  createDb: jest.fn(),
  dropDb: jest.fn(),
  resetDb: jest.fn(),
}));

jest.mock('./commands/migrateOrRollback', () => ({
  migrate: jest.fn(),
  rollback: jest.fn(),
  redo: jest.fn(),
}));

jest.mock('./commands/generate', () => ({
  generate: jest.fn(),
}));

jest.mock('./commands/recurrent', () => ({
  runRecurrentMigrations: jest.fn(),
}));

jest.mock('./pull/pull', () => ({
  pullDbStructure: jest.fn(),
}));

const options = [
  {
    databaseURL: 'one',
  },
  {
    databaseURL: 'two',
  },
];

const config = {
  migrationsPath: 'migrations',
  commands: {},
};

describe('rakeDb', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should support create command', async () => {
    await rakeDb(options, config, ['create']).promise;

    expect(createDb).toBeCalledWith(options, config);
  });

  it('should support drop command', async () => {
    await rakeDb(options, config, ['drop']).promise;

    expect(dropDb).toBeCalledWith(options, config);
  });

  it('should support reset command', async () => {
    await rakeDb(options, config, ['reset']).promise;

    expect(resetDb).toBeCalledWith(options, config);
  });

  it('should run migrations and recurrent on `migrate` command', async () => {
    await rakeDb(options, config, ['migrate', 'arg']).promise;

    expect(migrate).toBeCalledWith(options, config, ['arg']);
    expect(runRecurrentMigrations).toBeCalledWith(options, config);
  });

  it('should run migrations without recurrent on `up` command', async () => {
    await rakeDb(options, config, ['up', 'arg']).promise;

    expect(migrate).toBeCalledWith(options, config, ['arg']);
    expect(runRecurrentMigrations).not.toBeCalled();
  });

  it('should run rollback on `rollback` and `down` commands', async () => {
    await rakeDb(options, config, ['rollback', 'arg']).promise;
    await rakeDb(options, config, ['down', 'arg']).promise;

    expect(asMock(rollback).mock.calls).toEqual([
      [options, config, ['arg']],
      [options, config, ['arg']],
    ]);
  });

  it('should run redo and recurrent on `redo` command', async () => {
    await rakeDb(options, config, ['redo', 'arg']).promise;

    expect(redo).toBeCalledWith(options, config, ['arg']);
    expect(runRecurrentMigrations).toBeCalledWith(options, config);
  });

  it('should support new command', async () => {
    await rakeDb(options, config, ['new', 'arg']).promise;

    expect(generate).toBeCalledWith(config, ['arg']);
  });

  it('should support pull command', async () => {
    await rakeDb(options, config, ['pull']).promise;

    expect(pullDbStructure).toBeCalledWith(options[0], config);
  });

  it('should call recurrent migration by `rec` and `recurrent` command', async () => {
    await rakeDb(options, config, ['rec']).promise;
    await rakeDb(options, config, ['recurrent']).promise;

    expect(asMock(runRecurrentMigrations).mock.calls).toEqual([
      [options, config],
      [options, config],
    ]);
  });

  it('should call a custom command', async () => {
    const custom = jest.fn();

    const conf = { ...config, commands: { custom } };

    await rakeDb(options, conf, ['custom', 'arg']).promise;

    expect(custom).toBeCalledWith(options, conf, ['arg']);
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
    beforeAll(clearChanges);

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
  });
});
