import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { initSteps } from '../init';
import { mockFn, testInitConfig } from '../../testUtils';

const migrationScriptPath = resolve(testInitConfig.dbDirPath, 'db-script.ts');

const writeFile = mockFn(fs, 'writeFile');

describe('setupMigrationScript', () => {
  beforeEach(jest.resetAllMocks);

  it('should create script', async () => {
    await initSteps.setupMigrationScript(testInitConfig);

    const call = writeFile.mock.calls.find(
      ([to]) => to === migrationScriptPath,
    );
    expect(call?.[1])
      .toBe(`import { rakeDb } from 'orchid-orm/migrations/postgres-js';
import { config } from './config';
import { defineTable } from './table-factory';

export const change = rakeDb.run(config.database, {
  defineTable,
  dbPath: './db',
  migrationsPath: './migrations',
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
    expect(call?.[1])
      .toBe(`import { rakeDb } from 'orchid-orm/migrations/postgres-js';
import { config } from './config';
import { defineTable } from './table-factory';

export const change = rakeDb.run(config.allDatabases, {
  defineTable,
  dbPath: './db',
  migrationsPath: './migrations',
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

  it('should have special migrations for vite-node', async () => {
    await initSteps.setupMigrationScript({
      ...testInitConfig,
      runner: 'vite-node',
    });

    const content = writeFile.mock.calls[0][1];
    expect(content).toContain(
      "migrations: import.meta.glob('./migrations/*.ts')",
    );
  });
});
