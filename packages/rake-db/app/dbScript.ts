import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from '../src';
import { AdapterOptions } from 'pqb';
import { BaseTable } from './baseTable';

config({ path: path.resolve('..', '..', '.env') });

const options: AdapterOptions[] = [];

const databaseURL = process.env.PG_URL;
if (!databaseURL) {
  throw new Error('PG_URL is missing in .env');
}

options.push({ databaseURL, connectRetry: true });

const command = process.argv[2];
if (['create', 'drop'].includes(command)) {
  const databaseURLGenerate = process.env.PG_GENERATE_URL;
  if (databaseURLGenerate) {
    options.push({ databaseURL: databaseURLGenerate, connectRetry: true });
  }
}

export const change = rakeDb(options, {
  baseTable: BaseTable,
  migrationsPath: 'migrations',
  // tablePath: (tableName) => `tables/${tableName}.ts`,
});
