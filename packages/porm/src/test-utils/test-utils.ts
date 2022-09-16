import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
  unpatchPgForTransactions,
} from 'pg-transactional-tests';
import { dbClient } from './test-db';

export type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

export const line = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

export const expectSql = (
  sql: { text: string; values: unknown[] },
  text: string,
  values: unknown[] = [],
) => {
  expect(sql.text).toBe(line(text));
  expect(sql.values).toEqual(values);
};

export const now = new Date();
export const userData = {
  name: 'name',
  password: 'password',
  updatedAt: now,
  createdAt: now,
};

export const profileData = {
  bio: 'bio',
  updatedAt: now,
  createdAt: now,
};

export const chatData = {
  title: 'chat',
  updatedAt: now,
  createdAt: now,
};

export const messageData = {
  text: 'text',
  updatedAt: now,
  createdAt: now,
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
