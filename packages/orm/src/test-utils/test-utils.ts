import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
} from 'pg-transactional-tests';
import { db } from './test-db';
import { DeleteQueryData, InsertQueryData, Query, UpdateQueryData } from 'pqb';

export const userSelectAll = db.user.internal.columnsForSelectAll!.join(', ');

export const profileSelectAll =
  db.profile.internal.columnsForSelectAll!.join(', ');

export const messageSelectAll =
  db.message.internal.columnsForSelectAll!.join(', ');

export const chatSelectAll = db.chat.internal.columnsForSelectAll!.join(', ');

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

export const toLine = (s: string) => {
  return s.trim().replace(/\n\s*/g, ' ');
};

export const now = new Date();
export const userData = {
  Name: 'name',
  Password: 'password',
  updatedAt: now,
  createdAt: now,
};

export const profileData = {
  Bio: 'bio',
  updatedAt: now,
  createdAt: now,
};

export const chatData = {
  Title: 'chat',
  updatedAt: now,
  createdAt: now,
};

export const messageData = {
  Text: 'text',
  updatedAt: now,
  createdAt: now,
};

export const useTestDatabase = () => {
  beforeAll(patchPgForTransactions);
  beforeEach(startTransaction);
  afterEach(rollbackTransaction);
  afterAll(async () => {
    await db.$close();
  });
};

export const useRelationCallback = (rel: { query: Query }) => {
  const beforeCreate = jest.fn();
  const afterCreate = jest.fn();
  const beforeUpdate = jest.fn();
  const afterUpdate = jest.fn();
  const beforeDelete = jest.fn();
  const afterDelete = jest.fn();
  const relQuery = rel.query;

  beforeAll(() => {
    relQuery._beforeCreate(beforeCreate);
    relQuery._afterCreate(afterCreate);
    relQuery._beforeUpdate(beforeUpdate);
    relQuery._afterUpdate(afterUpdate);
    relQuery._beforeDelete(beforeDelete);
    relQuery._afterDelete(afterDelete);
  });

  afterAll(() => {
    let q;
    q = relQuery.query as InsertQueryData;
    q.beforeCreate?.pop();
    q.afterCreate?.pop();
    q = relQuery.query as UpdateQueryData;
    q.beforeUpdate?.pop();
    q.afterUpdate?.pop();
    q = relQuery.query as DeleteQueryData;
    q.beforeDelete?.pop();
    q.afterDelete?.pop();
  });

  return {
    beforeCreate,
    afterCreate,
    beforeUpdate,
    afterUpdate,
    beforeDelete,
    afterDelete,
    resetMocks() {
      beforeCreate.mockReset();
      afterCreate.mockReset();
      beforeUpdate.mockReset();
      afterUpdate.mockReset();
      beforeDelete.mockReset();
      afterDelete.mockReset();
    },
  };
};
