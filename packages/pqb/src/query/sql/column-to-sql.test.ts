import { db, expectSql, testDb } from 'test-utils';

describe('column identifiers', () => {
  const table = testDb('probe', (t) => ({
    id: t.integer().primaryKey(),
    'quoted"key': t.text(),
    mapped: t.name('quoted"name').text(),
  }));

  it.each([
    ['quoted"key', 'quoted""key'],
    ['mapped', 'quoted""name'],
    ['probe.quoted"key', 'quoted""key'],
    ['probe.mapped', 'quoted""name'],
  ] as const)('escapes known column %s in order', (field, name) => {
    expectSql(
      table.select('id').order(field).toSQL(),
      `SELECT "probe"."id" FROM "schema"."probe"
       ORDER BY "probe"."${name}" ASC`,
    );
  });

  it('escapes column names and aliases in select', () => {
    expectSql(
      table.select('quoted"key', { 'mapped"alias': 'probe.mapped' }).toSQL(),
      `SELECT "probe"."quoted""key", "probe"."quoted""name" "mapped""alias"
       FROM "schema"."probe"`,
    );
  });

  it('escapes column names in conditions', () => {
    expectSql(
      table.select('id').where({ 'quoted"key': 'value' }).toSQL(),
      `SELECT "probe"."id" FROM "schema"."probe"
       WHERE "probe"."quoted""key" = $1`,
      ['value'],
    );
  });

  it('escapes dynamic column names in group', () => {
    expectSql(
      db.user
        .select('Id')
        // @ts-expect-error runtime input must be escaped despite invalid types
        .group('id"; SELECT 1 --')
        .toSQL(),
      `SELECT "User"."id" "Id" FROM "schema"."user" "User"
       GROUP BY "User"."id""; SELECT 1 --"`,
    );
  });
});
