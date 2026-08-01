import { db, expectSql, sql, UserSelectAll } from 'test-utils';

describe.each(['union', 'intersect', 'except'] as const)('%s', (union) => {
  it('should handle limit, offset, order differently when placed before or after union', () => {
    const unionAll = `${union}All` as `unionAll`;

    const q = db.user
      .order('Id')
      .limit(1)
      .offset(1)
      [union](db.user.order('Name').limit(2).offset(2), () => sql`custom sql 1`)
      [unionAll](
        db.user.order('Age').limit(3).offset(3),
        () => sql`custom sql 2`,
      )
      .order('Active')
      .limit(4)
      .offset(4);

    const UNION = union.toUpperCase();

    expectSql(
      q.toSQL(),
      `
      (
        SELECT ${UserSelectAll} FROM "schema"."user" "User" ORDER BY "User"."id" ASC LIMIT $1 OFFSET $2
      )
      ${UNION}
      (
        SELECT ${UserSelectAll} FROM "schema"."user" "User" ORDER BY "User"."name" ASC LIMIT $3 OFFSET $4
      )
      ${UNION} (
        custom sql 1
      )
      ${UNION} ALL
      (
        SELECT ${UserSelectAll} FROM "schema"."user" "User" ORDER BY "User"."age" ASC LIMIT $5 OFFSET $6
      )
      ${UNION} ALL (
        custom sql 2
      )
      ORDER BY "User"."active" ASC LIMIT $7 OFFSET $8
    `,
      [1, 1, 2, 2, 3, 3, 4, 4],
    );
  });
});
