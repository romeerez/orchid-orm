import {
  getFirstWordAndRest,
  getTextAfterTo,
  joinColumns,
  joinWords,
  quoteWithSchema,
} from './common';
import { defaultSchemaConfig, makeColumnTypes } from 'pqb';
import path from 'path';
import { asMock } from 'test-utils';
import { getCallerFilePath, getStackTrace } from 'orchid-core';
import { getDatabaseAndUserFromOptions, processRakeDbConfig } from './config';

jest.mock('orchid-core', () => ({
  ...jest.requireActual('../../core/src'),
  getStackTrace: jest.fn(),
  getCallerFilePath: jest.fn(),
}));

describe('common', () => {
  describe('processRakeDbConfig', () => {
    it('should return config with defaults', () => {
      const result = processRakeDbConfig({
        basePath: __dirname,
        dbScript: 'dbScript.ts',
        migrationsPath: 'custom-path',
      });

      const migrationsPath = path.resolve(__dirname, 'custom-path');

      expect(result).toEqual({
        basePath: __dirname,
        dbScript: 'dbScript.ts',
        columnTypes: makeColumnTypes,
        migrationId: 'serial',
        migrationsPath,
        recurrentPath: path.join(migrationsPath, 'recurrent'),
        migrationsTable: 'schemaMigrations',
        schemaConfig: defaultSchemaConfig,
        snakeCase: false,
        import: expect.any(Function),
        log: true,
        logger: console,
        commands: {},
      });
    });

    it(`should throw when no basePath and can't get it automatically`, () => {
      asMock(getCallerFilePath).mockReturnValueOnce(undefined);

      expect(() => processRakeDbConfig({})).toThrow(
        'Failed to determine path to db script. Please set basePath option of rakeDb',
      );
    });

    // https://github.com/romeerez/orchid-orm/issues/157: when calling rakeDb script with vite-node without .ts suffix
    it(`should throw when no basePath and can't get it automatically`, () => {
      asMock(getStackTrace).mockReturnValueOnce([
        null,
        null,
        null,
        { getFileName: () => 'some-path' },
      ]);

      expect(() => processRakeDbConfig({})).toThrow(
        'Add a .ts suffix to the "some-path" when calling it',
      );
    });
  });

  describe('getDatabaseAndUserFromOptions', () => {
    it('should return data from databaseURL', () => {
      const result = getDatabaseAndUserFromOptions({
        databaseURL: 'postgres://user:password@localhost:5432/dbname',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'user',
      });
    });

    it('should return data from options when no databaseURL', () => {
      const result = getDatabaseAndUserFromOptions({
        database: 'dbname',
        user: 'user',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'user',
      });
    });
  });

  describe('getFirstWordAndRest', () => {
    it('should return pair of first word and rest', () => {
      expect(getFirstWordAndRest('fooBarBaz')).toEqual(['foo', 'barBaz']);
      expect(getFirstWordAndRest('foo-barBaz')).toEqual(['foo', 'barBaz']);
      expect(getFirstWordAndRest('foo_barBaz')).toEqual(['foo', 'barBaz']);
    });

    it('should return input when it is a single word', () => {
      expect(getFirstWordAndRest('foo')).toEqual(['foo']);
    });
  });

  describe('getTextAfterTo', () => {
    it('should return text after To or to', () => {
      expect(getTextAfterTo('addColumnToTable')).toBe('table');
      expect(getTextAfterTo('add-column-to-table')).toBe('table');
      expect(getTextAfterTo('add_column_to_table')).toBe('table');
    });
  });

  describe('joinWords', () => {
    it('should join words', () => {
      expect(joinWords('foo', 'bar', 'baz')).toEqual('fooBarBaz');
    });
  });

  describe('joinColumns', () => {
    it('should join columns', () => {
      expect(joinColumns(['a', 'b', 'c'])).toBe('"a", "b", "c"');
    });
  });

  describe('quoteWithSchema', () => {
    it('should quote a name', () => {
      expect(quoteWithSchema({ name: 'table' })).toBe('"table"');
    });

    it('should quote a name with schema', () => {
      expect(quoteWithSchema({ schema: 'schema', name: 'table' })).toBe(
        '"schema"."table"',
      );
    });
  });
});
