import { InitConfig } from '../../lib';
import { join } from 'path';
import { readFileSafe } from '../utils';
import fs from 'fs/promises';

export async function setupEnv(config: InitConfig): Promise<void> {
  const envPath = join(config.path, '.env');
  let content = ((await readFileSafe(envPath)) || '').trim();
  let changed = false;

  // by default, on Mac it is a username, on Linux it's postgres, on Windows it's postgres as well
  const user = process.platform === 'darwin' ? process.env.USER : 'postgres';

  // TODO: guess user and pw
  if (!content.match(/^DATABASE_URL=/m)) {
    content += `\nDATABASE_URL=postgres://${user}:@localhost:5432/dbname?ssl=false`;
    changed = true;
  }

  if (config.testDatabase && !content.match(/^DATABASE_TEST_URL=/m)) {
    content += `\nDATABASE_TEST_URL=postgres://${user}:@localhost:5432/dbname-test?ssl=false`;
    changed = true;
  }

  if (changed) {
    await fs.writeFile(envPath, `${content.trim()}\n`);
  }
}
