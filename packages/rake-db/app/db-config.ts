import { testRakeDb } from 'test-utils';
import { makeRakeDbConfig } from 'rake-db';
import { BaseTable } from './base-table';

const rakeDbConfig = makeRakeDbConfig({
  baseTable: BaseTable,
  migrationsPath: 'migrations',
  import: (path) => import(path),
});

export const migrator = testRakeDb(rakeDbConfig);

export const { change } = migrator;
