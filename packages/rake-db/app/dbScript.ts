import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from '../src';
import { AdapterOptions } from 'pqb';
import { appCodeUpdater } from 'orchid-orm';
import { BaseTable } from './baseTable';

config({ path: path.resolve('..', '..', '.env') });

const options: AdapterOptions[] = [];

const databaseURL = process.env.PG_URL;
if (!databaseURL) {
  throw new Error('PG_URL is missing in .env');
}

options.push({ databaseURL });

const databaseURLTest = process.env.PG_URL_TEST;
if (databaseURLTest) {
  options.push({ databaseURL: databaseURLTest });
}

export const change = rakeDb(options, {
  baseTable: BaseTable,
  migrationsPath: 'migrations',
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => `tables/${tableName}.ts`,
    mainFilePath: 'db.ts',
  }),
  useCodeUpdater: false,
});
