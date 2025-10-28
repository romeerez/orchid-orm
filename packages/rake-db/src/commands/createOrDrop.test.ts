import {
  createDb,
  dropDb,
  resetDb,
  askForAdminCredentials,
} from './createOrDrop';
import { migrate } from './migrateOrRollback';
import { testConfig } from '../rake-db.test-utils';
import { asMock, TestAdapter } from 'test-utils';
import { MaybeArray, toArray } from 'pqb';
import { createMigrationsTable } from '../migration/migrationsTable';
import { promptConfirm, promptText } from '../prompt';

jest.mock('../prompt', () => ({
  promptConfirm: jest.fn(),
  promptText: jest.fn(),
}));

jest.mock('../migration/migrationsTable', () => ({
  createMigrationsTable: jest.fn(),
}));

jest.mock('./migrateOrRollback', () => ({
  migrate: jest.fn(),
}));

const options = { database: 'dbname', user: 'user', password: 'password' };
const queryMock = jest.fn();
TestAdapter.prototype.query = queryMock;

const config = testConfig;
const logMock = asMock(testConfig.logger.log);

type AdapterOptions = {
  database: string;
  user?: string;
  password: string;
};

const create = (options: MaybeArray<AdapterOptions>): Promise<void> => {
  return createDb(
    toArray(options).map((opts) => new TestAdapter(opts)),
    config,
  );
};

const drop = (options: MaybeArray<AdapterOptions>): Promise<void> => {
  return dropDb(
    toArray(options).map((opts) => new TestAdapter(opts)),
    config,
  );
};

describe('createOrDrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    asMock(promptConfirm).mockResolvedValueOnce(true);
    asMock(promptText).mockResolvedValueOnce('admin-user');
    asMock(promptText).mockResolvedValueOnce('admin-password');
  });

  describe('createDb', () => {
    it('should create a database without a specified user', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await create({ ...options, user: undefined });

      expect(queryMock.mock.calls).toEqual([[`CREATE DATABASE "dbname"`]]);

      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
      ]);

      expect(createMigrationsTable).toHaveBeenCalled();
    });

    it('should create database when user is an admin', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await create(options);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalled();
    });

    it('should create databases for each provided option', async () => {
      queryMock.mockResolvedValue(undefined);

      await create([options, { ...options, database: 'dbname-test' }]);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
        [`CREATE DATABASE "dbname-test" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
        [`Database dbname-test successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalledTimes(2);
    });

    it('should inform if database already exists', async () => {
      queryMock.mockRejectedValueOnce({ code: '42P04' });

      await create([options]);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([[`Database dbname already exists`]]);
      expect(createMigrationsTable).toHaveBeenCalled();
    });

    it('should inform if ssl is required', async () => {
      queryMock.mockRejectedValueOnce({
        code: 'XX000',
        message: 'sslmode=require',
      });

      await create([options]);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        ['SSL is required: append ?ssl=true to the database url string'],
      ]);
      expect(createMigrationsTable).not.toHaveBeenCalled();
    });

    it('should ask and use admin credentials when cannot connect', async () => {
      queryMock.mockRejectedValueOnce({ code: '42501' });

      await create([options]);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [
          `Permission denied to create database.\nDon't use this command for database service providers, only for a local db.`,
        ],
        [`Database dbname successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalled();
    });
  });

  describe('dropDb', () => {
    it('should drop database when user is an admin', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await drop([options]);

      expect(queryMock.mock.calls).toEqual([[`DROP DATABASE "dbname"`]]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
      ]);
    });

    it('should drop databases for each provided option', async () => {
      queryMock.mockResolvedValue(undefined);

      await drop([options, { ...options, database: 'dbname-test' }]);

      expect(queryMock.mock.calls).toEqual([
        [`DROP DATABASE "dbname"`],
        [`DROP DATABASE "dbname-test"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
        [`Database dbname-test was successfully dropped`],
      ]);
    });

    it('should inform if database does not exist', async () => {
      queryMock.mockRejectedValueOnce({ code: '3D000' });

      await drop([options]);

      expect(queryMock.mock.calls).toEqual([[`DROP DATABASE "dbname"`]]);
      expect(logMock.mock.calls).toEqual([[`Database dbname does not exist`]]);
    });

    it('should inform if ssl is required', async () => {
      queryMock.mockRejectedValueOnce({
        code: 'XX000',
        message: 'sslmode=require',
      });

      await create([options]);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        ['SSL is required: append ?ssl=true to the database url string'],
      ]);
      expect(createMigrationsTable).not.toHaveBeenCalled();
    });

    it('should ask and use admin credentials when cannot connect', async () => {
      queryMock.mockRejectedValueOnce({ code: '42501' });

      await drop([options]);

      expect(queryMock.mock.calls).toEqual([
        [`DROP DATABASE "dbname"`],
        [`DROP DATABASE "dbname"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [
          `Permission denied to drop database.\nDon't use this command for database service providers, only for a local db.`,
        ],
        [`Database dbname was successfully dropped`],
      ]);
    });
  });

  describe('reset', () => {
    it('should drop and create database', async () => {
      queryMock.mockResolvedValue(undefined);

      await resetDb([new TestAdapter(options)], config);

      expect(queryMock.mock.calls).toEqual([
        [`DROP DATABASE "dbname"`],
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
        [`Database dbname successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalled();
      expect(migrate).toBeCalled();
    });
  });

  describe('askForAdminCredentials', () => {
    it('should return user and password', async () => {
      const result = await askForAdminCredentials(true);

      expect(result).toEqual({
        user: 'admin-user',
        password: 'admin-password',
      });
    });
  });
});
