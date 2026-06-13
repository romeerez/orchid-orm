import { testTransaction, createDbWithAdapter } from 'pqb';
import {
  AdapterClass,
  DriverAdapter,
  SchemaConfigFnWithOptions,
} from 'pqb/internal';
import { Column } from 'pqb/internal';
import {
  makeColumnTypes,
  defaultSchemaConfig,
  QueryData,
  MaybeArray,
  SingleSqlItem,
  Sql,
  toArray,
  noop,
} from 'pqb/internal';
import { zodSchemaConfig, ZodSchemaConfig } from 'orchid-orm-schema-to-zod';
import {
  createDb as nodePostgresCreateDb,
  NodePostgresAdapter,
  nodePostgresSchemaConfig,
} from 'pqb/node-postgres';
import { orchidORM as nodePostgresOrchidORM } from '../../orm/src/adapters/node-postgres';
import { rakeDb as nodePostgresRakeDb } from '../../rake-db/src/adapters/node-postgres';
import {
  createDb as postgresJsCreateDb,
  PostgresJsAdapter,
} from 'pqb/postgres-js';
import { orchidORM as postgresJsOrchidORM } from '../../orm/src/adapters/postgres-js';
import { rakeDb as postgresJsRakeDb } from '../../rake-db/src/adapters/postgres-js';
import { createDb as bunCreateDb, BunAdapter, bunSchemaConfig } from 'pqb/bun';
import { orchidORM as bunOrchidORM } from '../../orm/src/adapters/bun';
import { rakeDb as bunsRakeDb } from '../../rake-db/src/adapters/bun';

export type TestAdapterName = 'postgres-js' | 'node-postgres' | 'bun';

export const defaultAdapter: TestAdapterName = 'postgres-js';

const adapterSetups = {
  'node-postgres': () => ({
    TestAdapter: NodePostgresAdapter,
    createDb: nodePostgresCreateDb,
    orchidORM: nodePostgresOrchidORM,
    rakeDb: nodePostgresRakeDb,
  }),
  'postgres-js': () => ({
    TestAdapter: PostgresJsAdapter,
    createDb: postgresJsCreateDb,
    orchidORM: postgresJsOrchidORM,
    rakeDb: postgresJsRakeDb,
  }),
  bun: () => ({
    TestAdapter: BunAdapter,
    createDb: bunCreateDb,
    orchidORM: bunOrchidORM,
    rakeDb: bunsRakeDb,
  }),
} as const;

const isTestAdapterName = (adapter: string): adapter is TestAdapterName =>
  adapter in adapterSetups;

export const testAdapterName = (process.env.ADAPTER ||
  defaultAdapter) as TestAdapterName;

if (!isTestAdapterName(testAdapterName)) {
  throw new Error(
    `Invalid ADAPTER "${testAdapterName}", expected "postgres-js" or "node-postgres"`,
  );
}

const driverItems = adapterSetups[testAdapterName]();

export const allDriverAdapters: {
  [K in TestAdapterName]?: {
    adapter: DriverAdapter;
    schemaConfig?: SchemaConfigFnWithOptions;
  };
} = process.versions.bun
  ? {
      bun: {
        adapter: BunAdapter,
        schemaConfig: bunSchemaConfig,
      },
    }
  : {
      'node-postgres': {
        adapter: NodePostgresAdapter,
        schemaConfig: nodePostgresSchemaConfig,
      },
      'postgres-js': {
        adapter: PostgresJsAdapter,
      },
    };

export const testAdapterConfig =
  allDriverAdapters[testAdapterName]?.schemaConfig;

export const testJsonValue = (x: unknown): unknown =>
  !(testAdapterConfig?.jsonEncodedByDriver ?? true) ? JSON.stringify(x) : x;

export const TestAdapter = driverItems.TestAdapter;
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

export const testSchemaConfig = zodSchemaConfig();

export const testAdapter = new AdapterClass({
  driverAdapter: TestAdapter,
  config: testDbOptions,
});

export const testDefaultSchemaConfig = defaultSchemaConfig(testAdapterConfig);

export const testDefaultColumnTypes = makeColumnTypes(testDefaultSchemaConfig);

export const testColumnTypes = {
  ...testDefaultColumnTypes,
  timestamp(precision?: number) {
    return testDefaultColumnTypes.timestamp(precision).asDate();
  },
  timestampNoTZ(precision?: number) {
    return testDefaultColumnTypes.timestampNoTZ(precision).asDate();
  },
};

export const testDb = createDbWithAdapter({
  snakeCase: true,
  adapter: testAdapter,
  columnTypes: testColumnTypes,
  log: !process.env.CI,
  schema: () => 'schema',
});

export const { sql } = testDb;

export const zodColumnTypes = makeColumnTypes(
  zodSchemaConfig(testDefaultSchemaConfig),
);

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
  //
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
