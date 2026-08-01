import { RakeDbConfig, rakeDbConfigDefaults } from 'rake-db';
import { noop, QueryLogger } from 'pqb/internal';
import path from 'node:path';
import { join } from 'node:path';
import { createTableFactory } from '../orm-table/table';
import { testColumnTypes, testDefaultColumnTypes } from 'test-utils';

export const { defineTable } = createTableFactory({
  columnTypes: testColumnTypes,
});

const testMigrationsPath = 'migrations-path';

export const testConfig: RakeDbConfig & {
  logger: QueryLogger;
} = {
  ...rakeDbConfigDefaults,
  __rakeDbConfig: true,
  transaction: 'single',
  basePath: path.join(__dirname),
  defineTable,
  dbPath: 'src/db/db.ts',
  dbScript: 'dbScript.ts',
  columnTypes: testDefaultColumnTypes,
  log: false,
  logger: {
    log: jest.fn(),
    error: noop,
    warn: noop,
  },
  migrationsPath: testMigrationsPath,
  recurrentPath: join(testMigrationsPath, 'recurrent'),
  migrationsTable: 'public.schemaMigrations',
  snakeCase: true,
  import: require,
};
