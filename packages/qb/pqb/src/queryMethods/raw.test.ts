import { ColumnType } from '../columns';
import { createDb } from '../db';
import { adapter, db, expectSql, User } from '../test-utils/test-utils';

describe('raw', () => {
  it('should use column types in callback from a db instance', () => {
    const type = {} as unknown as ColumnType;
    const db = createDb({
      adapter,
      columnTypes: {
        type: () => type,
      },
    });

    const value = db.raw((t) => t.type(), 'sql');

    expect(value.__column).toBe(type);
  });

  it('should replace values started with $', () => {
    const query = User.where(
      db.raw('a = $a AND b = $B AND c = $a1B2', {
        a: 1,
        B: 'b',
        a1B2: true,
      }),
    );

    expectSql(
      query.toSql(),
      `SELECT * FROM "user" WHERE (a = $1 AND b = $2 AND c = $3)`,
      [1, 'b', true],
    );
  });

  it('should not replace values inside string literals', () => {
    const query = User.where(
      db.raw(`foo = $foo AND bar = '$bar''$bar' AND baz = $baz`, {
        foo: 1,
        baz: true,
      }),
    );

    expectSql(
      query.toSql(),
      `SELECT * FROM "user" WHERE (foo = $1 AND bar = '$bar''$bar' AND baz = $2)`,
      [1, true],
    );
  });

  it('should throw when variable in the query is not provided', () => {
    const query = User.where(db.raw(`a = $a AND b = $b`, { a: 1 }));

    expect(() => query.toSql()).toThrow('Query variable `b` is not provided');
  });

  it('should throw when variable in the object is not used by the query', () => {
    const query = User.where(db.raw(`a = $a`, { a: 1, b: 'b' }));

    expect(() => query.toSql()).toThrow('Query variable `b` is unused');
  });
});
