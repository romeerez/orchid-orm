import fs from 'node:fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const tablesDir = resolve(testInitConfig.dbDirPath, 'tables');
const postTablePath = resolve(tablesDir, 'post.table.ts');
const commentTablePath = resolve(tablesDir, 'comment.table.ts');

const mkdir = mockFn(fs, 'mkdir');
const writeFile = mockFn(fs, 'writeFile');

describe('setupDemoTables', () => {
  beforeEach(jest.resetAllMocks);

  it('should do nothing if demoTables is not specified', async () => {
    await initSteps.setupBaseTable(testInitConfig);

    expect(mkdir).not.toHaveBeenCalled();
  });

  it('should create tables dir', async () => {
    await initSteps.setupDemoTables({
      ...testInitConfig,
      demoTables: true,
    });

    expect(mkdir).toHaveBeenCalledWith(tablesDir, { recursive: true });
  });

  it('should create post table', async () => {
    await initSteps.setupDemoTables({
      ...testInitConfig,
      demoTables: true,
      validation: 'zod',
    });

    const call = writeFile.mock.calls.find(([to]) => to === postTablePath);
    expect(call?.[1])
      .toBe(`import { Selectable, Updatable, Insertable, Queryable } from 'orchid-orm';
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
  title: t.text().min(3).max(100).unique(),
  text: t.text().min(20).max(10000),
  ...t.timestamps(),
})).relations((post) => ({
  comments: post('id').hasMany(() => CommentTable('postId')),
}));
`);
  });

  it('should create comment table', async () => {
    await initSteps.setupDemoTables({
      ...testInitConfig,
      demoTables: true,
      validation: 'zod',
    });

    const call = writeFile.mock.calls.find(([to]) => to === commentTablePath);
    expect(call?.[1])
      .toBe(`import { Selectable, Updatable, Insertable, Queryable } from 'orchid-orm';
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
  text: t.text().min(5).max(1000),
  ...t.timestamps(),
})).relations((comment) => ({
  post: comment('postId').belongsTo(() => PostTable('id')),
}));
`);
  });
});
