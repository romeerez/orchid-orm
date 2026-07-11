import {
  expectQueryNotMutated,
  Snake,
  User,
} from '../../../test-utils/pqb.test-utils';
import { expectSql, testDb } from 'test-utils';

describe('window', () => {
  it('should add window which can be used in `over`', () => {
    const q = User.all();

    expectSql(
      q
        .window({
          w: {
            partitionBy: 'id',
            order: {
              id: 'DESC',
            },
          },
        })
        .select({
          avg: (q) =>
            q.avg('id', {
              over: 'w',
            }),
        })
        .toSQL(),
      `
          SELECT avg("User"."id") OVER "w" "avg" FROM "schema"."user" "User"
          WINDOW "w" AS (PARTITION BY "User"."id" ORDER BY "User"."id" DESC)
        `,
    );
    expectQueryNotMutated(q);
  });

  it('should add window partitioned by named columns', () => {
    const q = Snake.window({
      w: {
        partitionBy: 'snakeName',
        order: {
          tailLength: 'DESC',
        },
      },
    }).select({ avg: (q) => q.avg('tailLength', { over: 'w' }) });

    expectSql(
      q.toSQL(),
      `
          SELECT avg("Snake"."tail_length") OVER "w" "avg" FROM "schema"."snake" "Snake"
          WINDOW "w" AS (PARTITION BY "Snake"."snake_name" ORDER BY "Snake"."tail_length" DESC)
        `,
    );
  });

  it('adds window with raw sql', () => {
    const q = User.all();

    const windowSql = 'PARTITION BY id ORDER BY name DESC';
    expectSql(
      q
        .window({ w: testDb.sql({ raw: windowSql }) })
        .select({
          avg: (q) =>
            q.avg('id', {
              over: 'w',
            }),
        })
        .toSQL(),
      `
        SELECT avg("User"."id") OVER "w" "avg" FROM "schema"."user" "User"
        WINDOW "w" AS (PARTITION BY id ORDER BY name DESC)
      `,
    );
    expectQueryNotMutated(q);
  });
});
