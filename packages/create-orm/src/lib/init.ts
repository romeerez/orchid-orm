import { InitConfig } from '../lib';
import fs from 'fs/promises';
import { setupPackageJSON } from './init/setupPackageJSON';
import { setupTSConfig } from './init/setupTSConfig';
import { setupEnv } from './init/setupEnv';
import { setupGitIgnore } from './init/setupGitIgnore';
import { setupBaseTable } from './init/setupBaseTable';
import { setupDemoTables } from './init/setupDemoTables';
import { setupConfig } from './init/setupConfig';
import { setupMainDb } from './init/setupMainDb';
import { setupMigrationScript } from './init/setupMigrationScript';
import { createDemoMigrations } from './init/createDemoMigrations';
import { createDemoSeed } from './init/createDemoSeed';
import { setupRunner } from './init/setupRunner';

export async function init(config: InitConfig): Promise<void> {
  await fs.mkdir(config.dbDirPath, { recursive: true });

  for (const key in initSteps) {
    await initSteps[key as keyof typeof initSteps](config);
  }
}

export const initSteps = {
  setupPackageJSON,
  setupTSConfig,
  setupEnv,
  setupGitIgnore,
  setupBaseTable,
  setupDemoTables,
  setupConfig,
  setupMainDb,
  setupMigrationScript,
  createDemoMigrations,
  createDemoSeed,
  setupRunner,
};
