import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from '../src/rakeDb';
import { AdapterOptions } from 'pqb';
import { appCodeUpdater } from '../../orm/src';

config({ path: path.resolve('.env.local') });
config();

const options: AdapterOptions[] = [];

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) {
  throw new Error('DATABASE_URL is missing in .env');
}

options.push({ databaseURL });

const databaseURLTest = process.env.DATABASE_URL_TEST;
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
