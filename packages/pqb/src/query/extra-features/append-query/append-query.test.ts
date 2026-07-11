import { db, expectSql, sql, useTestDatabase } from 'test-utils';
import { _appendQuery } from './append-query';
import { NotFoundError } from 'pqb';

describe('append-query', () => {
  useTestDatabase();

  it('should wrap the main query in cte, add an addition query as cte, return the main query data', () => {
    const mainAs = jest.fn();

    const main = db.user.as('main').select('Name').where({ Name: 'name' });
    const append = db.user.select('Age').where({ Name: sql`"main"."Name"` });

    const q = _appendQuery(main, append, mainAs);

    expectSql(
      q.toSQL(),
      `
        WITH q AS (
          SELECT "main"."name" "Name" FROM "schema"."user" "main"
          WHERE "main"."name" = $1
        ), "q2" AS (
          SELECT "User"."age" "Age"
          FROM "schema"."user" "User"
          WHERE "User"."name" = "main"."Name"
        )
        SELECT * FROM q
      `,
      ['name'],
    );

    expect(mainAs).toHaveBeenCalledWith('q');
  });

  it('should through not found for the appended query when needed', async () => {
    const mainAs = jest.fn();

    const main = db.user.get('Id').takeOptional();
    const append = db.profile.find(0).update({ Bio: 'bio' });

    const q = _appendQuery(main, append, mainAs);

    await expect(q).rejects.toThrow(NotFoundError);

    expect(mainAs).toHaveBeenCalledWith('q');
  });

  it('can be nested', () => {
    const oneAs = jest.fn();
    const twoAs = jest.fn();

    const q = _appendQuery(
      db.user.select({ one: 'Id' }),
      _appendQuery(
        db.user.select({ two: 'Id' }),
        db.user.select({ three: 'Id' }),
        twoAs,
      ),
      oneAs,
    );

    expectSql(
      q.toSQL(),
      `
        WITH q AS (
          SELECT "User"."id" "one" FROM "schema"."user" "User"
        ), "q2" AS (
          SELECT "User"."id" "two" FROM "schema"."user" "User"
        ), "q3" AS (
          SELECT "User"."id" "three" FROM "schema"."user" "User"
        )
        SELECT * FROM q
      `,
    );

    expect(oneAs).toHaveBeenCalledWith('q');
    expect(twoAs).toHaveBeenCalledWith('q2');
  });

  it('can be appended to insert query in a cte', async () => {
    const insertAs = jest.fn();

    const q = db.$qb
      .with('user', () =>
        _appendQuery(
          db.user.insert({
            Name: 'name',
            UserKey: 'key',
            Password: 'password',
          }),
          db.user.getOptional('Id'),
          insertAs,
        ),
      )
      .from('user');

    expectSql(
      q.toSQL(),
      `
        WITH "user" AS (
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, $3)
          RETURNING NULL
        ), "q" AS (
          SELECT "User"."id" FROM "schema"."user" "User" LIMIT 1
        )
        SELECT FROM "user"
      `,
      ['name', 'key', 'password'],
    );

    expect(insertAs).toHaveBeenCalledWith('user');
  });
});
