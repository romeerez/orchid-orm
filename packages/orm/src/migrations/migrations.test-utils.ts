import { RakeDbConfig, migrationConfigDefaults } from 'rake-db';
import { defaultSchemaConfig, makeColumnTypes, noop, QueryLogger } from 'pqb';
import path from 'node:path';
import { join } from 'path';
import { createBaseTable } from '../baseTable';
import { testColumnTypes } from 'test-utils';

export const BaseTable = createBaseTable({
  columnTypes: testColumnTypes,
});

const testMigrationsPath = 'migrations-path';

export const testConfig: RakeDbConfig & {
  logger: QueryLogger;
} = {
  ...migrationConfigDefaults,
  __rakeDbConfig: true,
  transaction: 'single',
  basePath: path.join(__dirname),
  baseTable: BaseTable,
  dbPath: 'src/db/db.ts',
  dbScript: 'dbScript.ts',
  columnTypes: makeColumnTypes(defaultSchemaConfig),
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
