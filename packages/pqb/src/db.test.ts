import { db, expectSql } from './test-utils';

describe('db', () => {
  it('supports table without schema', () => {
    const table = db('table');
    const query = table.select('id', 'name').where({ foo: 'bar' });
    expectSql(
      query.toSql(),
      `
        SELECT "table"."id", "table"."name" FROM "table"
        WHERE "table"."foo" = $1
      `,
      ['bar'],
    );
  });
});
