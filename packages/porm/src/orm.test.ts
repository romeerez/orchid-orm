import { porm } from './orm';
import {
  assertType,
  expectSql,
  userData,
  useTestDatabase,
} from './test-utils/test-utils';
import { pgConfig } from './test-utils/test-db';
import { createModel, createRepo } from './model';
import { columnTypes } from 'pqb';

describe('orm', () => {
  useTestDatabase();

  const Model = createModel({ columnTypes });

  type User = UserModel['columns']['type'];
  class UserModel extends Model {
    table = 'user';
    columns = this.setColumns((t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
    }));
  }

  class ProfileModel extends Model {
    table = 'profile';
    columns = this.setColumns((t) => ({
      id: t.serial().primaryKey(),
    }));
  }

  it('should return object with provided adapter, close and transaction method, models', () => {
    const db = porm(pgConfig, {
      user: UserModel,
      profile: ProfileModel,
    });

    expect('$adapter' in db).toBe(true);
    expect(db.$close).toBeInstanceOf(Function);
    expect(db.$transaction).toBeInstanceOf(Function);
    expect(Object.keys(db)).toEqual(
      expect.arrayContaining(['user', 'profile']),
    );
  });

  it('should return model which is a queryable interface', async () => {
    const db = porm(pgConfig, {
      user: UserModel,
      profile: ProfileModel,
    });

    const { id, name } = await db.user.create(userData);

    const query = db.user.select('id', 'name').where({ id: { gt: 0 } });

    expectSql(
      query.toSql(),
      `
        SELECT "user"."id", "user"."name"
        FROM "user"
        WHERE "user"."id" > $1
      `,
      [0],
    );

    const result = await query;
    expect(result).toEqual([{ id, name }]);

    assertType<typeof result, Pick<User, 'id' | 'name'>[]>();
  });

  describe('custom methods', () => {
    class SomeModel extends Model {
      table = 'someTable';
      columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
      }));

      relations = {
        otherModel: this.hasMany(() => OtherModel, {
          primaryKey: 'id',
          foreignKey: 'someId',
        }),
      };
    }

    class OtherModel extends Model {
      table = 'otherTable';
      columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
        someId: t.integer().foreignKey(() => SomeModel, 'id'),
        anotherId: t.integer().foreignKey(() => AnotherModel, 'id'),
      }));

      relations = {
        someModel: this.belongsTo(() => SomeModel, {
          primaryKey: 'id',
          foreignKey: 'someId',
        }),
        anotherModel: this.belongsTo(() => AnotherModel, {
          primaryKey: 'id',
          foreignKey: 'anotherId',
        }),
      };
    }

    class AnotherModel extends Model {
      table = 'anotherModel';
      columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
      }));
    }

    const db = porm(pgConfig, {
      someModel: SomeModel,
      otherModel: OtherModel,
      anotherModel: AnotherModel,
    });

    const someRepo = createRepo(db.someModel, {
      one(q) {
        return q.select('id');
      },
      two(q) {
        return q.select('name');
      },
      three(q, id: number) {
        return q.where({ id });
      },
    });

    it('should accept user defined methods and allow to use them on the model with chaining', async () => {
      const q = someRepo.one().two().three(123).take();

      assertType<Awaited<typeof q>, { id: number; name: string }>();

      expectSql(
        q.toSql(),
        `
          SELECT "someTable"."id", "someTable"."name"
          FROM "someTable"
          WHERE "someTable"."id" = $1
          LIMIT $2
        `,
        [123, 1],
      );
    });

    it('should have custom methods on relation queries inside of select', async () => {
      const q = db.otherModel.select('id', {
        someModel: (q) => someRepo(q.someModel).one().two().three(123),
      });

      assertType<
        Awaited<typeof q>,
        { id: number; someModel: { id: number; name: string } | null }[]
      >();

      expectSql(
        q.toSql(),
        `
          SELECT
            "otherTable"."id",
            (
              SELECT row_to_json("t".*)
              FROM (
                SELECT "someModel"."id", "someModel"."name"
                FROM "someTable" AS "someModel"
                WHERE "someModel"."id" = $1
                  AND "someModel"."id" = "otherTable"."someId"
                LIMIT $2
              ) AS "t"
            ) AS "someModel"
          FROM "otherTable"
        `,
        [123, 1],
      );
    });
  });
});
