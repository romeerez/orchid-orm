import {
  expectQueryNotMutated,
  insert,
  line,
  Profile,
  User,
  useTestDatabase,
} from './test-utils';
import { raw, rawColumn } from './common';
import { DateColumn } from './columnSchema';

const insertUserAndProfile = async () => {
  const now = new Date();
  await insert('user', {
    id: 1,
    name: 'name',
    password: 'password',
    picture: null,
    createdAt: now,
    updatedAt: now,
  });

  await insert('profile', {
    id: 1,
    userId: 1,
    bio: 'text',
    createdAt: now,
    updatedAt: now,
  });
};

describe('selectMethods', () => {
  useTestDatabase();

  describe('select', () => {
    it('should have no effect if no columns provided', () => {
      const q = User.all();
      expect(q.select().toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
        `),
      );
      expect(q.select('id').select().toSql()).toBe(
        line(`
          SELECT "user"."id" FROM "user"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('should select provided columns', () => {
      const q = User.all();
      expect(q.select('id', 'name').toSql()).toBe(
        line(`
          SELECT "user"."id", "user"."name" FROM "user"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('should select table.column', () => {
      const q = User.all();
      expect(q.select('user.id', 'user.name').toSql()).toBe(
        line(`
          SELECT "user"."id", "user"."name" FROM "user"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns', () => {
      const q = User.all();

      expect(
        q
          .join(Profile, 'profile.userId', '=', 'user.id')
          .select('user.id', 'profile.userId')
          .toSql(),
      ).toBe(
        line(`
          SELECT "user"."id", "profile"."userId" FROM "user"
          JOIN "profile" ON "profile"."userId" = "user"."id"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      expect(
        q
          .join(Profile.as('p'), 'p.userId', '=', 'user.id')
          .select('user.id', 'p.userId')
          .toSql(),
      ).toBe(
        line(`
          SELECT "user"."id", "p"."userId" FROM "user"
          JOIN "profile" AS "p" ON "p"."userId" = "user"."id"
        `),
      );
      expectQueryNotMutated(q);
    });

    describe('parse columns', () => {
      beforeEach(insertUserAndProfile);

      it('should parse columns of the table', async () => {
        const q = User.select('createdAt');

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.value()) instanceof Date).toBe(true);
      });

      it('should parse columns of the table, selected by column name and table name', async () => {
        const q = User.select('user.createdAt');

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.value()) instanceof Date).toBe(true);
      });

      it('should parse columns of joined table', async () => {
        const q = Profile.join(User, 'user.id', '=', 'profile.id').select(
          'user.createdAt',
        );

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.value()) instanceof Date).toBe(true);
      });
    });
  });

  describe('selectAs', () => {
    it('should select columns with aliases', async () => {
      const q = User.all();
      expect(q.selectAs({ aliasedId: 'id', aliasedName: 'name' }).toSql()).toBe(
        line(`
          SELECT "user"."id" AS "aliasedId", "user"."name" AS "aliasedName"
          FROM "user"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('should select table.column', () => {
      const q = User.all();
      expect(
        q.selectAs({ aliasedId: 'user.id', aliasedName: 'user.name' }).toSql(),
      ).toBe(
        line(`
          SELECT "user"."id" AS "aliasedId", "user"."name" AS "aliasedName"
          FROM "user"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns', () => {
      const q = User.all();
      expect(
        q
          .join(Profile, 'profile.userId', '=', 'user.id')
          .selectAs({
            aliasedId: 'user.id',
            aliasedUserId: 'profile.userId',
          })
          .toSql(),
      ).toBe(
        line(`
          SELECT "user"."id" AS "aliasedId", "profile"."userId" AS "aliasedUserId"
          FROM "user"
          JOIN "profile" ON "profile"."userId" = "user"."id"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      expect(
        q
          .join(Profile.as('p'), 'p.userId', '=', 'user.id')
          .selectAs({
            aliasedId: 'user.id',
            aliasedUserId: 'p.userId',
          })
          .toSql(),
      ).toBe(
        line(`
          SELECT "user"."id" AS "aliasedId", "p"."userId" AS "aliasedUserId"
          FROM "user"
          JOIN "profile" AS "p" ON "p"."userId" = "user"."id"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('can select raw', () => {
      const q = User.all();
      expect(q.selectAs({ one: raw('1') }).toSql()).toBe(
        line(`
        SELECT 1 AS "one" FROM "user"
      `),
      );
      expectQueryNotMutated(q);
    });

    it('can select subquery', () => {
      const q = User.all();
      expect(q.selectAs({ subquery: User.all() }).toSql()).toBe(
        line(`
        SELECT
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
            FROM (SELECT "user".* FROM "user") AS "t"
          ) AS "subquery"
        FROM "user"
      `),
      );
      expectQueryNotMutated(q);
    });

    describe('parse columns', () => {
      beforeEach(insertUserAndProfile);

      describe('.selectAs', () => {
        it('should parse columns of the table', async () => {
          const q = User.selectAs({
            date: 'createdAt',
          });

          expect((await q.all())[0].date instanceof Date).toBe(true);
          expect((await q.take()).date instanceof Date).toBe(true);
          expect((await q.rows())[0][0] instanceof Date).toBe(true);
          expect((await q.value()) instanceof Date).toBe(true);
        });

        it('should parse columns of the table, selected by column name and table name', async () => {
          const q = User.selectAs({
            date: 'user.createdAt',
          });

          expect((await q.all())[0].date instanceof Date).toBe(true);
          expect((await q.take()).date instanceof Date).toBe(true);
          expect((await q.rows())[0][0] instanceof Date).toBe(true);
          expect((await q.value()) instanceof Date).toBe(true);
        });

        it('should parse columns of joined table', async () => {
          const q = Profile.join(User, 'user.id', '=', 'profile.id').selectAs({
            date: 'user.createdAt',
          });

          expect((await q.all())[0].date instanceof Date).toBe(true);
          expect((await q.take()).date instanceof Date).toBe(true);
          expect((await q.rows())[0][0] instanceof Date).toBe(true);
          expect((await q.value()) instanceof Date).toBe(true);
        });

        it('should parse subquery array columns', async () => {
          const q = User.selectAs({
            users: User.all(),
          });

          expect((await q.all())[0].users[0].createdAt instanceof Date).toBe(
            true,
          );
          expect((await q.take()).users[0].createdAt instanceof Date).toBe(
            true,
          );
          expect((await q.rows())[0][0][0].createdAt instanceof Date).toBe(
            true,
          );
          const value = await q.value();
          expect(
            (value as { createdAt: Date }[])[0].createdAt instanceof Date,
          ).toBe(true);
        });

        it('should parse subquery item columns', async () => {
          const q = User.selectAs({
            user: User.take(),
          });

          expect((await q.all())[0].user.createdAt instanceof Date).toBe(true);
          expect((await q.take()).user.createdAt instanceof Date).toBe(true);
          expect((await q.rows())[0][0].createdAt instanceof Date).toBe(true);
          const value = await q.value();
          expect((value as { createdAt: Date }).createdAt instanceof Date).toBe(
            true,
          );
        });

        it('should parse raw column', async () => {
          const q = User.selectAs({
            date: rawColumn(
              new DateColumn().parse((input) => new Date(input)),
              '"createdAt"',
            ),
          });

          expect((await q.all())[0].date instanceof Date).toBe(true);
          expect((await q.take()).date instanceof Date).toBe(true);
          expect((await q.rows())[0][0] instanceof Date).toBe(true);
          expect((await q.value()) instanceof Date).toBe(true);
        });
      });
    });
  });
});
