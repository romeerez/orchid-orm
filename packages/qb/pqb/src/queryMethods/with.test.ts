import { WithOptions } from '../sql';
import {
  expectQueryNotMutated,
  Profile,
  ProfileRecord,
  Snake,
  User,
} from '../test-utils/test-utils';
import {
  assertType,
  expectSql,
  testZodColumnTypes as t,
  testDb,
} from 'test-utils';

describe('with', () => {
  const options: (
    | undefined
    | (Omit<WithOptions, 'columns'> & { columns?: boolean | string[] })
  )[] = [
    undefined,
    { columns: true },
    { columns: ['custom', 'columns', 'list'] },
    { recursive: true },
    { materialized: true },
    { notMaterialized: true },
  ];

  const getExpectedWithSql = (
    sql: string,
    columns: string[],
    opts: (typeof options)[number],
  ) => {
    return `
        WITH${opts?.recursive ? ' RECURSIVE' : ''} "withAlias"${
      opts?.columns
        ? `(${(opts.columns === true ? columns : opts.columns)
            .map((column) => `"${column}"`)
            .join(', ')})`
        : ''
    } AS ${
      opts?.materialized
        ? 'MATERIALIZED '
        : opts?.notMaterialized
        ? 'NOT MATERIALIZED '
        : ''
    } (
          ${sql}
        )
        SELECT *
        FROM "withAlias"
      `;
  };

  const columnShape = {
    one: t.integer(),
    two: t.text(1, 10),
  };

  it('accepts raw parameter preceded by columns shape', () => {
    const q = User.all();

    options.forEach((options) => {
      const args: Parameters<typeof q.with> = [
        'withAlias',
        columnShape,
        testDb.sql`(VALUES (1, 'two')) t(one, two)`,
      ];

      if (options) {
        (args as unknown[]).splice(1, 0, options);
      }

      expectSql(
        q
          .with(...args)
          .from('withAlias')
          .toSQL(),
        getExpectedWithSql(
          `(VALUES (1, 'two')) t(one, two)`,
          ['one', 'two'],
          options,
        ),
      );
    });

    expectQueryNotMutated(q);
  });

  it('accepts query', () => {
    const q = User.all();

    options.forEach((options) => {
      const args: Parameters<typeof q.with> = ['withAlias', User.all()];

      if (options) {
        (args as unknown[]).splice(1, 0, options);
      }

      expectSql(
        q
          .with(...args)
          .from('withAlias')
          .toSQL(),
        getExpectedWithSql(
          'SELECT * FROM "user"',
          Object.keys(User.q.shape),
          options,
        ),
      );
    });

    expectQueryNotMutated(q);
  });

  it('accepts callback for query builder', () => {
    const q = User.all();

    options.forEach((options) => {
      const args: Parameters<typeof q.with> = [
        'withAlias',
        (qb) => qb.select({ one: testDb.sql`1`.type((t) => t.integer()) }),
      ];

      if (options) {
        (args as unknown[]).splice(1, 0, options);
      }

      expectSql(
        q
          .with(...args)
          .from('withAlias')
          .toSQL(),
        getExpectedWithSql(
          `SELECT 1 "one"`,
          // columns: true will produce empty columns list because there is no way to get it from query builder result
          [],
          options,
        ),
      );
    });

    expectQueryNotMutated(q);
  });

  it('should be usable in join', () => {
    const q = User.all();

    const received1 = q
      .with('withAlias', User.all())
      .join('withAlias', 'id', '=', 'user.id')
      .select('withAlias.id')
      .toSQL();

    const received2 = q
      .with('withAlias', User.all())
      .join('withAlias', 'withAlias.id', '=', 'user.id')
      .select('withAlias.id')
      .toSQL();

    const received3 = q
      .with('withAlias', User.all())
      .join('withAlias', testDb.sql`"withAlias"."id" = "user"."id"`)
      .select('withAlias.id')
      .toSQL();

    const received4 = q
      .with('withAlias', User.all())
      .join('withAlias', (qb) => qb.on('withAlias.id', '=', 'user.id'))
      .select('withAlias.id')
      .toSQL();

    const expected = `
      WITH "withAlias" AS (
        SELECT * FROM "user"
      )
      SELECT "withAlias"."id" FROM "user"
      JOIN "withAlias" ON "withAlias"."id" = "user"."id"
    `;

    expectSql(received1, expected);
    expectSql(received2, expected);
    expectSql(received3, expected);
    expectSql(received4, expected);

    expectQueryNotMutated(q);
  });

  it('should be usable in joinLateral', () => {
    const q = User.with('withAlias', Profile.all())
      .joinLateral('withAlias', (q) =>
        q.on('userId', 'user.id').where({ bio: 'bio' }),
      )
      .select('name', 'withAlias.*');

    assertType<
      Awaited<typeof q>,
      { name: string; withAlias: ProfileRecord }[]
    >();

    expectSql(
      q.toSQL(),
      `
        WITH "withAlias" AS (
          SELECT *
          FROM "profile"
        )
        SELECT "user"."name", row_to_json("withAlias".*) "withAlias"
        FROM "user"
        JOIN LATERAL (
          SELECT *
          FROM "withAlias"
          WHERE "withAlias"."userId" = "user"."id"
            AND "withAlias"."bio" = $1
        ) "withAlias" ON true
      `,
      ['bio'],
    );
  });

  it('can be used in .from', () => {
    const q = User.all();

    expectSql(
      q.with('withAlias', User.all()).from('withAlias').select('id').toSQL(),
      `
        WITH "withAlias" AS (
          SELECT * FROM "user"
        )
        SELECT "withAlias"."id" FROM "withAlias"
      `,
    );

    expectQueryNotMutated(q);
  });

  it('should support selecting named columns', () => {
    const q = User.with('w', Snake.select('snakeName', 'tailLength'))
      .from('w')
      .select('snakeName', 'w.tailLength');

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (
          SELECT "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength"
          FROM "snake"
        )
        SELECT "w"."snakeName", "w"."tailLength"
        FROM "w"
      `,
    );
  });
});
