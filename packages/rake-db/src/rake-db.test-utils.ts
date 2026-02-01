import { createMigrationInterface, DbMigration } from './migration/migration';
import {
  DefaultColumnTypes,
  makeColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  AdapterBase,
  ColumnSchemaConfig,
  MaybeArray,
  noop,
  QueryLogger,
  toArray,
} from 'pqb';
import { join } from 'path';
import { migrationConfigDefaults, RakeDbConfig } from './config';

let db: DbMigration<DefaultColumnTypes<DefaultSchemaConfig>> | undefined;

export const testMigrationsPath = 'migrations-path';

export const testConfig: RakeDbConfig<ColumnSchemaConfig> & {
  logger: QueryLogger;
  migrationsPath: string;
} = {
  ...migrationConfigDefaults,
  transaction: 'single',
  basePath: __dirname,
  dbScript: 'dbScript.ts',
  columnTypes: makeColumnTypes(defaultSchemaConfig),
  log: false,
  logger: {
    log: jest.fn(),
    error: noop,
    warn: noop,
  },
  migrationsPath: testMigrationsPath,
  recurrentPath: join(testMigrationsPath, 'recurrent'),
  migrationsTable: 'schemaMigrations',
  snakeCase: true,
  import: require,
  commands: {},
};

export const getDb = () => {
  if (db) return db;

  db = createMigrationInterface({} as unknown as AdapterBase, true, testConfig);
  db.adapter.query = queryMock;
  db.adapter.arrays = queryMock;
  return db as unknown as DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>;
};

export const queryMock = jest.fn();

export const resetDb = (up = true) => {
  queryMock.mockClear();
  const db = getDb();
  db.up = up;
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
  type Action = Exclude<Up | Down, undefined>;

  return async (
    fn: (action: Action) => Promise<void>,
    expectUp: () => void,
    expectDown: () => void,
  ) => {
    resetDb(true);
    await fn(up as Action);
    expectUp();

    resetDb(false);
    await fn(up as Action);
    expectDown();

    if (down) {
      resetDb(true);
      await fn(down as Action);
      expectDown();

      resetDb(false);
      await fn(down as Action);
      expectUp();
    }
  };
};
