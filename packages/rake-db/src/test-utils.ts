import { Migration } from './migration/migration';
import { MaybeArray, toArray, TransactionAdapter } from 'pqb';

let db: Migration | undefined;

export const getDb = () => {
  if (db) return db;

  db = new Migration({} as unknown as TransactionAdapter, true, {
    log: false,
  });
  db.query = queryMock;
  return db;
};

export const queryMock = jest.fn();

export const resetDb = () => {
  queryMock.mockClear();
  queryMock.mockResolvedValue(undefined);
  getDb().up = true;
};

export const setDbDown = () => {
  getDb().up = false;
  queryMock.mockClear();
};

export const trim = (s: string) => {
  return s.trim().replace(/\n\s+/g, '\n');
};

export const toLine = (s: string) => {
  return s.trim().replace(/\n\s*/g, ' ');
};

export const expectSql = (sql: MaybeArray<string>) => {
  expect(
    queryMock.mock.calls.map((call) =>
      trim(
        typeof call[0] === 'string'
          ? call[0]
          : (call[0] as { text: string }).text,
      ),
    ),
  ).toEqual(toArray(sql).map(trim));
};
