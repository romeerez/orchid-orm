import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from 'orchid-orm/migrations';
import { AdapterOptions } from 'pqb';
import { BaseTable } from './baseTable';
import os from 'os';

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
    const jestWorkersCount = os.cpus().length;

    options.push(
      ...Array.from({ length: jestWorkersCount }, (_, i) => ({
        databaseURL: `${databaseURLGenerate}-${i + 1}`,
        connectRetry: true as const,
      })),
    );
  }
}

export const change = rakeDb(options, {
  baseTable: BaseTable,
  migrationsPath: 'migrations',
  import: (path) => import(path),
});
