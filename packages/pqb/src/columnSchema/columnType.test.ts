import { ColumnType } from './columnType';
import { Operators } from '../operators';
import { AssertEqual, db, insert, line, useTestDatabase } from '../test-utils';
import { User, Profile } from '../test-utils';
import { rawColumn } from '../common';
import { DateColumn } from './dateTime';

describe('column base', () => {
  useTestDatabase();

  class Column extends ColumnType {
    dataType = 'test';
    operators = Operators.any;
  }
  const column = new Column();

  describe('.primaryKey', () => {
    it('should mark column as a primary key', () => {
      expect(column.isPrimaryKey).toBe(false);
      expect(column.primaryKey().isPrimaryKey).toBe(true);
    });
  });

  describe('.hidden', () => {
    it('should mark column as hidden', () => {
      expect(column.isHidden).toBe(false);
      expect(column.hidden().isHidden).toBe(true);
    });

    test('model with hidden column should omit from select it by default', () => {
      const User = db('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().hidden(),
      }));

      const q = User.all();
      expect(q.toSql()).toBe(
        line(`
          SELECT
            "user"."id",
            "user"."name"
          FROM "user"
        `),
      );
    });

    test('model with hidden column still allows to select it', () => {
      const User = db('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().hidden(),
      }));

      const q = User.select('id', 'name', 'password');
      expect(q.toSql()).toBe(
        line(`
          SELECT
            "user"."id",
            "user"."name",
            "user"."password"
          FROM "user"
        `),
      );
    });
  });

  describe('.nullable', () => {
    it('should mark column as nullable', () => {
      expect(column.isNullable).toBe(false);
      expect(column.nullable().isNullable).toBe(true);
    });
  });

  describe('.encodeFn', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.encodeFn).toBe(undefined);
      const fn = (input: number) => input.toString();
      const withEncode = column.encode(fn);
      expect(withEncode.encodeFn).toBe(fn);
      const eq: AssertEqual<typeof withEncode.inputType, number> = true;
      expect(eq).toBeTruthy();
    });
  });

  describe('.parseFn', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.parseFn).toBe(undefined);
      const fn = () => 123;
      const withEncode = column.parse(fn);
      expect(withEncode.parseFn).toBe(fn);
      const eq: AssertEqual<typeof withEncode.type, number> = true;
      expect(eq).toBeTruthy();
    });

    describe('parsing columns', () => {
      beforeEach(async () => {
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
      });

      it('should return column data as returned from db if not set', async () => {
        const UserWithPlainTimestamp = db('user', (t) => ({
          createdAt: t.timestamp(),
        }));

        expect(typeof (await UserWithPlainTimestamp.take()).createdAt).toBe(
          'string',
        );
      });

      it('should parse all columns', async () => {
        expect((await User.all())[0].createdAt instanceof Date).toBe(true);
        expect((await User.take()).createdAt instanceof Date).toBe(true);
        expect((await User.rows())[0][4] instanceof Date).toBe(true);
      });

      describe('.select', () => {
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
