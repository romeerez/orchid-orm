import os from 'os';
import { AdapterConfigBase } from 'pqb/internal';
import { testRakeDb } from 'test-utils';
import { config } from 'dotenv';
import path from 'path';
import { BaseTable } from './base-table';

config({ path: path.resolve('..', '..', '.env') });

const options: AdapterConfigBase[] = [];

const databaseURL = process.env.PG_URL;
if (!databaseURL) {
  throw new Error('PG_URL is missing in .env');
}

options.push({ databaseURL, connectRetry: true });

const command = process.argv[2];
if (['create', 'drop', 'reset'].includes(command)) {
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

  const databaseUrlRepro = process.env.PG_REPRO_URL;
  if (databaseUrlRepro) {
    options.push({ databaseURL: databaseUrlRepro, connectRetry: true });
  }
}

export const change = testRakeDb.run(options, {
  baseTable: BaseTable,
  migrationsPath: 'migrations',
  import: (path) => import(path),
});
