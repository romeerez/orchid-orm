import { migrate, rollback } from './migrateOrRollback';
import { createSchemaMigrations, migrationConfigDefaults } from '../common';
import { getMigrationFiles } from '../common';
import { Adapter, TransactionAdapter } from 'pqb';
import { Migration } from '../migration/migration';

jest.mock('../common', () => ({
  ...jest.requireActual('../common'),
  getMigrationFiles: jest.fn(),
  createSchemaMigrations: jest.fn(),
}));

const options = { connectionString: 'postgres://user@localhost/dbname' };

const files = [
  { path: 'file1', version: '1' },
  { path: 'file2', version: '2' },
  { path: 'file3', version: '3' },
];

const getMigratedVersionsArrayMock = jest.fn();
Adapter.prototype.arrays = getMigratedVersionsArrayMock;

const queryMock = jest.fn();
Adapter.prototype.query = queryMock;

Adapter.prototype.transaction = (cb) => {
  return cb({} as unknown as TransactionAdapter);
};

const transactionQueryMock = jest.fn();
Migration.prototype.query = transactionQueryMock;

const requireTsMock = jest.fn();
const config = {
  ...migrationConfigDefaults,
  requireTs: requireTsMock,
};

describe('migrateOrRollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('migrate', () => {
    it('should work properly', async () => {
      (getMigrationFiles as jest.Mock).mockReturnValueOnce(files);
      getMigratedVersionsArrayMock.mockResolvedValueOnce({ rows: [['1']] });
      queryMock.mockReturnValueOnce(undefined);
      requireTsMock.mockResolvedValue(undefined);

      await migrate(options, config);

      expect(getMigrationFiles).toBeCalledWith(config, true);

      expect(requireTsMock).toBeCalledWith('file2');
      expect(requireTsMock).toBeCalledWith('file3');

      expect(transactionQueryMock).toBeCalledWith(
        `INSERT INTO "schemaMigrations" VALUES ('2')`,
      );
      expect(transactionQueryMock).toBeCalledWith(
        `INSERT INTO "schemaMigrations" VALUES ('3')`,
      );
    });

    it('should create migrations table if it not exist', async () => {
      (getMigrationFiles as jest.Mock).mockReturnValueOnce([]);
      getMigratedVersionsArrayMock.mockRejectedValueOnce({ code: '42P01' });
      (createSchemaMigrations as jest.Mock).mockResolvedValueOnce(undefined);

      await migrate(options, config);

      expect(getMigrationFiles).toBeCalledWith(config, true);
      expect(createSchemaMigrations).toBeCalled();
      expect(requireTsMock).not.toBeCalled();
      expect(transactionQueryMock).not.toBeCalled();
    });
  });

  describe('rollback', () => {
    it('should work properly', async () => {
      (getMigrationFiles as jest.Mock).mockReturnValueOnce(files.reverse());
      getMigratedVersionsArrayMock.mockResolvedValueOnce({
        rows: [['1'], ['2']],
      });
      queryMock.mockReturnValueOnce(undefined);
      requireTsMock.mockResolvedValue(undefined);

      await rollback(options, config);

      expect(getMigrationFiles).toBeCalledWith(config, false);

      expect(requireTsMock).toBeCalledWith('file2');
      expect(requireTsMock).toBeCalledWith('file1');

      expect(transactionQueryMock).toBeCalledWith(
        `DELETE FROM "schemaMigrations" WHERE version = '2'`,
      );
      expect(transactionQueryMock).toBeCalledWith(
        `DELETE FROM "schemaMigrations" WHERE version = '1'`,
      );
    });

    it('should create migrations table if it not exist', async () => {
      (getMigrationFiles as jest.Mock).mockReturnValueOnce([]);
      getMigratedVersionsArrayMock.mockRejectedValueOnce({ code: '42P01' });
      (createSchemaMigrations as jest.Mock).mockResolvedValueOnce(undefined);

      await rollback(options, config);

      expect(getMigrationFiles).toBeCalledWith(config, false);
      expect(createSchemaMigrations).toBeCalled();
      expect(requireTsMock).not.toBeCalled();
      expect(transactionQueryMock).not.toBeCalled();
    });
  });
});
