import { createMigrationInterface, Migration } from './migration/migration';
import { columnTypes, TransactionAdapter } from 'pqb';
import { MaybeArray, toArray } from 'orchid-core';

let db: Migration | undefined;

export const getDb = () => {
  if (db) return db;

  db = createMigrationInterface({} as unknown as TransactionAdapter, true, {
    basePath: __dirname,
    dbScript: 'dbScript.ts',
    columnTypes,
    log: false,
    migrationsPath: 'migrations-path',
    migrationsTable: 'schemaMigrations',
    snakeCase: false,
    import: require,
    commands: {},
  });
  db.adapter.query = queryMock;
  db.adapter.arrays = queryMock;
  return db;
};

export const queryMock = jest.fn();

export const resetDb = (up = true) => {
  queryMock.mockClear();
  queryMock.mockResolvedValue(undefined);
  const db = getDb();
  db.up = up;
  db.migratedAsts.length = 0;
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

export const makeTestUpAndDown = <
  Up extends string,
  Down extends string | undefined = undefined,
>(
  up: Up,
  down?: Down,
) => {
  return async (
    fn: (action: Up | Down) => Promise<void>,
    expectUp: () => void,
    expectDown: () => void,
  ) => {
    resetDb(true);
    await fn(up);
    expectUp();

    resetDb(false);
    await fn(up);
    expectDown();

    if (down) {
      resetDb(true);
      await fn(down);
      expectDown();

      resetDb(false);
      await fn(down);
      expectUp();
    }
  };
};
