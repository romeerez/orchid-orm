import { User, userColumnsSql } from '../test-utils/test-utils';
import { expectSql, sql } from 'test-utils';

describe.each(['union', 'intersect', 'except'] as const)('%s', (union) => {
  it('should handle limit, offset, order differently when placed before or after union', () => {
    const unionAll = `${union}All` as `unionAll`;

    const q = User.order('id')
      .limit(1)
      .offset(1)
      [union](User.order('name').limit(2).offset(2), () => sql`custom sql 1`)
      [unionAll](User.order('age').limit(3).offset(3), () => sql`custom sql 2`)
      .order('active')
      .limit(4)
      .offset(4);

    const UNION = union.toUpperCase();

    expectSql(
      q.toSQL(),
      `
      (
        SELECT ${userColumnsSql} FROM "user" ORDER BY "user"."id" ASC LIMIT $1 OFFSET $2
      )
      ${UNION}
      (
        SELECT ${userColumnsSql} FROM "user" ORDER BY "user"."name" ASC LIMIT $3 OFFSET $4
      )
      ${UNION} (
        custom sql 1
      )
      ${UNION} ALL
      (
        SELECT ${userColumnsSql} FROM "user" ORDER BY "user"."age" ASC LIMIT $5 OFFSET $6
      )
      ${UNION} ALL (
        custom sql 2
      )
      ORDER BY "user"."active" ASC LIMIT $7 OFFSET $8
    `,
      [1, 1, 2, 2, 3, 3, 4, 4],
    );
  });
});
