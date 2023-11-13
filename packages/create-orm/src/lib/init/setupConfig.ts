import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupConfig(config: InitConfig): Promise<void> {
  const configPath = join(config.dbDirPath, 'config.ts');

  let content = `import 'dotenv/config';

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');`;

  if (config.testDatabase) {
    content += `

const testDatabase = {
  databaseURL: process.env.DATABASE_TEST_URL,
};

const allDatabases = [database];

if (testDatabase.databaseURL) {
  allDatabases.push(testDatabase);
}`;
  }

  content += `

export const config = {`;

  if (config.testDatabase) {
    content += `
  allDatabases,`;
  }

  if (config.testDatabase) {
    content += `
  database: process.env.NODE_ENV === 'test' ? testDatabase : database,`;
  } else {
    content += `
  database,`;
  }
  content += `
};
`;

  await fs.writeFile(configPath, content);
}
