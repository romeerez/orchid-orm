import { expectSql, sql, testDb } from 'test-utils';

const User = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.text().selectSql((column) => sql`upper(${column})`),
    password: t
      .text()
      .select(false)
      .selectSql((column) => sql`lower(${column})`),
  }),
  undefined,
  {
    schema: () => 'schema',
  },
);

describe('selectSql', () => {
  it('should use selectSql in default select', () => {
    expectSql(
      User.all().toSQL(),
      `
        SELECT "id", (upper("user"."name")) "name"
        FROM "schema"."user"
      `,
    );
  });

  it('should use selectSql in explicit selects and keep select(false) explicit', () => {
    expectSql(
      User.select('name', 'password').toSQL(),
      `
        SELECT (upper("user"."name")) "name", (lower("user"."password")) "password"
        FROM "schema"."user"
      `,
    );
  });

  it('should use selectSql in wildcard selects', () => {
    expectSql(
      User.select('*').toSQL(),
      `
        SELECT "id", (upper("user"."name")) "name"
        FROM "schema"."user"
      `,
    );
  });

  it('should use selectSql in aliased select', () => {
    expectSql(
      User.select({ upperName: 'name' }).toSQL(),
      `
        SELECT (upper("user"."name")) "upperName"
        FROM "schema"."user"
      `,
    );
  });

  it('should use selectSql in get and pluck', () => {
    expectSql(
      User.get('name').toSQL(),
      `
        SELECT (upper("user"."name"))
        FROM "schema"."user"
        LIMIT 1
      `,
    );

    expectSql(
      User.pluck('name').toSQL(),
      `
        SELECT (upper("user"."name")) "name"
        FROM "schema"."user"
      `,
    );
  });

  it('should keep query conditions physical', () => {
    expectSql(
      User.where({ name: 'name' }).toSQL(),
      `
        SELECT "id", (upper("user"."name")) "name"
        FROM "schema"."user"
        WHERE "user"."name" = $1
      `,
      ['name'],
    );
  });

  it('should keep order physical', () => {
    expectSql(
      User.order('name').toSQL(),
      `
        SELECT "id", (upper("user"."name")) "name"
        FROM "schema"."user"
        ORDER BY "user"."name" ASC
      `,
    );
  });

  it('should keep writes physical and use selectSql in returning', () => {
    expectSql(
      User.select('name')
        .create({ name: 'name', password: 'password' })
        .toSQL(),
      `
        INSERT INTO "schema"."user"("name", "password")
        VALUES ($1, $2)
        RETURNING (upper("user"."name")) "name"
      `,
      ['name', 'password'],
    );
  });

  it('should preserve jsonCast in json output', () => {
    const Product = testDb('product', (t) => ({
      id: t.identity().primaryKey(),
      price: t.decimal().selectSql((column) => sql`trim_scale(${column})`),
      textPrice: t
        .text()
        .selectSql((column) =>
          sql`to_number(${column}, '999.99')`.type((t) => t.decimal()),
        ),
    }));

    expectSql(
      Product.json().toSQL(),
      `
        SELECT COALESCE(json_agg(json_build_object('id', t."id", 'price', t."price"::text, 'textPrice', t."textPrice"::text)), '[]')
        FROM (
          SELECT "id", (trim_scale("product"."price")) "price", (to_number("product"."text_price", '999.99')) "textPrice"
          FROM "schema"."product"
        ) "t"
      `,
    );
  });
});
