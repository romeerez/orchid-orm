import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from './src/rakeDb';
import { AdapterOptions } from 'pqb';

config({ path: path.resolve(process.cwd(), '.env.local') });
config();

const options: AdapterOptions[] = [];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing in .env');
}

options.push({ connectionString });

const connectionStringTest = process.env.DATABASE_URL_TEST;
if (connectionStringTest) {
  options.push({ connectionString: connectionStringTest });
}

rakeDb(options, {
  migrationsPath: path.resolve(process.cwd(), 'migrations'),
});
