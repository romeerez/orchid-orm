import fs from 'fs/promises';
import { resolve } from 'path';
import { initSteps } from '../init';
import { mockFn, testInitConfig } from '../../testUtils';

const migrationScriptPath = resolve(testInitConfig.dbDirPath, 'dbScript.ts');

const writeFile = mockFn(fs, 'writeFile');

describe('setupMigrationScript', () => {
  beforeEach(jest.resetAllMocks);

  it('should create script', async () => {
    await initSteps.setupMigrationScript(testInitConfig);

    const call = writeFile.mock.calls.find(
      ([to]) => to === migrationScriptPath,
    );
    expect(call?.[1]).toBe(`import { rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm/codegen';
import { config } from './config';
import { BaseTable } from './baseTable';

export const change = rakeDb(config.database, {
  baseTable: BaseTable,
  migrationsPath: './migrations',
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => \`./tables/\${tableName}.table.ts\`,
    ormPath: './db.ts',
  }),
  // set to false to disable code updater
  useCodeUpdater: process.env.NODE_ENV === 'development',
  commands: {
    async seed() {
      const { seed } = await import('./seed');
      await seed();
    },
  },
  import: (path) => import(path),
});
`);
  });

  it('should create script with multiple databases', async () => {
    await initSteps.setupMigrationScript({
      ...testInitConfig,
      testDatabase: true,
    });

    const call = writeFile.mock.calls.find(
      ([to]) => to === migrationScriptPath,
    );
    expect(call?.[1]).toBe(`import { rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm/codegen';
import { config } from './config';
import { BaseTable } from './baseTable';

export const change = rakeDb(config.allDatabases, {
  baseTable: BaseTable,
  migrationsPath: './migrations',
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => \`./tables/\${tableName}.table.ts\`,
    ormPath: './db.ts',
  }),
  // set to false to disable code updater
  useCodeUpdater: process.env.NODE_ENV === 'development',
  commands: {
    async seed() {
      const { seed } = await import('./seed');
      await seed();
    },
  },
  import: (path) => import(path),
});
`);
  });

  it('should have special migrations for vite-node, and useCodeUpdater: import.meta.env.DEV', async () => {
    await initSteps.setupMigrationScript({
      ...testInitConfig,
      runner: 'vite-node',
    });

    const content = writeFile.mock.calls[0][1];
    expect(content).toContain(
      "migrations: import.meta.glob('./migrations/*.ts')",
    );
    expect(content).toContain('useCodeUpdater: import.meta.env.DEV');
  });
});
