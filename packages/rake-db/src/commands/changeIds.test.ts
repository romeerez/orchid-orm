import { changeIds, fileNamesToChangeMigrationId } from './changeIds';
import { testConfig } from '../rake-db.test-utils';
import { AnyRakeDbConfig, RakeDbMigrationId } from '../config';
import { getMigrationsFromFiles } from '../migration/migrationsSet';
import { asMock } from 'test-utils';
import { Adapter, QueryLogger } from 'pqb';
import fs from 'fs/promises';
import path from 'path';
import { generateTimeStamp } from './newMigration';

jest.mock('../migration/migrationsSet');
jest.mock('fs/promises');
jest.mock('./newMigration');

const options = [
  { databaseURL: 'postgres://user@localhost/dbname' },
  { databaseURL: 'postgres://user@localhost/dbname-test' },
];

let config = testConfig;

const arrange = (arg: {
  config?: Partial<AnyRakeDbConfig>;
  files?: string[];
  renameTo?: RakeDbMigrationId;
}) => {
  config = arg.config ? { ...testConfig, ...arg.config } : testConfig;

  const files = arg.files ?? [];

  asMock(getMigrationsFromFiles).mockImplementation(
    (
      _config,
      _allowDuplicates,
      fn: (_: AnyRakeDbConfig, name: string) => string,
    ) => {
      return {
        renameTo: arg.renameTo,
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

const act = (arg: string) => changeIds(options, config, [arg]);

const query = jest.fn();
Adapter.prototype.arrays = query;

describe('changeIds', () => {
  beforeEach(jest.resetAllMocks);

  it('should throw on invalid argument', async () => {
    await expect(act('')).rejects.toThrow(
      `Pass "serial" or "timestamp" argument to the "change-ids" command`,
    );
  });

  it('should throw if config has migrations', async () => {
    arrange({
      config: {
        migrations: {},
      },
    });

    await expect(act('serial')).rejects.toThrow(
      `Cannot change migrations ids when migrations set is defined in the config`,
    );
  });

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
      renameTo: 'serial',
    });

    await act('serial');

    expect(logger.log).toBeCalledWith(`.rename-to-serial.json already exists`);
  });

  it('should remove existing file for renaming if it is for a different kind', async () => {
    arrange({
      renameTo: 'timestamp',
    });

    await act('serial');

    expect(fs.unlink).toBeCalledWith(
      path.join(config.migrationsPath, '.rename-to-timestamp.json'),
    );
  });

  it('should create a file for renaming to serial', async () => {
    arrange({ files: ['111_a.ts', '222_b.ts', '333_c.ts'] });

    await act('serial');

    expect(fs.writeFile).toBeCalledWith(
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

    expect(fs.writeFile).toBeCalledWith(
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

    expect(query).toBeCalledWith({
      text:
        `UPDATE "schemaMigrations" AS t SET version = v.version FROM (VALUES ` +
        `('111', $1, '0001'), ` +
        `('222', $2, '0002'), ` +
        `('333', $3, '0003')` +
        `) v(oldVersion, name, version) WHERE t.version = v.oldVersion`,
      values: ['a.ts', 'b.ts', 'c.ts'],
    });
  });
});
