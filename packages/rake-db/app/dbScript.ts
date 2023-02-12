import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from '../src';
import { AdapterOptions } from 'pqb';
import { appCodeUpdater } from '../../orm/src';

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

rakeDb(options, {
  migrationsPath: 'migrations',
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => `tables/${tableName}.ts`,
    baseTablePath: 'lib/baseTable.ts',
    baseTableName: 'BaseTable',
    mainFilePath: 'db.ts',
  }),
  useCodeUpdater: false,
});
