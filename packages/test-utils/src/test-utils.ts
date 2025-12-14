import {
  makeColumnTypes,
  testTransaction,
  defaultSchemaConfig,
  QueryData,
  createDbWithAdapter,
  MaybeArray,
  SingleSqlItem,
  Sql,
  toArray,
  Column,
  noop,
} from 'pqb';
import { zodSchemaConfig, ZodSchemaConfig } from 'orchid-orm-schema-to-zod';
import {
  createDb as nodePostgresCreateDb,
  NodePostgresAdapter,
  NodePostgresTransactionAdapter,
} from 'pqb/node-postgres';
import { orchidORM as nodePostgresOrchidORM } from '../../orm/src/adapters/node-postgres';
import { rakeDb as nodePostgresRakeDb } from '../../rake-db/src/adapters/node-postgres';
import {
  createDb as postgresJsCreateDb,
  PostgresJsAdapter,
  PostgresJsTransactionAdapter,
} from 'pqb/postgres-js';
import { orchidORM as postgresJsOrchidORM } from '../../orm/src/adapters/postgres-js';
import { rakeDb as postgresJsRakeDb } from '../../rake-db/src/adapters/postgres-js';
// is needed to get rid of TS portability error in zod column types
import 'zod';

export const testingWithPostgresJS = true;

function setupNodePostgres() {
  return {
    TestAdapter: NodePostgresAdapter,
    TestTransactionAdapter: NodePostgresTransactionAdapter,
    createDb: nodePostgresCreateDb,
    orchidORM: nodePostgresOrchidORM,
    rakeDb: nodePostgresRakeDb,
  };
}

function setupPostgresJs() {
  return {
    TestAdapter: PostgresJsAdapter,
    TestTransactionAdapter: PostgresJsTransactionAdapter,
    createDb: postgresJsCreateDb,
    orchidORM: postgresJsOrchidORM,
    rakeDb: postgresJsRakeDb,
  };
}

const driverItems = testingWithPostgresJS
  ? setupPostgresJs()
  : setupNodePostgres();

export const TestAdapter = driverItems.TestAdapter;
export const TestTransactionAdapter = driverItems.TestTransactionAdapter;
export const createTestDb = driverItems.createDb;
export const testOrchidORM = driverItems.orchidORM;
export const testRakeDb = driverItems.rakeDb;

export type TestSchemaConfig = ZodSchemaConfig;

export const testDbOptions = {
  databaseURL: process.env.PG_URL,
  columnSchema: zodSchemaConfig,
  // ignore db notifications, they're logged by default
  onnotice: noop,
};

export const testSchemaConfig = zodSchemaConfig;

export const testAdapter = new TestAdapter(testDbOptions);

export const columnTypes = makeColumnTypes(defaultSchemaConfig);

export const testColumnTypes = {
  ...columnTypes,
  timestamp(precision?: number) {
    return columnTypes.timestamp(precision).asDate();
  },
  timestampNoTZ(precision?: number) {
    return columnTypes.timestampNoTZ(precision).asDate();
  },
};

export const testDb = createDbWithAdapter({
  snakeCase: true,
  adapter: testAdapter,
  columnTypes: testColumnTypes,
  log: false,
});

export const { sql } = testDb;

const zodColumnTypes = makeColumnTypes(zodSchemaConfig);

export const testZodColumnTypes = {
  ...zodColumnTypes,
  timestamp() {
    return zodColumnTypes.timestamp().asDate();
  },
  timestampNoTZ() {
    return zodColumnTypes.timestampNoTZ().asDate();
  },
};

export const jsonBuildObjectAllSql = (
  table: { q: QueryData; shape: Column.QueryColumns },
  as: string,
) =>
  `CASE WHEN to_jsonb("${as}") IS NULL THEN NULL ELSE json_build_object(` +
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Object.keys(table.q.selectAllShape)
    .map(
      (c) =>
        `'${c}', "${as}"."${
          (
            table.shape[
              c as keyof typeof table.shape
            ] as unknown as Column.Pick.Data
          ).data.name ?? c
        }"`,
    )
    .join(', ') +
  ') END';

export const line = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

export const expectSql = (
  sql: MaybeArray<Sql>,
  text: string,
  values: unknown[] = [],
) => {
  toArray(sql).forEach((item) => {
    expect((item as SingleSqlItem).text).toBe(line(text));
    expect((item as SingleSqlItem).values).toEqual(values);
  });
};

export type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

export const assertType = <T, Expected>(
  ..._: AssertEqual<T, Expected> extends true ? [] : ['invalid type']
) => {
  // noop
};

export const now = new Date();

export const asMock = (fn: unknown) => fn as jest.Mock;

if ('afterAll' in global) {
  afterAll(() => testTransaction.close(testDb));
}

export const useTestDatabase = () => {
  beforeAll(() => testTransaction.start(testDb));

  beforeEach(() => testTransaction.start(testDb));

  afterEach(() => testTransaction.rollback(testDb));

  afterAll(() => testTransaction.rollback(testDb));
};
