import { Query } from '../query';
import { quote } from '../quote';
import { expectSql, testDb, testDbClient } from 'test-utils';

export type UserRecord = (typeof User)['type'];
export const User = testDb('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
  password: t.text(),
  picture: t.text().nullable(),
  data: t
    .json((j) =>
      j.object({
        name: j.string(),
        tags: j.string().array(),
      }),
    )
    .nullable(),
  age: t.integer().nullable(),
  active: t.boolean().nullable(),
  ...t.timestamps(),
}));

export type ProfileRecord = (typeof Profile)['type'];
export const Profile = testDb('profile', (t) => ({
  id: t.identity().primaryKey(),
  userId: t.integer().foreignKey('user', 'id'),
  bio: t.text().nullable(),
  ...t.timestamps(),
}));

export const Chat = testDb('chat', (t) => ({
  idOfChat: t.identity().primaryKey(),
  title: t.text(),
  ...t.timestamps(),
}));

export const UniqueTable = testDb('uniqueTable', (t) => ({
  id: t.identity().primaryKey(),
  one: t.text().unique().primaryKey(),
  two: t.integer().unique(),
  thirdColumn: t.text(),
  fourthColumn: t.integer(),
  ...t.unique(['thirdColumn', 'fourthColumn']),
}));

export type MessageRecord = (typeof Message)['type'];
export const Message = testDb('message', (t) => ({
  id: t.identity().primaryKey(),
  chatId: t.integer().foreignKey('chat', 'id'),
  authorId: t.integer().foreignKey('user', 'id'),
  text: t.text(),
  meta: t.json().nullable(),
  ...t.timestamps(),
}));

export type SnakeRecord = (typeof Snake)['type'];
export const Snake = testDb('snake', (t) => ({
  snakeId: t.name('snake_id').identity().primaryKey(),
  snakeName: t.name('snake_name').text(),
  tailLength: t.name('tail_length').integer(),
  snakeData: t.name('snake_data').json().nullable(),
  ...t.timestampsSnakeCase(),
}));

const snakeAllColumns = [
  '"snake_id" AS "snakeId"',
  '"snake_name" AS "snakeName"',
  '"tail_length" AS "tailLength"',
  '"snake_data" AS "snakeData"',
  '"created_at" AS "createdAt"',
  '"updated_at" AS "updatedAt"',
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

export const expectQueryNotMutated = (q: Query) => {
  expectSql(q.toSql(), `SELECT * FROM "${q.table}"`);
};

export const insert = async <
  T extends Record<string, unknown> & { id: number },
>(
  table: string,
  record: T,
): Promise<T> => {
  const columns = Object.keys(record);
  const result = await testDbClient.query<{ id: number }>(
    `INSERT INTO "${table}"(${columns
      .map((column) => `"${column}"`)
      .join(', ')}) VALUES (${columns
      .map((column) => quote(record[column]))
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
