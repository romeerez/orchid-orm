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
          SELECT avg("user"."id") OVER "w" "avg" FROM "schema"."user"
          WINDOW "w" AS (PARTITION BY "user"."id" ORDER BY "user"."id" DESC)
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
          SELECT avg("snake"."tail_length") OVER "w" "avg" FROM "schema"."snake"
          WINDOW "w" AS (PARTITION BY "snake"."snake_name" ORDER BY "snake"."tail_length" DESC)
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
        SELECT avg("user"."id") OVER "w" "avg" FROM "schema"."user"
        WINDOW "w" AS (PARTITION BY id ORDER BY name DESC)
      `,
    );
    expectQueryNotMutated(q);
  });
});
