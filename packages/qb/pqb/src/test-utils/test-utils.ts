import { Query } from '../query';
import { createDb } from '../db';
import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
} from 'pg-transactional-tests';
import { Client } from 'pg';
import { quote } from '../quote';
import { Adapter } from '../adapter';
import { MaybeArray, toArray } from 'orchid-core';

export const dbOptions = {
  databaseURL: process.env.PG_URL,
};

export const dbClient = new Client({ connectionString: dbOptions.databaseURL });

export const adapter = new Adapter(dbOptions);

export const db = createDb({
  adapter,
  columnTypes: (t) => ({
    ...t,
    text(min = 0, max = Infinity) {
      return t.text.call(this, min, max);
    },
    timestamp() {
      return t.timestamp.call(this).parse((input) => new Date(input));
    },
  }),
});

export type UserRecord = typeof User['type'];
export const User = db('user', (t) => ({
  id: t.serial().primaryKey(),
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

export type ProfileRecord = typeof Profile['type'];
export const Profile = db('profile', (t) => ({
  id: t.serial().primaryKey(),
  userId: t.integer().foreignKey('user', 'id'),
  bio: t.text().nullable(),
  ...t.timestamps(),
}));

export const Chat = db('chat', (t) => ({
  id: t.serial().primaryKey(),
  title: t.text(),
  ...t.timestamps(),
}));

export const UniqueTable = db('uniqueTable', (t) => ({
  id: t.serial().primaryKey(),
  one: t.text().unique().primaryKey(),
  two: t.integer().unique(),
  thirdColumn: t.text(),
  fourthColumn: t.integer(),
  ...t.unique(['thirdColumn', 'fourthColumn']),
}));

export type MessageRecord = typeof Message['type'];
export const Message = db('message', (t) => ({
  id: t.serial().primaryKey(),
  chatId: t.integer().foreignKey('chat', 'id'),
  authorId: t.integer().foreignKey('user', 'id'),
  text: t.text(),
  ...t.timestamps(),
}));

export type SnakeRecord = typeof Snake['type'];
export const Snake = db('snake', (t) => ({
  snakeId: t.name('snake_id').serial().primaryKey(),
  snakeName: t.name('snake_name').text(),
  tailLength: t.name('tail_length').integer(),
  snakeData: t
    .name('snake_data')
    .json((j) => j.any())
    .nullable(),
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

export const line = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

export const expectSql = (
  sql: MaybeArray<{ text: string; values: unknown[] }>,
  text: string,
  values: unknown[] = [],
) => {
  toArray(sql).forEach((item) => {
    expect(item.text).toBe(line(text));
    expect(item.values).toEqual(values);
  });
};

export const expectQueryNotMutated = (q: Query) => {
  expectSql(q.toSql(), `SELECT * FROM "${q.table}"`);
};

type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

export const assertType = <T, Expected>(
  ..._: AssertEqual<T, Expected> extends true ? [] : ['invalid type']
) => {
  // noop
};

export const insert = async <
  T extends Record<string, unknown> & { id: number },
>(
  table: string,
  record: T,
): Promise<T> => {
  const columns = Object.keys(record);
  const result = await dbClient.query<{ id: number }>(
    `INSERT INTO "${table}"(${columns
      .map((column) => `"${column}"`)
      .join(', ')}) VALUES (${columns
      .map((column) => quote(record[column]))
      .join(', ')}) RETURNING "id"`,
  );

  record.id = result.rows[0].id;
  return record;
};

export const now = new Date();
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

export const asMock = (fn: unknown) => fn as jest.Mock;

export const useTestDatabase = () => {
  beforeAll(patchPgForTransactions);
  beforeEach(startTransaction);
  afterEach(rollbackTransaction);
  afterAll(async () => {
    await dbClient.end();
    await adapter.close();
  });
};
