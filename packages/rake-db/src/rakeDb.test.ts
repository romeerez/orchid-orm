import { rakeDb } from './rakeDb';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, rollback } from './commands/migrateOrRollback';
import { generate } from './commands/generate';
import { pullDbStructure } from './pull/pull';
import { RakeDbError } from './errors';

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
}));

jest.mock('./commands/generate', () => ({
  generate: jest.fn(),
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
  test('create', async () => {
    await rakeDb(options, config, ['create']);

    expect(createDb).toBeCalledWith(options, config);
  });

  test('drop', async () => {
    await rakeDb(options, config, ['drop']);

    expect(dropDb).toBeCalledWith(options);
  });

  test('reset', async () => {
    await rakeDb(options, config, ['reset']);

    expect(resetDb).toBeCalledWith(options, config);
  });

  test('migrate', async () => {
    await rakeDb(options, config, ['migrate', 'arg']);

    expect(migrate).toBeCalledWith(options, config, ['arg']);
  });

  test('rollback', async () => {
    await rakeDb(options, config, ['rollback', 'arg']);

    expect(rollback).toBeCalledWith(options, config, ['arg']);
  });

  test('generate', async () => {
    await rakeDb(options, config, ['g', 'arg']);

    expect(generate).toBeCalledWith(config, ['arg']);

    jest.clearAllMocks();

    await rakeDb(options, config, ['generate', 'arg']);

    expect(generate).toBeCalledWith(config, ['arg']);
  });

  test('pull', async () => {
    await rakeDb(options, config, ['pull']);

    expect(pullDbStructure).toBeCalledWith(options[0], config);
  });

  test('custom command', async () => {
    const custom = jest.fn();

    const conf = { ...config, commands: { custom } };

    await rakeDb(options, conf, ['custom', 'arg']);

    expect(custom).toBeCalledWith(options, conf, ['arg']);
  });

  test('other', async () => {
    const log = jest.fn();
    console.log = log;

    await rakeDb(options, config, ['other']);

    expect(log).toBeCalled();
  });

  it('should log error and exit process with 1 when RakeDbError thrown', async () => {
    const errorLog = jest.fn();
    const exit = jest.fn(() => undefined as never);
    console.error = errorLog;
    process.exit = exit;

    const err = new RakeDbError('message');
    const custom = () => {
      throw err;
    };

    const conf = { ...config, commands: { custom } };

    await expect(() => rakeDb(options, conf, ['custom'])).rejects.toThrow(err);

    expect(errorLog).toBeCalledWith('message');
    expect(exit).toBeCalledWith(1);
  });
});
