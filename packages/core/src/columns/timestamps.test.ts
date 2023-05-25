import { createDb } from 'pqb';
import { expectSql, now, testDb, useTestDatabase } from 'test-utils';
import { setDefaultNowFn } from 'orchid-core';

// now() should be customizable: https://github.com/romeerez/orchid-orm/issues/71
setDefaultNowFn('custom_now()');

describe('timestamps methods', () => {
  useTestDatabase();

  describe.each(['timestamps', 'timestampsNoTZ'])('%s', (key) => {
    const table = testDb('user', (t) => ({
      name: t.text().primaryKey(),
      ...t[key as 'timestamps'](),
    }));

    it('should update updatedAt column when updating', () => {
      const q = table.where().update({});

      expectSql(
        q.toSql(),
        `
          UPDATE "user"
          SET "updatedAt" = (custom_now())
      `,
      );
    });

    it('should not update updatedAt column when updating it via object', () => {
      const q = table.where().update({ updatedAt: now });

      expectSql(
        q.toSql(),
        `
        UPDATE "user"
        SET "updatedAt" = $1
      `,
        [now],
      );
    });

    it('should update updatedAt when updating with raw sql', () => {
      const q = table
        .where()
        .updateRaw(testDb.sql({ values: { name: 'name' } })`name = $name`);

      expectSql(
        q.toSql(),
        `
        UPDATE "user"
        SET name = $1, "updatedAt" = (custom_now())
      `,
        ['name'],
      );
    });

    it('should update updatedAt when updating with raw sql which has updatedAt somewhere but not in set', () => {
      const q = table.where().updateRaw(testDb.sql`"createdAt" = "updatedAt"`);

      expectSql(
        q.toSql(),
        `
        UPDATE "user"
        SET "createdAt" = "updatedAt", "updatedAt" = (custom_now())
      `,
      );
    });

    it('should not update updatedAt column when updating with raw sql which contains `updatedAt = `', () => {
      const q = table
        .where()
        .updateRaw(testDb.sql({ values: { time: now } })`"updatedAt" = $time`);

      expectSql(
        q.toSql(),
        `
        UPDATE "user"
        SET "updatedAt" = $1
      `,
        [now],
      );
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

      expect(table.shape.createdAt.data.name).toBe('created_at');
      expect(table.shape.updatedAt.data.name).toBe('updated_at');
    });
  });
});
