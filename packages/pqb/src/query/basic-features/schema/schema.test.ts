import { db, expectSql, UserData } from 'test-utils';
import { getSqlText } from '../../sql/sql';

describe('withSchema', () => {
  it('prefixes a table with schema', () => {
    const q = db.user.get('Id').withSchema('test-schema');

    expectSql(
      q.toSQL(),
      `SELECT "User"."id" FROM "test-schema"."user" "User" LIMIT 1`,
    );
  });

  it('should work in join', () => {
    const q = db.user
      .get('Id')
      .join(db.profile.withSchema('test-schema'), 'UserId', 'Id');

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id"
        FROM "schema"."user" "User"
        JOIN "test-schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        LIMIT 1
      `,
    );
  });

  it('should prefix insert with schema', () => {
    const q = db.user.withSchema('test-schema').insert(UserData);

    expect(getSqlText(q.toSQL())).toContain('INSERT INTO "test-schema"."user"');
  });

  it('should prefix update with schema', () => {
    const q = db.user
      .withSchema('test-schema')
      .find(1)
      .update({ Name: 'name' });

    expect(getSqlText(q.toSQL())).toContain('UPDATE "test-schema"."user"');
  });

  it('should prefix delete with schema', () => {
    const q = db.user.withSchema('test-schema').find(1).delete();

    expect(getSqlText(q.toSQL())).toContain('DELETE FROM "test-schema"."user"');
  });
});
