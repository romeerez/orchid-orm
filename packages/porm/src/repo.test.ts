import { porm } from './orm';
import { pgConfig } from './test-utils/test-db';
import { createModel } from './model';
import { assertType, expectSql } from './test-utils/test-utils';
import { columnTypes } from 'pqb';
import { createRepo } from './repo';

const Model = createModel({ columnTypes });

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

describe('createRepo', () => {
  describe('queryMethods', () => {
    const repo = createRepo(db.someModel, {
      queryMethods: {
        one(q) {
          return q.select('id');
        },
        two(q) {
          return q.select('name');
        },
        three(q, id: number) {
          return q.where({ id });
        },
      },
    });

    it('should accept user defined methods and allow to use them on the model with chaining', async () => {
      const q = repo.one().two().three(123).take();

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
        someModel: (q) => repo(q.someModel).one().two().three(123),
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

  describe('queryOneMethods', () => {
    const repo = createRepo(db.someModel, {
      queryOneMethods: {
        one(q) {
          return q.select('id');
        },
      },
    });

    it('should define methods which are available only after .take, .find, or similar', () => {
      // @ts-expect-error should prevent using method on query which returns multiple
      repo.one();

      repo.take().one();
      repo.find(1).one();
    });
  });

  describe('queryWithWhereMethods', () => {
    const repo = createRepo(db.someModel, {
      queryWithWhereMethods: {
        one(q) {
          return q.select('id');
        },
      },
    });

    it('should define methods which are available only after .where, .find, or similar', () => {
      // @ts-expect-error should prevent using method on query which returns multiple
      repo.one();
      // @ts-expect-error should prevent using method on query which returns multiple
      repo.take().one();

      repo.where().one();
      repo.find(1).one();
    });
  });

  describe('methods', () => {
    const repo = createRepo(db.someModel, {
      methods: {
        one(a: number, b: string) {
          return a + b;
        },
      },
    });

    it('should assign methods as is to the repo', () => {
      expect(repo.take().one(1, '2')).toBe('12');
    });
  });
});
