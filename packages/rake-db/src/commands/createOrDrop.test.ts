import { createDb, dropDb, resetDb } from './createOrDrop';
import { Adapter } from 'pqb';
import {
  createSchemaMigrations,
  migrationConfigDefaults,
  setAdminCredentialsToOptions,
} from '../common';
import { migrate } from './migrateOrRollback';

jest.mock('../common', () => ({
  ...jest.requireActual('../common'),
  setAdminCredentialsToOptions: jest.fn((options: Record<string, unknown>) => ({
    ...options,
    user: 'admin-user',
    password: 'admin-password',
  })),
  createSchemaMigrations: jest.fn(),
}));

jest.mock('./migrateOrRollback', () => ({
  migrate: jest.fn(),
}));

const options = { database: 'dbname', user: 'user', password: 'password' };
const queryMock = jest.fn();
Adapter.prototype.query = queryMock;

const logMock = jest.fn();
console.log = logMock;

const config = {
  ...migrationConfigDefaults,
  basePath: __dirname,
};

describe('createOrDrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDb', () => {
    it('should create database when user is an admin', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await createDb(options, config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
      ]);
      expect(createSchemaMigrations).toHaveBeenCalled();
    });

    it('should create databases for each provided option', async () => {
      queryMock.mockResolvedValue(undefined);

      await createDb(
        [options, { ...options, database: 'dbname-test' }],
        config,
      );

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
        [`CREATE DATABASE "dbname-test" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
        [`Database dbname-test successfully created`],
      ]);
      expect(createSchemaMigrations).toHaveBeenCalledTimes(2);
    });

    it('should inform if database already exists', async () => {
      queryMock.mockRejectedValueOnce({ code: '42P04' });

      await createDb(options, config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([[`Database dbname already exists`]]);
      expect(createSchemaMigrations).toHaveBeenCalled();
    });

    it('should inform if ssl is required', async () => {
      queryMock.mockRejectedValueOnce({
        code: 'XX000',
        message: 'sslmode=require',
      });

      await createDb(options, config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        ['SSL is required: append ?ssl=true to the database url string'],
      ]);
      expect(createSchemaMigrations).not.toHaveBeenCalled();
    });

    it('should ask and use admin credentials when cannot connect', async () => {
      queryMock.mockRejectedValueOnce({ code: '42501' });

      await createDb(options, config);

      expect(setAdminCredentialsToOptions).toHaveBeenCalled();
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
      expect(createSchemaMigrations).toHaveBeenCalled();
    });
  });

  describe('dropDb', () => {
    it('should drop database when user is an admin', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await dropDb(options);

      expect(queryMock.mock.calls).toEqual([[`DROP DATABASE "dbname"`]]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
      ]);
    });

    it('should drop databases for each provided option', async () => {
      queryMock.mockResolvedValue(undefined);

      await dropDb([options, { ...options, database: 'dbname-test' }]);

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

      await dropDb(options);

      expect(queryMock.mock.calls).toEqual([[`DROP DATABASE "dbname"`]]);
      expect(logMock.mock.calls).toEqual([[`Database dbname does not exist`]]);
    });

    it('should inform if ssl is required', async () => {
      queryMock.mockRejectedValueOnce({
        code: 'XX000',
        message: 'sslmode=require',
      });

      await createDb(options, config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        ['SSL is required: append ?ssl=true to the database url string'],
      ]);
      expect(createSchemaMigrations).not.toHaveBeenCalled();
    });

    it('should ask and use admin credentials when cannot connect', async () => {
      queryMock.mockRejectedValueOnce({ code: '42501' });

      await dropDb(options);

      expect(setAdminCredentialsToOptions).toHaveBeenCalled();
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

      await resetDb(options, config);

      expect(queryMock.mock.calls).toEqual([
        [`DROP DATABASE "dbname"`],
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
        [`Database dbname successfully created`],
      ]);
      expect(createSchemaMigrations).toHaveBeenCalled();
      expect(migrate).toBeCalled();
    });
  });
});
