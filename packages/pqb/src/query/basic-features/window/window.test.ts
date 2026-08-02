import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import { db, expectSql, testDb } from 'test-utils';

describe('window', () => {
  it('should add window which can be used in `over`', () => {
    const q = db.user.all();

    expectSql(
      q
        .window({
          w: {
            partitionBy: 'Id',
            order: {
              Id: 'DESC',
            },
          },
        })
        .select({
          avg: (q) => q.avg('Id', { over: 'w' }),
        })
        .toSQL(),
      `
          SELECT avg("User"."id") OVER "w" "avg" FROM "schema"."user" "User"
          WINDOW "w" AS (PARTITION BY "User"."id" ORDER BY "User"."id" DESC)
        `,
    );
    expectQueryNotMutated(q);
  });

  it('adds window with raw sql', () => {
    const q = db.user.all();

    const windowSql = 'PARTITION BY id ORDER BY name DESC';
    expectSql(
      q
        .window({ w: testDb.sql({ raw: windowSql }) })
        .select({
          avg: (q) => q.avg('Id', { over: 'w' }),
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
