import { join } from 'path';
import fs from 'fs/promises';
import { InitConfig } from '../../lib';

export async function createDemoMigrations(config: InitConfig): Promise<void> {
  const migrationsPath = join(config.dbDirPath, 'migrations');
  await fs.mkdir(migrationsPath, { recursive: true });

  if (!config.demoTables) return;

  const now = new Date();

  const postPath = join(migrationsPath, `0001_createPost.ts`);
  await fs.writeFile(
    postPath,
    `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.identity().primaryKey(),
    title: t.text().unique(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`,
  );

  now.setTime(now.getTime() + 1000);

  const commentPath = join(migrationsPath, `0002_createComment.ts`);
  await fs.writeFile(
    commentPath,
    `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('comment', (t) => ({
    id: t.identity().primaryKey(),
    postId: t.integer().foreignKey('post', 'id').index(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`,
  );
}
