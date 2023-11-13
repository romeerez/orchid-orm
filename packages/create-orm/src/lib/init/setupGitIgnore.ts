import { InitConfig } from '../../lib';
import { join } from 'path';
import { readFileSafe } from '../utils';
import fs from 'fs/promises';

export async function setupGitIgnore(config: InitConfig): Promise<void> {
  const gitignorePath = join(config.path, '.gitignore');
  let content = ((await readFileSafe(gitignorePath)) || '').trim();
  let changed = false;

  if (!content.match(/^node_modules\b/m)) {
    content += `\nnode_modules`;
    changed = true;
  }

  if (!content.match(/^.env\b/m)) {
    content += `\n.env.?*\n!.env.example`;
    changed = true;
  }

  if (changed) {
    await fs.writeFile(gitignorePath, `${content.trim()}\n`);
  }
}
