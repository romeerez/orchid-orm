import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupMigrationScript(config: InitConfig): Promise<void> {
  const filePath = join(config.dbDirPath, 'dbScript.ts');

  const migrations =
    config.runner === 'vite-node'
      ? "migrations: import.meta.glob('./migrations/*.ts')"
      : "migrationsPath: './migrations'";

  await fs.writeFile(
    filePath,
    `import { rakeDb } from 'orchid-orm/migrations';
import { config } from './config';
import { BaseTable } from './baseTable';

export const change = rakeDb(${
      config.testDatabase ? 'config.allDatabases' : 'config.database'
    }, {
  baseTable: BaseTable,
  dbPath: './db',
  ${migrations},
  commands: {
    async seed() {
      const { seed } = await import('./seed');
      await seed();
    },
  },${
    config.runner === 'vite-node'
      ? // required by vite-node, but would fail for tsx
        `
  import: (path) => import(path),`
      : ''
  }
});
`,
  );
}
