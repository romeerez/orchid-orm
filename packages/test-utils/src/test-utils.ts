import {
  Adapter,
  makeColumnTypes,
  createDb,
  testTransaction,
} from '../../qb/pqb/src';
import { MaybeArray, toArray } from 'orchid-core';
import { z } from 'zod';
import { zodSchemaConfig, ZodSchemaConfig } from 'schema-to-zod';

export type TestSchemaConfig = ZodSchemaConfig;

export const testDbOptions = {
  databaseURL: process.env.PG_URL,
  columnSchema: zodSchemaConfig,
};

export const testSchemaConfig = zodSchemaConfig;

export const testAdapter = new Adapter(testDbOptions);

const columnTypes = makeColumnTypes(zodSchemaConfig);

export const testColumnTypes = {
  ...columnTypes,
  text(min = 0, max = Infinity) {
    return columnTypes.text(min, max);
  },
  timestamp() {
    return columnTypes.timestamp().parse(z.date(), (input) => new Date(input));
  },
  timestampNoTZ() {
    return columnTypes
      .timestampNoTZ()
      .parse(z.date(), (input) => new Date(input));
  },
};

export const testDb = createDb({
  adapter: testAdapter,
  schemaConfig: zodSchemaConfig,
  columnTypes: testColumnTypes,
});

export const line = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

export const expectSql = (
  sql: MaybeArray<{ text: string; values: unknown[] }>,
  text: string,
  values: unknown[] = [],
) => {
  toArray(sql).forEach((item) => {
    expect(item.text).toBe(line(text));
    expect(item.values).toEqual(values);
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
