import { createDb } from 'pqb';
import { expectSql, now, testDb, useTestDatabase } from 'test-utils';
import { setDefaultNowFn } from './columnType';

// now() should be customizable: https://github.com/romeerez/orchid-orm/issues/71
setDefaultNowFn('custom_now()');

describe('timestamps methods', () => {
  useTestDatabase();

  describe.each(['timestamps', 'timestampsNoTZ'])('%s', (key) => {
    describe.each(['default naming', 'custom naming'])('%s', (naming) => {
      const [createdAtKey, updatedAtKey, updatedAtName] =
        naming === 'default naming'
          ? ['createdAt', 'updatedAt', 'updatedAt']
          : ['createdAtKey', 'updatedAtKey', 'updatedAtName'];

      const table = testDb('user', (t) => ({
        name: t.text().primaryKey(),
        [createdAtKey]: t[key as 'timestamps']().createdAt,
        [updatedAtKey]: t[key as 'timestamps']().updatedAt.name(updatedAtName),
      }));

      it('should update updatedAt column when updating', () => {
        const q = table.where().update({});

        expectSql(
          q.toSQL(),
          `
            UPDATE "user"
            SET "${updatedAtName}" = (custom_now())
          `,
        );
      });

      it('should not update updatedAt column when updating it via object', () => {
        const q = table.where().update({ [updatedAtKey]: now });

        expectSql(
          q.toSQL(),
          `
            UPDATE "user"
            SET "${updatedAtName}" = $1
          `,
          [now],
        );
      });

      it('should update updatedAt when updating with raw sql', () => {
        const q = table
          .where()
          .updateSql(testDb.sql`name = $name`.values({ name: 'name' }));

        expectSql(
          q.toSQL(),
          `
            UPDATE "user"
            SET name = $1, "${updatedAtName}" = (custom_now())
          `,
          ['name'],
        );
      });

      it('should update updatedAt when updating with raw sql which has updatedAt somewhere but not in set', () => {
        const q = table
          .where()
          .updateSql(
            testDb.sql({ raw: `"${createdAtKey}" = "${updatedAtName}"` }),
          );

        expectSql(
          q.toSQL(),
          `
            UPDATE "user"
            SET "${createdAtKey}" = "${updatedAtName}", "${updatedAtName}" = (custom_now())
          `,
        );
      });

      it('should not update updatedAt column when updating with raw sql which contains `updatedAt = `', () => {
        const q = table.where().updateSql(
          testDb
            .sql({
              raw: `"${updatedAtName}" = $time`,
            })
            .values({ time: now }),
        );

        expectSql(
          q.toSQL(),
          `
            UPDATE "user"
            SET "${updatedAtName}" = $1
          `,
          [now],
        );
      });
    });
  });

  it('should use snake cased names when snakeCase set to true', () => {
    const db = createDb({
      databaseURL: process.env.PG_URL,
      snakeCase: true,
    });

    const table = db('snake', (t) => ({
      id: t.serial().primaryKey(),
      ...t.timestamps(),
    }));

    expect(table.shape).toMatchObject({
      createdAt: { data: { name: 'created_at' } },
      updatedAt: { data: { name: 'updated_at' } },
    });
  });

  it('should not update updated_at column when updating snakeCase table with `updatedAt` provided in object', () => {
    const db = createDb({
      databaseURL: process.env.PG_URL,
      snakeCase: true,
    });

    const table = db(
      'snake',
      (t) => ({
        id: t.serial().primaryKey(),
        ...t.timestamps(),
      }),
      undefined,
      { snakeCase: true },
    );

    const q = table.where().update({ updatedAt: now });

    expectSql(
      q.toSQL(),
      `
          UPDATE "snake"
          SET "updated_at" = $1
        `,
      [now],
    );
  });
});
