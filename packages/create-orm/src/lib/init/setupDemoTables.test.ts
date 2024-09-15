import fs from 'fs/promises';
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

    expect(mkdir).not.toBeCalled();
  });

  it('should create tables dir', async () => {
    await initSteps.setupDemoTables({
      ...testInitConfig,
      demoTables: true,
    });

    expect(mkdir).toBeCalledWith(tablesDir, { recursive: true });
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
    title: t.text().min(3).max(100).unique(),
    text: t.text().min(20).max(10000),
    ...t.timestamps(),
  }));

  relations = {
    comments: this.hasMany(() => CommentTable, {
      columns: ['id'],
      references: ['postId'],
    }),
  };
}
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
    text: t.text().min(5).max(1000),
    ...t.timestamps(),
  }));

  relations = {
    post: this.belongsTo(() => PostTable, {
      columns: ['postId'],
      references: ['id'],
    }),
  };
}
`);
  });
});
