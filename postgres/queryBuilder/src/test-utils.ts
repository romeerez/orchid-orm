import { Query } from './query';
import { Adapter } from './adapter';
import { createDb } from './db';
import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
  unpatchPgForTransactions,
} from 'pg-transactional-tests';
import { Client } from 'pg';

export const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

export const adapter = Adapter({ connectionString: process.env.DATABASE_URL });

export const db = createDb(adapter);

export const User = db('user', (t) => ({
  id: t.serial().primaryKey(),
  name: t.text(),
  password: t.text(),
  picture: t.text().nullable(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
}));

export const Profile = db('profile', (t) => ({
  id: t.serial().primaryKey(),
  userId: t.integer(),
  bio: t.text().nullable(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
}));

export const Chat = db('chat', (t) => ({
  id: t.serial().primaryKey(),
  title: t.text(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
}));

export const Message = db('message', (t) => ({
  id: t.serial().primaryKey(),
  chatId: t.integer(),
  authorId: t.integer(),
  text: t.text(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
}));

export const line = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

export const expectQueryNotMutated = (q: Query) => {
  expect(q.toSql()).toBe(`SELECT "${q.table}".* FROM "${q.table}"`);
};

export type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

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
