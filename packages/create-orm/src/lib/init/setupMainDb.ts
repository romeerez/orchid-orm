import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupMainDb(config: InitConfig): Promise<void> {
  let imports = '';
  let tables = '';
  if (config.demoTables) {
    imports += `
import { PostTable } from './tables/post.table';
import { CommentTable } from './tables/comment.table';`;
    tables += `
  post: PostTable,
  comment: CommentTable,`;
  }

  const dbPath = join(config.dbDirPath, 'db.ts');
  await fs.writeFile(
    dbPath,
    `import { orchidORM } from 'orchid-orm/postgres-js';
import { config } from './config';${imports}

export const db = orchidORM(config.database, {${tables}
});
`,
  );
}
