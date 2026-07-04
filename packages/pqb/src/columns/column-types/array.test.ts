import {
  expectSql,
  testDb,
  testZodColumnTypes as t,
  useTestDatabase,
} from 'test-utils';

import { ColumnToCodeCtx } from '../code';

describe('array column', () => {
  it('should have toCode', () => {
    const ctx: ColumnToCodeCtx = {
      t: 't',
      table: 'table',
      currentSchema: 'public',
    };

    const column = t.array(t.integer());
    expect(column.toCode(ctx, 'key')).toBe('t.array(t.integer())');

    expect(column.nonEmpty('nonEmpty message').toCode(ctx, 'key')).toBe(
      `t.array(t.integer()).nonEmpty('nonEmpty message')`,
    );

    expect(
      column
        .min(1, 'min message')
        .max(10, 'max message')
        .length(15, 'length message')
        .toCode(ctx, 'key'),
    ).toBe(
      `t.array(t.integer())` +
        `.min(1, 'min message')` +
        `.max(10, 'max message')` +
        `.length(15, 'length message')`,
    );
  });

  describe('operators', () => {
    useTestDatabase();

    const table = testDb('table', (t) => ({
      arr: t.array(t.integer()).primaryKey(),
    }));

    it('should have `has` operator', () => {
      const q = table.where({ arr: { has: 1 } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "schema"."table" WHERE $1 = ANY("table"."arr")`,
        [1],
      );
    });

    it('should have `hasEvery` operator', () => {
      const q = table.where({ arr: { hasEvery: [1, 2] } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "schema"."table" WHERE "table"."arr" @> $1`,
        [[1, 2]],
      );
    });

    it('should have `hasSome` operator', () => {
      const q = table.where({ arr: { hasSome: [1, 2] } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "schema"."table" WHERE "table"."arr" && $1`,
        [[1, 2]],
      );
    });

    it('should have `containedIn` operator', async () => {
      const q = table.where({ arr: { containedIn: [1, 2] } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "schema"."table" WHERE "table"."arr" <@ $1`,
        [[1, 2]],
      );
    });

    it('should have `length` operator', () => {
      const q = table.where({
        arr: { length: 3 },
      });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "schema"."table" WHERE COALESCE(array_length("table"."arr", 1), 0) = $1`,
        [3],
      );
    });

    it('should support numeric operators in the `length` operator', () => {
      const q = table.where({
        arr: { length: { gt: 3 } },
      });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "schema"."table" WHERE COALESCE(array_length("table"."arr", 1), 0) > $1`,
        [3],
      );
    });

    it('should support implicit `equals`', () => {
      const q = table.where({
        arr: [1, 2],
      });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "schema"."table" WHERE "table"."arr" = $1`,
        [[1, 2]],
      );
    });
  });
});
