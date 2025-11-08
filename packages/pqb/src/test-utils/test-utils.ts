import { Query } from '../query/query';
import { escapeForLog } from '../quote';
import { expectSql, testDb } from 'test-utils';
import { RecordUnknown } from 'orchid-core';

export type UserRecord = typeof User.outputType;
export type UserInsert = typeof User.inputType;
export type UserDataType = { name: string; tags: string[] };
export const User = testDb('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.text().unique(),
  password: t.text().select(false),
  picture: t.text().nullable(),
  data: t.json<UserDataType>().nullable(),
  age: t.decimal().parse(parseInt).nullable(),
  active: t.boolean().nullable(),
  ...t.timestamps(),
}));

export const userColumnsSql = User.q.selectAllColumns!.join(', ');

export const userTableColumnsSql = User.q
  .selectAllColumns!.map((c) => '"user".' + c)
  .join(', ');

export const UserSoftDelete = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    active: t.boolean().nullable(),
    deletedAt: t.timestamp().nullable(),
  }),
  undefined,
  {
    softDelete: true,
  },
);

export const userSoftDeleteColumnsSql =
  UserSoftDelete.q.selectAllColumns!.join(', ');

export type ProfileRecord = typeof Profile.outputType;
export const Profile = testDb('profile', (t) => ({
  id: t.identity().primaryKey(),
  userId: t.integer().foreignKey('user', 'id'),
  bio: t.text().nullable(),
  ...t.timestamps(),
}));

export const profileColumnsSql = Profile.q.selectAllColumns!.join(', ');

export const profileTableColumnsSql = Profile.q
  .selectAllColumns!.map((c) => '"profile".' + c)
  .join(', ');

export const Chat = testDb('chat', (t) => ({
  idOfChat: t.identity().primaryKey(),
  title: t.text(),
  ...t.timestamps(),
}));

export type UniqueTableRecord = typeof UniqueTable.outputType;
export const UniqueTable = testDb(
  'uniqueTable',
  (t) => ({
    id: t.identity().primaryKey(),
    one: t.text().unique().primaryKey(),
    two: t.integer().unique(),
    thirdColumn: t.text(),
    fourthColumn: t.integer(),
  }),
  (t) => t.unique(['thirdColumn', 'fourthColumn']),
);

export type MessageRecord = typeof Message.outputType;
export const Message = testDb('message', (t) => ({
  id: t.identity().primaryKey(),
  chatId: t.integer().foreignKey('chat', 'id'),
  authorId: t.integer().foreignKey('user', 'id'),
  text: t.text(),
  meta: t.json().nullable(),
  ...t.timestamps(),
}));

export const messageColumnsSql = Message.q.selectAllColumns!.join(', ');

export const messageTableColumnsSql = Message.q
  .selectAllColumns!.map((c) => '"message".' + c)
  .join(', ');

export type SnakeRecord = typeof Snake.outputType;
export type SnakeData = { name: string; tags: string[] };
export const Snake = testDb(
  'snake',
  (t) => ({
    snakeId: t.identity().primaryKey(),
    snakeName: t.text().unique(),
    tailLength: t.integer(),
    snakeData: t.json<SnakeData>().nullable(),
    ...t.timestamps(),
  }),
  undefined,
  { snakeCase: true },
);

const snakeAllColumns = [
  '"snake_id" "snakeId"',
  '"snake_name" "snakeName"',
  '"tail_length" "tailLength"',
  '"snake_data" "snakeData"',
  '"created_at" "createdAt"',
  '"updated_at" "updatedAt"',
];
export const snakeSelectAll = snakeAllColumns.join(', ');
export const snakeSelectAllWithTable = snakeAllColumns
  .map((item) => `"snake".${item}`)
  .join(', ');

export const Post = testDb('post', (t) => ({
  id: t.identity().primaryKey(),
  title: t.text(),
  body: t.text(),
  generatedTsVector: t.tsvector().generated(['title', 'text']).searchIndex(),
  ...t.timestamps(),
}));

export const postColumnsSql = Post.q.selectAllColumns!.join(', ');

export const Tag = testDb('tag', (t) => ({
  tag: t.text().primaryKey(),
}));

export const Product = testDb('product', (t) => ({
  id: t.identity().primaryKey(),
  camelCase: t.text().nullable(),
  priceAmount: t.decimal(),
}));

export const expectQueryNotMutated = (q: Query) => {
  const select = q.table === 'user' ? userColumnsSql : '*';
  expectSql(q.toSQL(), `SELECT ${select} FROM "${q.table}"`);
};

export const insert = async <T extends RecordUnknown & { id: number }>(
  table: string,
  record: T,
): Promise<T> => {
  const columns = Object.keys(record);
  const result = await testDb.adapter.query<{ id: number }>(
    `INSERT INTO "${table}"(${columns
      .map((column) => `"${column}"`)
      .join(', ')}) VALUES (${columns
      .map((column) => escapeForLog(record[column]))
      .join(', ')}) RETURNING "id"`,
  );

  record.id = result.rows[0].id;
  return record;
};

export const userData = {
  name: 'name',
  password: 'password',
};

export const profileData = {
  bio: 'text',
};

export const chatData = {
  title: 'title',
};

export const messageData = {
  text: 'text',
};

export const snakeData = {
  snakeName: 'Dave',
  tailLength: 5,
};

export const uniqueTableData = {
  one: 'one',
  two: 2,
  thirdColumn: 'three',
  fourthColumn: 4,
};
