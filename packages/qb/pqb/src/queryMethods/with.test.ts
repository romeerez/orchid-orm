import { WithOptions } from '../sql';
import {
  expectQueryNotMutated,
  Profile,
  ProfileRecord,
  Snake,
  User,
} from '../test-utils/test-utils';
import { columnTypes } from '../columns';
import { assertType, expectSql, testDb } from 'test-utils';

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
    one: columnTypes.integer(),
    two: columnTypes.text(1, 10),
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
          .toSql(),
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
          .toSql(),
        getExpectedWithSql(
          'SELECT * FROM "user"',
          Object.keys(User.query.shape),
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
        (qb) => qb.select({ one: testDb.sql((t) => t.integer())`1` }),
      ];

      if (options) {
        (args as unknown[]).splice(1, 0, options);
      }

      expectSql(
        q
          .with(...args)
          .from('withAlias')
          .toSql(),
        getExpectedWithSql(
          `SELECT 1 AS "one"`,
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
      .toSql();

    const received2 = q
      .with('withAlias', User.all())
      .join('withAlias', 'withAlias.id', '=', 'user.id')
      .select('withAlias.id')
      .toSql();

    const received3 = q
      .with('withAlias', User.all())
      .join('withAlias', testDb.sql`"withAlias"."id" = "user"."id"`)
      .select('withAlias.id')
      .toSql();

    const received4 = q
      .with('withAlias', User.all())
      .join('withAlias', (qb) => qb.on('withAlias.id', '=', 'user.id'))
      .select('withAlias.id')
      .toSql();

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
      q.toSql(),
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
      q.with('withAlias', User.all()).from('withAlias').select('id').toSql(),
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
      q.toSql(),
      `
        WITH "w" AS (
          SELECT "snake"."snake_name" AS "snakeName", "snake"."tail_length" AS "tailLength"
          FROM "snake"
        )
        SELECT "w"."snakeName", "w"."tailLength"
        FROM "w"
      `,
    );
  });
});
