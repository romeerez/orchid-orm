import { testDb, useTestDatabase } from 'test-utils';

describe('columnType', () => {
  describe('default', () => {
    it('should accept `inputType` that may be overridden by `encode`', () => {
      testDb('user', (t) => ({
        id: t.identity().primaryKey(),
        balance: t
          .decimal()
          .encode((value: string | number) => '100' + String(value))
          // the column `type` is `string`, but default should accept `inputType` = `string | number`
          .default(500),
      }));
    });
  });

  describe('hasDefault', () => {
    it('should allow omitting the column from create', () => {
      const User = testDb('user', (t) => ({
        id: t.identity().primaryKey(),
        name: t.text().hasDefault(),
      }));

      User.create({});
    });
  });

  describe('setOnCreate, setOnUpdate, setOnSave', () => {
    useTestDatabase();

    it('should set values on create', async () => {
      const User = testDb('user', (t) => ({
        id: t.identity().primaryKey(),
        name: t.string().setOnCreate(() => 'set on create'),
        password: t.string().setOnUpdate(() => 'set on update'),
        picture: t
          .string()
          .nullable()
          .setOnSave(() => 'set on save'),
      }));

      const user = await User.create({
        name: 'name',
        password: 'password',
      });
      expect(user).toMatchObject({
        name: 'set on create',
        password: 'password',
        picture: 'set on save',
      });

      const id = await testDb.query
        .get<number>`INSERT INTO "user"("name", "password") VALUES ('name', 'password') RETURNING "id"`;

      const updated = await User.find(id)
        .update({
          name: 'name',
          password: 'password',
          picture: 'picture',
        })
        .select('*', 'password');

      expect(updated).toMatchObject({
        name: 'name',
        password: 'set on update',
        picture: 'set on save',
      });
    });

    it('should not override values when returning undefined', async () => {
      const User = testDb('user', (t) => ({
        id: t.identity().primaryKey(),
        name: t.string().setOnCreate(() => undefined),
        password: t.string().setOnUpdate(() => undefined),
        picture: t
          .string()
          .nullable()
          .setOnSave(() => undefined),
      }));

      const user = await User.create({
        name: 'name',
        password: 'password',
        picture: 'picture',
      });
      expect(user).toMatchObject({
        name: 'name',
        password: 'password',
        picture: 'picture',
      });

      const id = await testDb.query
        .get<number>`INSERT INTO "user"("name", "password") VALUES ('n', 'p') RETURNING "id"`;

      const updated = await User.find(id)
        .update({
          name: 'name',
          password: 'password',
          picture: 'picture',
        })
        .select('*', 'password');

      expect(updated).toMatchObject({
        name: 'name',
        password: 'password',
        picture: 'picture',
      });
    });
  });
});
