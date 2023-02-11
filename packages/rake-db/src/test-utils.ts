import { createMigrationInterface, Migration } from './migration/migration';
import { MaybeArray, toArray, TransactionAdapter } from 'pqb';

export const asMock = (fn: unknown) => fn as jest.Mock;

let db: Migration | undefined;

export const getDb = () => {
  if (db) return db;

  db = createMigrationInterface(
    {} as unknown as TransactionAdapter,
    true,
    {
      basePath: __dirname,
      log: false,
      migrationsPath: 'migrations-path',
      migrationsTable: 'schemaMigrations',
      import: require,
      appCodeUpdater: appCodeUpdaterMock,
      commands: {},
    },
    {},
    {},
  );
  db.adapter.query = queryMock;
  db.adapter.arrays = queryMock;
  return db;
};

export const queryMock = jest.fn();
const appCodeUpdaterMock = jest.fn();

export const resetDb = () => {
  queryMock.mockClear();
  queryMock.mockResolvedValue(undefined);
  appCodeUpdaterMock.mockClear();
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
