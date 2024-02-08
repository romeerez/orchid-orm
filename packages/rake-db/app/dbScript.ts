import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from '../src';
import { AdapterOptions } from 'pqb';
import { appCodeUpdater } from 'orchid-orm/codegen';
import { BaseTable } from './baseTable';

config({ path: path.resolve('..', '..', '.env') });

const options: AdapterOptions[] = [];

const databaseURL = process.env.PG_URL;
if (!databaseURL) {
  throw new Error('PG_URL is missing in .env');
}

options.push({ databaseURL, connectRetry: true });

const databaseURLTest = process.env.PG_URL_TEST;
if (databaseURLTest) {
  options.push({ databaseURL: databaseURLTest, connectRetry: true });
}

export const change = rakeDb(options, {
  baseTable: BaseTable,
  migrationsPath: 'migrations',
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => `tables/${tableName}.ts`,
    ormPath: 'db.ts',
  }),
  useCodeUpdater: false,
});
