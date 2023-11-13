import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const configPath = resolve(testInitConfig.dbDirPath, 'config.ts');

const writeFile = mockFn(fs, 'writeFile');

describe('setupConfig', () => {
  beforeEach(jest.resetAllMocks);

  it('should create config file', async () => {
    await initSteps.setupConfig(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === configPath);
    expect(call?.[1]).toBe(`import 'dotenv/config';

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');

export const config = {
  database,
};
`);
  });

  it('should add test database config if specified', async () => {
    await initSteps.setupConfig({
      ...testInitConfig,
      testDatabase: true,
    });

    const call = writeFile.mock.calls.find(([to]) => to === configPath);
    expect(call?.[1]).toBe(`import 'dotenv/config';

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');

const testDatabase = {
  databaseURL: process.env.DATABASE_TEST_URL,
};

const allDatabases = [database];

if (testDatabase.databaseURL) {
  allDatabases.push(testDatabase);
}

export const config = {
  allDatabases,
  database: process.env.NODE_ENV === 'test' ? testDatabase : database,
};
`);
  });
});
