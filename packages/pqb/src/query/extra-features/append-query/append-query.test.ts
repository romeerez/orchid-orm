import { db, expectSql, sql } from 'test-utils';
import { _appendQuery } from './append-query';

describe('append-query', () => {
  it('should wrap the main query in cte, add an addition query as cte, return the main query data', () => {
    const main = db.user.as('main').select('Name').where({ Name: 'name' });
    const append = db.user.select('Age').where({ Name: sql`"main"."Name"` });

    const q = _appendQuery(main, append);

    expectSql(
      q.toSQL(),
      `
        WITH "main" AS (
          SELECT "main"."name" "Name" FROM "user" "main"
          WHERE "main"."name" = $1
        ), "q" AS (
          SELECT "user"."age" "Age"
          FROM "user"
          WHERE "user"."name" = "main"."Name"
        )
        SELECT * FROM "main"
      `,
      ['name'],
    );
  });
});
