import { Query } from './query';
import { createDb } from './db';
import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
  unpatchPgForTransactions,
} from 'pg-transactional-tests';
import { Client } from 'pg';
import { quote } from './quote';
import { columnTypes } from './columnSchema';
import { MaybeArray, toArray } from './utils';
import { Adapter } from './adapter';

export const dbOptions = { connectionString: process.env.DATABASE_URL };

export const dbClient = new Client(dbOptions);

export const adapter = new Adapter(dbOptions);

export const db = createDb(adapter);

const dateColumn = columnTypes.timestamp().parse((input) => new Date(input));

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
  createdAt: dateColumn,
  updatedAt: dateColumn,
}));

export const Profile = db('profile', (t) => ({
  id: t.serial().primaryKey(),
  userId: t.integer(),
  bio: t.text().nullable(),
  createdAt: dateColumn,
  updatedAt: dateColumn,
}));

export const Chat = db('chat', (t) => ({
  id: t.serial().primaryKey(),
  title: t.text(),
  createdAt: dateColumn,
  updatedAt: dateColumn,
}));

export const Message = db('message', (t) => ({
  id: t.serial().primaryKey(),
  chatId: t.integer(),
  authorId: t.integer(),
  text: t.text(),
  createdAt: dateColumn,
  updatedAt: dateColumn,
}));

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

export const expectMatchObjectWithTimestamps = (
  actual: { createdAt: Date; updatedAt: Date },
  expected: { createdAt: Date; updatedAt: Date },
) => {
  expect({
    ...actual,
    createdAt: actual.createdAt.toISOString(),
    updatedAt: actual.updatedAt.toISOString(),
  }).toMatchObject({
    ...expected,
    createdAt: expected.createdAt.toISOString(),
    updatedAt: expected.updatedAt.toISOString(),
  });
};

export type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

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
  createdAt: now,
  updatedAt: now,
};

export const profileData = {
  bio: 'text',
  createdAt: now,
  updatedAt: now,
};

export const chatData = {
  title: 'title',
  createdAt: now,
  updatedAt: now,
};

export const messageData = {
  text: 'text',
  createdAt: now,
  updatedAt: now,
};

export const useTestDatabase = () => {
  beforeAll(() => {
    patchPgForTransactions();
  });
  beforeEach(async () => {
    await startTransaction(dbClient);
  });
  afterEach(async () => {
    await rollbackTransaction(dbClient);
  });
  afterAll(async () => {
    unpatchPgForTransactions();
    await dbClient.end();
  });
};
