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
    `import { rakeDb } from 'orchid-orm/migrations/postgres-js';
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
  },
  import: (path) => import(path),
});
`,
  );
}
