import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupDemoTables(config: InitConfig): Promise<void> {
  if (!config.demoTables) return;

  const tablesDir = join(config.dbDirPath, 'tables');
  await fs.mkdir(tablesDir, { recursive: true });

  await fs.writeFile(
    join(tablesDir, 'post.table.ts'),
    `import { Selectable, Updatable, Insertable, Queryable } from 'orchid-orm';
import { BaseTable } from '../baseTable';
import { CommentTable } from './comment.table';

// Post type returned from database.
export type Post = Selectable<PostTable>;
// Post type for insertion.
export type PostNew = Insertable<PostTable>;
// Post type for updates.
export type PostUpdate = Updatable<PostTable>;
// Post type used by query methods such as \`where\`.
export type PostForQuery = Queryable<PostTable>;

export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title: t.text(3, 100).unique(),
    text: t.text(20, 10000),
    ...t.timestamps(),
  }));

  relations = {
    comments: this.hasMany(() => CommentTable, {
      primaryKey: 'id',
      foreignKey: 'postId',
    }),
  };
}
`,
  );

  await fs.writeFile(
    join(tablesDir, 'comment.table.ts'),
    `import { Selectable, Updatable, Insertable, Queryable } from 'orchid-orm';
import { BaseTable } from '../baseTable';
import { PostTable } from './post.table';

// Comment type returned from database.
export type Comment = Selectable<CommentTable>;
// Comment type for insertion.
export type CommentNew = Insertable<CommentTable>;
// Comment type for updates.
export type CommentUpdate = Updatable<CommentTable>;
// Comment type used by query methods such as \`where\`.
export type CommentForQuery = Queryable<CommentTable>;

export class CommentTable extends BaseTable {
  readonly table = 'comment';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    postId: t
      .integer()
      .foreignKey(() => PostTable, 'id')
      .index(),
    text: t.text(5, 1000),
    ...t.timestamps(),
  }));

  relations = {
    post: this.belongsTo(() => PostTable, {
      primaryKey: 'id',
      foreignKey: 'postId',
    }),
  };
}
`,
  );
}
