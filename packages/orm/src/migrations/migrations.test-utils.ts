import {
  AnyRakeDbConfig,
  migrationConfigDefaults,
  RakeDbConfig,
} from 'rake-db';
import { ColumnSchemaConfig, noop, QueryLogger } from 'orchid-core';
import { defaultSchemaConfig, makeColumnTypes } from 'pqb';
import path from 'node:path';
import { join } from 'path';
import { createBaseTable } from '../baseTable';
import { testColumnTypes } from 'test-utils';

export const BaseTable = createBaseTable({
  columnTypes: testColumnTypes,
});

const testMigrationsPath = 'migrations-path';

export const testConfig: RakeDbConfig<ColumnSchemaConfig> & {
  logger: QueryLogger;
  migrationsPath: string;
} = {
  ...migrationConfigDefaults,
  basePath: path.join(__dirname),
  baseTable: BaseTable as unknown as AnyRakeDbConfig['baseTable'],
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
  migrationsTable: 'schemaMigrations',
  snakeCase: true,
  import: require,
  commands: {},
};
