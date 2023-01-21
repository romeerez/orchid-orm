import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from './src/rakeDb';
import { AdapterOptions } from 'pqb';
import { appCodeUpdater } from '../orm/src';

config({ path: path.resolve(process.cwd(), '.env.local') });
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
  migrationsPath: path.resolve(process.cwd(), 'migrations'),
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => `app/tables/${tableName}.ts`,
    baseTablePath: 'app/lib/baseTable.ts',
    baseTableName: 'BaseTable',
    mainFilePath: 'app/db.ts',
  }),
  useCodeUpdater: false,
});
