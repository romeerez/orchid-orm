import os from 'os';
import { AdapterConfigBase } from 'pqb';
import { rakeDbConfig } from './db-config';
import { testRakeDb } from 'test-utils';

const options: AdapterConfigBase[] = [];

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

export const change = testRakeDb.run(options, rakeDbConfig);
