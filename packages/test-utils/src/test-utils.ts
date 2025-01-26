import {
  Adapter,
  makeColumnTypes,
  createDb,
  testTransaction,
  defaultSchemaConfig,
  QueryData,
} from 'pqb';
import {
  ColumnTypeBase,
  MaybeArray,
  QueryColumns,
  SingleSqlItem,
  Sql,
  toArray,
} from 'orchid-core';
import { zodSchemaConfig, ZodSchemaConfig } from 'schema-to-zod';
// is needed to get rid of TS portability error in zod column types
import 'zod';

export type TestSchemaConfig = ZodSchemaConfig;

export const testDbOptions = {
  databaseURL: process.env.PG_URL,
  columnSchema: zodSchemaConfig,
};

export const testSchemaConfig = zodSchemaConfig;

export const testAdapter = new Adapter(testDbOptions);

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

export const testDb = createDb({
  snakeCase: true,
  adapter: testAdapter,
  columnTypes: testColumnTypes,
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

export const testDbZodTypes = createDb({
  adapter: testAdapter,
  schemaConfig: zodSchemaConfig,
  columnTypes: testZodColumnTypes,
});

export const jsonBuildObjectAllSql = (
  table: { q: QueryData; shape: QueryColumns },
  as: string,
) =>
  'json_build_object(' +
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Object.keys(table.q.selectAllKeys!)
    .map(
      (c) =>
        `'${c}', "${as}"."${
          (table.shape[c as keyof typeof table.shape] as ColumnTypeBase).data
            .name ?? c
        }"`,
    )
    .join(', ') +
  ')';

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

export const useTestDatabase = () => {
  beforeAll(async () => {
    await testTransaction.start(testDb);
  });

  beforeEach(async () => {
    await testTransaction.start(testDb);
  });

  afterEach(async () => {
    await testTransaction.rollback(testDb);
  });

  afterAll(async () => {
    await testTransaction.close(testDb);
  });
};
