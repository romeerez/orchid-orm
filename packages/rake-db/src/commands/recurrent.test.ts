import { runRecurrentMigrations } from './recurrent';
import { readdir, readFile, stat } from 'fs/promises';
import { asMock, TestAdapter } from 'test-utils';
import { join } from 'path';
import { noop } from 'pqb';

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
}));

const log = jest.fn();

const config = {
  recurrentPath: 'migrations/recurrent',
  logger: {
    log,
    error: noop,
    warn: noop,
  },
};

const options = [
  { databaseURL: 'postgres://user@localhost/one' },
  { databaseURL: 'postgres://user@localhost/two' },
];
const adapters = options.map((opts) => new TestAdapter(opts));

describe('recurrent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do nothing if recurrent dir does not exist', async () => {
    asMock(readdir).mockRejectedValueOnce(
      Object.assign(new Error(), {
        code: 'ENOENT',
      }),
    );

    await runRecurrentMigrations(adapters, config);

    expect(readdir).toBeCalledTimes(1);
    expect(log).not.toBeCalled();
  });

  it('should throw if readdir error is not ENOENT', async () => {
    asMock(readdir).mockRejectedValueOnce(new Error('error'));

    await expect(() =>
      runRecurrentMigrations(adapters, config),
    ).rejects.toThrow('error');
  });

  it('should apply sql file', async () => {
    TestAdapter.prototype.arrays = jest.fn();
    TestAdapter.prototype.close = jest.fn();

    const db = {
      adapter: { arrays: TestAdapter.prototype.arrays },
    };

    asMock(readdir).mockResolvedValueOnce(['one.sql']);

    asMock(stat).mockResolvedValueOnce({
      isDirectory: () => false,
      isFile: () => true,
    });

    asMock(readFile).mockImplementation((path) => path);

    await runRecurrentMigrations([adapters[0]], config);

    expect(readdir).toBeCalledWith(config.recurrentPath);

    expect(asMock(stat).mock.calls.flat()).toEqual([
      join(config.recurrentPath, 'one.sql'),
    ]);

    expect(asMock(readFile).mock.calls.map((call) => call[0])).toEqual([
      join(config.recurrentPath, 'one.sql'),
    ]);

    expect(asMock(db.adapter.arrays).mock.calls.flat()).toEqual([
      join(config.recurrentPath, 'one.sql'),
    ]);

    expect(config.logger.log).toBeCalledWith(
      `Applied 1 recurrent migration file`,
    );
  });

  it('should read dir recursively, query each sql file', async () => {
    const query = jest.fn();

    TestAdapter.prototype.arrays = query;

    asMock(readdir).mockResolvedValueOnce([
      'dir',
      'one.sql',
      'two.sql',
      'three.other',
    ]);

    asMock(readdir).mockResolvedValueOnce(['inner.sql']);

    asMock(stat).mockResolvedValueOnce({ isDirectory: () => true });
    asMock(stat).mockResolvedValueOnce({
      isDirectory: () => false,
      isFile: () => true,
    });
    asMock(stat).mockResolvedValueOnce({
      isDirectory: () => false,
      isFile: () => true,
    });
    asMock(stat).mockResolvedValueOnce({
      isDirectory: () => false,
      isFile: () => true,
    });
    asMock(stat).mockResolvedValueOnce({
      isDirectory: () => false,
      isFile: () => true,
    });

    asMock(readFile).mockImplementation((path) => path);

    await runRecurrentMigrations(adapters, config);

    expect(readdir).toBeCalledWith(config.recurrentPath);
    expect(readdir).toBeCalledWith(join(config.recurrentPath, 'dir'));

    expect(asMock(stat).mock.calls.flat()).toEqual([
      join(config.recurrentPath, 'dir'),
      join(config.recurrentPath, 'one.sql'),
      join(config.recurrentPath, 'two.sql'),
      join(config.recurrentPath, 'three.other'),
      join(config.recurrentPath, 'dir/inner.sql'),
    ]);

    expect(asMock(readFile).mock.calls.map((call) => call[0])).toEqual([
      join(config.recurrentPath, 'one.sql'),
      join(config.recurrentPath, 'two.sql'),
      join(config.recurrentPath, 'dir', 'inner.sql'),
    ]);

    expect(asMock(query).mock.calls.flat()).toEqual([
      join(config.recurrentPath, 'one.sql'),
      join(config.recurrentPath, 'one.sql'),
      join(config.recurrentPath, 'two.sql'),
      join(config.recurrentPath, 'two.sql'),
      join(config.recurrentPath, 'dir', 'inner.sql'),
      join(config.recurrentPath, 'dir', 'inner.sql'),
    ]);

    expect(config.logger.log).toBeCalledWith(
      `Applied 3 recurrent migration files`,
    );
  });
});
