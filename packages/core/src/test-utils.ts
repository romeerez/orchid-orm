import { createDb } from 'pqb';
import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
} from 'pg-transactional-tests';
import { MaybeArray, toArray } from './utils';

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
  sql: MaybeArray<{ text: string; values: unknown[] }>,
  text: string,
  values: unknown[] = [],
) => {
  toArray(sql).forEach((item) => {
    expect(item.text).toBe(line(text));
    expect(item.values).toEqual(values);
  });
};

export const now = new Date();

export const db = createDb({
  databaseURL: process.env.PG_URL,
  columnTypes: (t) => ({
    ...t,
    text(min = 0, max = Infinity) {
      return t.text(min, max);
    },
    timestampWithoutTimeZone() {
      return t.timestampWithoutTimeZone().parse((input) => new Date(input));
    },
  }),
});

export const useTestDatabase = () => {
  beforeAll(patchPgForTransactions);
  beforeEach(startTransaction);
  afterEach(rollbackTransaction);
  afterAll(() => db.close());
};
