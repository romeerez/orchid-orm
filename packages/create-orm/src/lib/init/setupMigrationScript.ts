import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupMigrationScript(config: InitConfig): Promise<void> {
  const filePath = join(config.dbDirPath, 'dbScript.ts');

  const migrations =
    config.runner === 'vite-node'
      ? "migrations: import.meta.glob('./migrations/*.ts')"
      : "migrationsPath: './migrations'";

  const useCodeUpdater =
    config.runner === 'vite-node'
      ? 'import.meta.env.DEV'
      : `process.env.NODE_ENV === 'development'`;

  await fs.writeFile(
    filePath,
    `import { rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm/codegen';
import { config } from './config';
import { BaseTable } from './baseTable';

export const change = rakeDb(${
      config.testDatabase ? 'config.allDatabases' : 'config.database'
    }, {
  baseTable: BaseTable,
  ${migrations},
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => \`./tables/\${tableName}.table.ts\`,
    ormPath: './db.ts',
  }),
  // set to false to disable code updater
  useCodeUpdater: ${useCodeUpdater},
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
