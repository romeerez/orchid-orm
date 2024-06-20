import { orchidORM } from './orm';
import { createRepo } from './repo';
import { BaseTable } from './test-utils/orm.test-utils';
import { assertType, expectSql, testDbOptions } from 'test-utils';
import { QueryReturnType } from 'orchid-core';

class SomeTable extends BaseTable {
  readonly table = 'someTable';
  filePath = 'repo.test.ts';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }));

  relations = {
    other: this.hasMany(() => OtherTable, {
      primaryKey: 'id',
      foreignKey: 'someId',
    }),
  };
}

class OtherTable extends BaseTable {
  readonly table = 'otherTable';
  filePath = 'repo.test.ts';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    someId: t.integer().foreignKey(() => SomeTable, 'id'),
    anotherId: t.integer().foreignKey(() => AnotherTable, 'id'),
  }));

  relations = {
    some: this.belongsTo(() => SomeTable, {
      primaryKey: 'id',
      foreignKey: 'someId',
    }),
    another: this.belongsTo(() => AnotherTable, {
      primaryKey: 'id',
      foreignKey: 'anotherId',
    }),
  };
}

class AnotherTable extends BaseTable {
  readonly table = 'another';
  filePath = 'repo.test.ts';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
  }));
}

const db = orchidORM(testDbOptions, {
  some: SomeTable,
  other: OtherTable,
  another: AnotherTable,
});

describe('createRepo', () => {
  describe('queryMethods', () => {
    const repo = createRepo(db.some, {
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

    it('should accept user defined methods and allow to use them on the table with chaining', async () => {
      const q = repo.one().two().three(123).take();

      assertType<Awaited<typeof q>, { id: number; name: string }>();

      expectSql(
        q.toSQL(),
        `
          SELECT "someTable"."id", "someTable"."name"
          FROM "someTable"
          WHERE "someTable"."id" = $1
          LIMIT 1
        `,
        [123],
      );
    });

    it('should have custom methods on relation queries inside of select', async () => {
      const q = db.other.select('id', {
        some: (q) => repo(q.some).one().two().three(123),
      });

      assertType<
        Awaited<typeof q>,
        { id: number; some: { id: number; name: string } | undefined }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "otherTable"."id",
            row_to_json("some".*) "some"
          FROM "otherTable"
          LEFT JOIN LATERAL (
            SELECT "some"."id", "some"."name"
            FROM "someTable" AS "some"
            WHERE "some"."id" = $1
              AND "some"."id" = "otherTable"."someId"
          ) "some" ON true
        `,
        [123],
      );
    });

    // for https://github.com/romeerez/orchid-orm/issues/247:
    // `q` is not `Query`, but `one` should have `this` of type `Query`
    it('should support join callback arg', () => {
      db.other.join('some', (q) => repo(q).one());
    });
  });

  describe('queryOneMethods', () => {
    const repo = createRepo(db.some, {
      queryOneMethods: {
        one(q) {
          const type: Exclude<QueryReturnType, 'all'> = q.returnType;
          return type;
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
    const repo = createRepo(db.some, {
      queryWithWhereMethods: {
        one(q) {
          const hasWhere: true = q.meta?.hasWhere;
          return hasWhere;
        },
      },
    });

    it('should define methods which are available only after all, .where, .find, or similar', () => {
      // @ts-expect-error should prevent using method on query without where conditions
      repo.one();
      // @ts-expect-error should prevent using method on query without where conditions
      repo.take().one();

      repo.all().one();
      repo.where().one();
      repo.find(1).one();
    });
  });

  describe('queryOneWithWhere', () => {
    const repo = createRepo(db.some, {
      queryOneWithWhereMethods: {
        one(q) {
          const type: Exclude<QueryReturnType, 'all'> = q.returnType;
          const hasWhere: true = q.meta?.hasWhere;
          return [type, hasWhere];
        },
      },
    });

    it('should define methods which are available only after .all, .where, .find, or similar', () => {
      // @ts-expect-error should prevent using method on query without where conditions
      repo.one();
      // @ts-expect-error should prevent using method on query without where conditions
      repo.take().one();

      // @ts-expect-error should prevent using method on query which returns multiple
      repo.all().one();

      repo.find(1).one();
    });
  });

  describe('methods', () => {
    const repo = createRepo(db.some, {
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
