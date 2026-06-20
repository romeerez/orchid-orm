import { expectSql, sql, testDb, useTestDatabase } from 'test-utils';

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

const UserWithAge = testDb(
  'user_with_age',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    balance: t
      .decimal()
      .nullable()
      .selectSql((column) => sql`trim_scale(${column})`),
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

  it('should use selectSql in aggregate values', () => {
    expectSql(
      UserWithAge.sum('balance').toSQL(),
      `
        SELECT sum((trim_scale("user_with_age"."balance")))
        FROM "schema"."user_with_age"
      `,
    );
  });

  it('should keep aggregate options physical', () => {
    expectSql(
      UserWithAge.sum('balance', {
        order: { balance: 'DESC' },
        filter: { balance: '1.1000' },
      }).toSQL(),
      `
        SELECT sum((trim_scale("user_with_age"."balance")) ORDER BY "user_with_age"."balance" DESC)
          FILTER (WHERE "user_with_age"."balance" = $1)
        FROM "schema"."user_with_age"
      `,
      ['1.1000'],
    );
  });

  it('should use selectSql in object aggregate values', () => {
    expectSql(
      UserWithAge.jsonObjectAgg({ amount: 'balance' }).toSQL(),
      `
        SELECT json_object_agg($1::text, (trim_scale("user_with_age"."balance")))
        FROM "schema"."user_with_age"
      `,
      ['amount'],
    );
  });

  it('should keep raw aggregate expressions unchanged', () => {
    expectSql(
      UserWithAge.sum(
        testDb.sql`trim_scale(balance)`.type((t) => t.decimal()),
      ).toSQL(),
      `
        SELECT sum(trim_scale(balance))
        FROM "schema"."user_with_age"
      `,
    );
  });

  describe('with test database', () => {
    useTestDatabase();

    it('should use selectSql in create returning', async () => {
      const result = await User.select('name', 'password').create({
        name: 'name',
        password: 'PASSWORD',
      });

      expect(result).toEqual({
        name: 'NAME',
        password: 'password',
      });
    });

    it('should use selectSql in update returning', async () => {
      const id = await User.get('id').create({
        name: 'name',
        password: 'password',
      });

      const result = await User.find(id)
        .update({
          name: 'updated',
          password: 'UPDATED PASSWORD',
        })
        .select('name', 'password');

      expect(result).toEqual({
        name: 'UPDATED',
        password: 'updated password',
      });
    });

    it('should use selectSql in delete returning', async () => {
      const id = await User.get('id').create({
        name: 'deleted',
        password: 'DELETED PASSWORD',
      });

      const result = await User.find(id).delete().select('name', 'password');

      expect(result).toEqual({
        name: 'DELETED',
        password: 'deleted password',
      });
    });

    it('should use selectSql in sum aggregate', async () => {
      await testDb.adapter.query(`
        CREATE TABLE "schema"."user_with_age" (
          "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          "name" text NOT NULL,
          "password" text NOT NULL,
          "balance" numeric
        )
      `);

      await UserWithAge.insertMany([
        { name: 'one', password: 'password', balance: '1.1000' },
        { name: 'two', password: 'password', balance: '2.2000' },
      ]);

      const result = await UserWithAge.sum('balance');

      expect(result).toBe('3.3');
    });
  });
});
