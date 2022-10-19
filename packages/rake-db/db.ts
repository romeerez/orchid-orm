import { config } from 'dotenv';
import path from 'path';
import { rakeDb } from './src/rakeDb';

config({ path: path.resolve(process.cwd(), '.env.local') });
config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing in .env');
}

const connectionStringTest = process.env.DATABASE_URL_TEST;
if (!connectionStringTest) {
  throw new Error('DATABASE_URL_TEST is missing in .env');
}

rakeDb(
  [{ connectionString }, { connectionString: connectionStringTest }],
  { migrationsPath: path.resolve(process.cwd(), 'migrations') },
);
