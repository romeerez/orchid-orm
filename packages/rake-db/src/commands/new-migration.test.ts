import { newMigration } from './new-migration';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { pathToLog } from 'pqb';
import { testConfig } from '../rake-db.test-utils';
import { asMock } from 'test-utils';
import { migrationConfigDefaults } from '../config';
import fs from 'fs/promises';

jest.mock('fs/promises');

const migrationsPath = migrationConfigDefaults.migrationsPath;
const config = {
  ...testConfig,
  migrationsPath: migrationsPath,
  basePath: path.join(migrationsPath, '..'),
};
const log = asMock(testConfig.logger.log);

const testGenerate = async (name: string, content: string) => {
  await newMigration(config, name);

  expect(mkdir).toHaveBeenCalledWith(migrationsPath, { recursive: true });

  const filePath = path.resolve(
    migrationsPath,
    `0001_${name.replaceAll(' ', '-')}.ts`,
  );
  expect(writeFile).toHaveBeenCalledWith(filePath, content);

  expect(log.mock.calls).toEqual([[`Created ${pathToLog(filePath)}`]]);
};

describe('newMigration', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2000, 0, 1, 0, 0, 0));
    jest.clearAllMocks();
    asMock(fs.readdir).mockReturnValue(Promise.resolve([]));
  });

  it('should create a file for create table migration', async () => {
    await testGenerate(
      'create table',
      `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    
  }));
});
`,
    );
  });

  it('should create a file to change migration', async () => {
    await testGenerate(
      'change table',
      `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    
  }));
});
`,
    );
  });

  it('should create a file for add columns migration', async () => {
    await testGenerate(
      'add columns',
      `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable(tableName, (t) => ({
    
  }));
});
`,
    );
  });

  it('should create a file for add columns migration with table', async () => {
    await testGenerate(
      'add columns to table',
      `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    
  }));
});
`,
    );
  });

  it('should create a file for remove columns migration with table', async () => {
    await testGenerate(
      'remove columns from table',
      `import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    
  }));
});
`,
    );
  });

  it('should create a file for drop table migration', async () => {
    await testGenerate(
      'drop table',
      `import { change } from '../dbScript';

change(async (db) => {
  await db.dropTable('table', (t) => ({
    
  }));
});
`,
    );
  });
});
