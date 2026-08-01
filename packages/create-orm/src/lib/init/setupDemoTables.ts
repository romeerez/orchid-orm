import { InitConfig } from '../../lib';
import { join } from 'node:path';
import fs from 'node:fs/promises';

export async function setupDemoTables(config: InitConfig): Promise<void> {
  if (!config.demoTables) return;

  const tablesDir = join(config.dbDirPath, 'tables');
  await fs.mkdir(tablesDir, { recursive: true });

  const hasValidation = config.validation !== 'no';

  await fs.writeFile(
    join(tablesDir, 'post.table.ts'),
    `import { Selectable, Updatable, Insertable, Queryable } from 'orchid-orm';
import { defineTable } from '../table-factory';
import { CommentTable } from './comment.table';

// Post type returned from database.
export type Post = Selectable<typeof PostTable>;
// Post type for insertion.
export type PostNew = Insertable<typeof PostTable>;
// Post type for updates.
export type PostUpdate = Updatable<typeof PostTable>;
// Post type used by query methods such as \`where\`.
export type PostForQuery = Queryable<typeof PostTable>;

export const PostTable = defineTable('post', (t) => ({
  id: t.identity().primaryKey(),
  title: t.text()${hasValidation ? '.min(3).max(100)' : ''}.unique(),
  text: t.text()${hasValidation ? '.min(20).max(10000)' : ''},
  ...t.timestamps(),
})).relations((post) => ({
  comments: post('id').hasMany(() => CommentTable('postId')),
}));
`,
  );

  await fs.writeFile(
    join(tablesDir, 'comment.table.ts'),
    `import { Selectable, Updatable, Insertable, Queryable } from 'orchid-orm';
import { defineTable } from '../table-factory';
import { PostTable } from './post.table';

// Comment type returned from database.
export type Comment = Selectable<typeof CommentTable>;
// Comment type for insertion.
export type CommentNew = Insertable<typeof CommentTable>;
// Comment type for updates.
export type CommentUpdate = Updatable<typeof CommentTable>;
// Comment type used by query methods such as \`where\`.
export type CommentForQuery = Queryable<typeof CommentTable>;

export const CommentTable = defineTable('comment', (t) => ({
  id: t.identity().primaryKey(),
  postId: t
    .integer()
    .foreignKey(() => PostTable, 'id')
    .index(),
  text: t.text()${hasValidation ? '.min(5).max(1000)' : ''},
  ...t.timestamps(),
})).relations((comment) => ({
  post: comment('postId').belongsTo(() => PostTable('id')),
}));
`,
  );
}
