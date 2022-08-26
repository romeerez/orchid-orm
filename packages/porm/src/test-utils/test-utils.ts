import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
  unpatchPgForTransactions,
} from 'pg-transactional-tests';
import { dbClient } from './test-db';
import { quote } from 'pqb';
import { User, Profile, Message, Chat } from './test-models';

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

let userIdCounter = 1;
export const insertUser = async (
  options: Partial<User> & { count?: number } = {},
) => {
  const now = new Date();
  const { count = 1, ...data } = options;
  const id = userIdCounter;
  for (let i = 0; i < count; i++) {
    await insert('user', {
      id: userIdCounter++,
      name: 'name',
      password: 'password',
      picture: null,
      active: true,
      createdAt: now,
      updatedAt: now,
      ...data,
    });
  }
  return id;
};

let profileIdCounter = 1;
export const insertProfile = async (
  options: Partial<Profile> & { count?: number } = {},
) => {
  const now = new Date();
  const { count = 1, ...data } = options;
  const id = profileIdCounter;
  for (let i = 0; i < count; i++) {
    await insert('profile', {
      id: profileIdCounter++,
      userId: userIdCounter,
      bio: 'text',
      createdAt: now,
      updatedAt: now,
      ...data,
    });
  }
  return id;
};

let chatIdCounter = 1;
export const insertChat = async (
  options: Partial<Chat> & { count?: number } = {},
) => {
  const now = new Date();
  const { count = 1, ...data } = options;
  const id = chatIdCounter;
  for (let i = 0; i < count; i++) {
    await insert('chat', {
      id: chatIdCounter++,
      title: 'title',
      createdAt: now,
      updatedAt: now,
      ...data,
    });
  }
  return id;
};

let messageIdCounter = 1;
export const insertMessage = async (
  options: Partial<Message> & { count?: number } = {},
) => {
  const now = new Date();
  const { count = 1, ...data } = options;
  const id = messageIdCounter;
  for (let i = 0; i < count; i++) {
    await insert('message', {
      id: messageIdCounter++,
      chatId: chatIdCounter,
      authorId: userIdCounter,
      text: 'text',
      createdAt: now,
      updatedAt: now,
      ...data,
    });
  }
  return id;
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
