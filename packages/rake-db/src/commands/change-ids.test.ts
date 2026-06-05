import { changeIds, fileNamesToChangeMigrationId } from './change-ids';
import { testConfig } from '../rake-db.test-utils';
import { RakeDbConfig, RakeDbMigrationId } from '../config';
import { getMigrations } from '../migration/migrations-set';
import { asMock, TestAdapter } from 'test-utils';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateTimeStamp } from './new-migration';
import { AdapterClass, QueryLogger } from 'pqb/internal';

jest.mock('../migration/migrations-set');
jest.mock('node:fs/promises');
jest.mock('./new-migration');

const options = [
  { databaseURL: 'postgres://user@localhost/dbname' },
  { databaseURL: 'postgres://user@localhost/dbname-test' },
];
const adapters = options.map(
  (config) => new AdapterClass({ driverAdapter: TestAdapter, config }),
);

let config = testConfig;

const arrange = (arg: {
  config?: Partial<RakeDbConfig>;
  files?: string[];
  renameTo?: RakeDbMigrationId;
}) => {
  config = arg.config ? { ...testConfig, ...arg.config } : testConfig;

  const files = arg.files ?? [];

  asMock(getMigrations).mockImplementation(
    (
      _ctx,
      _config,
      _up,
      _allowDuplicates,
      fn: (_: RakeDbConfig, name: string) => string,
    ) => {
      return {
        renameTo: { to: arg.renameTo },
        migrations: files.map((file) => ({
          path: file,
          version: fn(config, file),
        })),
      };
    },
  );

  let timestamp = 1;
  asMock(generateTimeStamp).mockImplementation(() => `100${timestamp++}`);
};

const act = (format: 'serial' | 'timestamp') =>
  changeIds(adapters, config, { format });

const query = jest.fn();
AdapterClass.prototype.arrays = query;

describe('changeIds', () => {
  beforeEach(jest.resetAllMocks);

  it('should throw when file has no digits prefix', async () => {
    arrange({
      files: ['file'],
    });

    await expect(act('serial')).rejects.toThrow(
      `Migration file name should start digits, received file`,
    );
  });

  it('should exit early when already having a target file for renaming', async () => {
    const logger = {
      ...console.log,
      log: jest.fn(),
    } as unknown as QueryLogger;

    arrange({
      config: {
        logger,
      },
      renameTo: { serial: 4 },
    });

    await act('serial');

    expect(logger.log).toHaveBeenCalledWith(
      `.rename-to-serial.json already exists`,
    );
  });

  it('should remove existing file for renaming if it is for a different kind', async () => {
    arrange({
      renameTo: 'timestamp',
    });

    await act('serial');

    expect(fs.unlink).toHaveBeenCalledWith(
      path.join(config.migrationsPath, '.rename-to-timestamp.json'),
    );
  });

  it('should create a file for renaming to serial', async () => {
    arrange({ files: ['111_a.ts', '222_b.ts', '333_c.ts'] });

    await act('serial');

    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(config.migrationsPath, fileNamesToChangeMigrationId.serial),
      `{
  "111_a.ts": 1,
  "222_b.ts": 2,
  "333_c.ts": 3
}`,
    );
  });

  it('should create a file for renaming to timestamp', async () => {
    arrange({ files: ['111_a.ts', '222_b.ts', '333_c.ts'] });

    await act('timestamp');

    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(config.migrationsPath, fileNamesToChangeMigrationId.timestamp),
      `{
  "111_a.ts": 1001,
  "222_b.ts": 1002,
  "333_c.ts": 1003
}`,
    );
  });

  it('should rename files', async () => {
    arrange({ files: ['111_a.ts', '222_b.ts', '333_c.ts'] });

    await act('serial');

    expect(asMock(fs.rename).mock.calls).toEqual([
      ['111_a.ts', '0001_a.ts'],
      ['222_b.ts', '0002_b.ts'],
      ['333_c.ts', '0003_c.ts'],
    ]);
  });

  it('should update migrations in the database', async () => {
    arrange({ files: ['111_a.ts', '222_b.ts', '333_c.ts'] });

    await act('serial');

    expect(query).toHaveBeenCalledWith(
      `UPDATE "schemaMigrations" AS t SET version = v.version FROM (VALUES ` +
        `('111', $1, '0001'), ` +
        `('222', $2, '0002'), ` +
        `('333', $3, '0003')` +
        `) v(oldVersion, name, version) WHERE t.version = v.oldVersion`,
      ['a.ts', 'b.ts', 'c.ts'],
    );
  });
});
