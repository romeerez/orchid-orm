import { runRecurrentMigrations } from './recurrent';
import { testConfig } from '../rake-db.test-utils';
import { readdir, readFile, stat } from 'fs/promises';
import { asMock } from 'test-utils';
import { join } from 'path';
import { Adapter } from 'pqb';

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
}));

const options = [
  { databaseURL: 'postgres://user@localhost/one' },
  { databaseURL: 'postgres://user@localhost/two' },
];

const log = testConfig.logger.log;

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

    await runRecurrentMigrations(options, testConfig);

    expect(readdir).toBeCalledTimes(1);
    expect(log).not.toBeCalled();
  });

  it('should throw if readdir error is not ENOENT', async () => {
    asMock(readdir).mockRejectedValueOnce(new Error('error'));

    await expect(() =>
      runRecurrentMigrations(options, testConfig),
    ).rejects.toThrow('error');
  });

  it('should apply sql file', async () => {
    Adapter.prototype.arrays = jest.fn();
    Adapter.prototype.close = jest.fn();

    const db = {
      adapter: { arrays: Adapter.prototype.arrays },
      close: Adapter.prototype.close,
    };

    asMock(readdir).mockResolvedValueOnce(['one.sql']);

    asMock(stat).mockResolvedValueOnce({
      isDirectory: () => false,
      isFile: () => true,
    });

    asMock(readFile).mockImplementation((path) => path);

    await runRecurrentMigrations([options[0]], testConfig);

    expect(readdir).toBeCalledWith(testConfig.recurrentPath);

    expect(asMock(stat).mock.calls.flat()).toEqual([
      join(testConfig.recurrentPath, 'one.sql'),
    ]);

    expect(asMock(readFile).mock.calls.map((call) => call[0])).toEqual([
      join(testConfig.recurrentPath, 'one.sql'),
    ]);

    expect(asMock(db.adapter.arrays).mock.calls.flat()).toEqual([
      join(testConfig.recurrentPath, 'one.sql'),
    ]);

    expect(db.close).toBeCalled();

    expect(testConfig.logger.log).toBeCalledWith(
      `Applied 1 recurrent migration file`,
    );
  });

  it('should read dir recursively, query each sql file', async () => {
    const query = jest.fn();
    const close = jest.fn();

    Adapter.prototype.arrays = query;
    Adapter.prototype.close = close;

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

    await runRecurrentMigrations(options, testConfig);

    expect(readdir).toBeCalledWith(testConfig.recurrentPath);
    expect(readdir).toBeCalledWith(join(testConfig.recurrentPath, 'dir'));

    expect(asMock(stat).mock.calls.flat()).toEqual([
      join(testConfig.recurrentPath, 'dir'),
      join(testConfig.recurrentPath, 'one.sql'),
      join(testConfig.recurrentPath, 'two.sql'),
      join(testConfig.recurrentPath, 'three.other'),
      join(testConfig.recurrentPath, 'dir/inner.sql'),
    ]);

    expect(asMock(readFile).mock.calls.map((call) => call[0])).toEqual([
      join(testConfig.recurrentPath, 'one.sql'),
      join(testConfig.recurrentPath, 'two.sql'),
      join(testConfig.recurrentPath, 'dir', 'inner.sql'),
    ]);

    expect(asMock(query).mock.calls.flat()).toEqual([
      join(testConfig.recurrentPath, 'one.sql'),
      join(testConfig.recurrentPath, 'one.sql'),
      join(testConfig.recurrentPath, 'two.sql'),
      join(testConfig.recurrentPath, 'two.sql'),
      join(testConfig.recurrentPath, 'dir', 'inner.sql'),
      join(testConfig.recurrentPath, 'dir', 'inner.sql'),
    ]);

    expect(close).toBeCalledTimes(2);

    expect(testConfig.logger.log).toBeCalledWith(
      `Applied 3 recurrent migration files`,
    );
  });
});
