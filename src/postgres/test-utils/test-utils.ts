import { Query } from '../model';

export type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

export const line = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

export const expectQueryNotMutated = (q: Query) => {
  expect(q.toSql()).toBe(`SELECT "${q.table}".* FROM "${q.table}"`);
};
