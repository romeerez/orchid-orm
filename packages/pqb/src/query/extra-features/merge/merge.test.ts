import { logParamToLogObject } from '../../basic-features/log/log';
import {
  assertType,
  expectSql,
  testZodColumnTypes as t,
  testDb,
  db,
  UserDefaultSelect,
  UserSelectAll,
  UserSelectAllWithTable,
} from 'test-utils';
import { emptyObject, noop } from '../../../utils';
import { ComputedColumn } from '../computed/computed';
import { Expression } from '../../expressions/expression';
import { prepareSubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { getValueKey } from '../../basic-features/get/get-value-key';

describe('merge queries', () => {
  describe('select', () => {
    it('should use second select when no select', () => {
      const q = db.user.merge(db.user.select('Id'));

      assertType<Awaited<typeof q>, { Id: number }[]>();

      expectSql(q.toSQL(), `SELECT "user"."id" "Id" FROM "schema"."user"`);
    });

    it('should merge selects when both have it', () => {
      const q = db.user.select('Id').merge(db.user.select('Name'));

      assertType<Awaited<typeof q>, { Id: number; Name: string }[]>();

      expectSql(
        q.toSQL(),
        `SELECT "user"."id" "Id", "user"."name" "Name" FROM "schema"."user"`,
      );
    });
  });

  describe('returnType', () => {
    it('should have default return type if none of the queries have it', () => {
      const q = db.user.merge(db.user);

      assertType<typeof q.returnType, undefined>();
      assertType<Awaited<typeof q>, UserDefaultSelect[]>();
    });

    it('should use left return type unless right has it', () => {
      const q = db.user.take().merge(db.user);

      assertType<typeof q.returnType, 'oneOrThrow'>();
      assertType<Awaited<typeof q>, UserDefaultSelect>();

      expectSql(
        q.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" LIMIT 1`,
      );
    });

    it('should prefer right return type', () => {
      const q = db.user.take().merge(db.user.all());

      assertType<typeof q.returnType, 'all'>();
      assertType<Awaited<typeof q>, UserDefaultSelect[]>();

      expectSql(q.toSQL(), `SELECT ${UserSelectAll} FROM "schema"."user"`);
    });
  });

  describe('where', () => {
    it('should use right where when left has no where', () => {
      const q = db.user.merge(db.user.where({ Id: 1 }));

      assertType<(typeof q)['__hasWhere'], true>();

      expectSql(
        q.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" WHERE "user"."id" = $1`,
        [1],
      );
    });

    it('should merge where when both have it', () => {
      const q = db.user
        .where({ Id: 1, Name: 'name' })
        .merge(db.user.where({ Id: 2 }));

      assertType<(typeof q)['__hasWhere'], true>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" = $1 AND "user"."name" = $2 AND "user"."id" = $3
        `,
        [1, 'name', 2],
      );
    });
  });

  describe('join', () => {
    it('should keep join from left and have joined table in selectable if right query does not have it', () => {
      const joined = db.user.join(db.message, 'AuthorId', 'Id');

      const q = joined.merge(db.user);

      assertType<typeof q.__selectable, typeof joined.__selectable>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable} FROM "schema"."user"
          JOIN "schema"."message" ON "message"."author_id" = "user"."id"
           AND ("message"."deleted_at" IS NULL)
        `,
      );
    });

    it('should use join from right and have joined table in selectable when left query does not have it', () => {
      const joined = db.user.join(db.message, 'AuthorId', 'Id');

      const q = db.user.merge(joined);

      assertType<typeof q.__selectable, typeof joined.__selectable>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable} FROM "schema"."user"
          JOIN "schema"."message" ON "message"."author_id" = "user"."id"
           AND ("message"."deleted_at" IS NULL)
        `,
      );
    });

    it('should merge joins when both have it', () => {
      const left = db.user.join(db.message, 'AuthorId', 'Id');
      const right = db.user.join(db.profile, 'UserId', 'Id');

      const q = left.merge(right);

      assertType<
        typeof q.__selectable,
        typeof left.__selectable & typeof right.__selectable
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable} FROM "schema"."user"
          JOIN "schema"."message" ON "message"."author_id" = "user"."id"
           AND ("message"."deleted_at" IS NULL)
          JOIN "schema"."profile" ON "profile"."user_id" = "user"."id"
        `,
      );
    });
  });

  describe('windows', () => {
    it('should keep windows from left when right does not have it', () => {
      const q = db.user
        .window({
          w: {
            partitionBy: 'Id',
          },
        })
        .merge(db.user);

      assertType<typeof q.windows, { w: true }>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WINDOW "w" AS (PARTITION BY "user"."id")
        `,
      );
    });

    it('should use windows from right when left does not have it', () => {
      const q = db.user.merge(
        db.user.window({
          w: {
            partitionBy: 'Id',
          },
        }),
      );

      assertType<typeof q.windows, { w: true }>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WINDOW "w" AS (PARTITION BY "user"."id")
        `,
      );
    });

    it('should merge windows when both have it', () => {
      const q = db.user
        .window({
          a: {
            partitionBy: 'Id',
          },
        })
        .merge(
          db.user.window({
            b: {
              partitionBy: 'Name',
            },
          }),
        );

      assertType<typeof q.windows, { a: true; b: true }>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WINDOW "a" AS (PARTITION BY "user"."id"),
                 "b" AS (PARTITION BY "user"."name")
        `,
      );
    });
  });

  describe('with', () => {
    it('should keep with from left when right does not have it', () => {
      const withQuery = db.user.select('Id');

      const q = db.user.with('withAlias', withQuery).merge(db.user);

      assertType<
        typeof q.withData,
        {
          withAlias: {
            table: 'withAlias';
            shape: typeof withQuery.result;
          };
        }
      >();

      expectSql(
        q.toSQL(),
        `
          WITH "withAlias" AS (
            SELECT "user"."id" "Id" FROM "schema"."user"
          )
          SELECT ${UserSelectAll} FROM "schema"."user"
        `,
      );
    });

    it('should use with from right when left does not have it', () => {
      const withQuery = db.user.select('Id');

      const q = db.user.merge(db.user.with('withAlias', withQuery));

      assertType<
        typeof q.withData,
        {
          withAlias: {
            table: 'withAlias';
            shape: typeof withQuery.result;
          };
        }
      >();

      expectSql(
        q.toSQL(),
        `
          WITH "withAlias" AS (
            SELECT "user"."id" "Id" FROM "schema"."user"
          )
          SELECT ${UserSelectAll} FROM "schema"."user"
        `,
      );
    });

    it('should merge withes when both have it', () => {
      const firstWith = db.user.select('Id');
      const secondWith = db.user.select('Name');

      const q = db.user
        .with('a', firstWith)
        .merge(db.user.with('b', secondWith));

      assertType<
        typeof q.withData,
        {
          a: {
            table: 'a';
            shape: typeof firstWith.result;
          };
          b: {
            table: 'b';
            shape: typeof secondWith.result;
          };
        }
      >();

      expectSql(
        q.toSQL(),
        `
          WITH "a" AS (
            SELECT "user"."id" "Id" FROM "schema"."user"
          ), "b" AS (
            SELECT "user"."name" "Name" FROM "schema"."user"
          )
          SELECT ${UserSelectAll} FROM "schema"."user"
        `,
      );
    });
  });

  describe('queryData', () => {
    it('should merge query data', () => {
      const query1 = db.user.clone();
      const query2 = db.user.clone();
      const q1 = query1.q;
      const q2 = query2.q;

      q1.shape = {
        number: t.integer(),
      };
      q2.shape = {
        string: t.string(),
      };
      q1.wrapInTransaction = false;
      q2.wrapInTransaction = true;
      q1.throwOnNotFound = false;
      q2.throwOnNotFound = true;
      q1.withShapes = { a: { shape: { id: t.integer() } } };
      q2.withShapes = { b: { shape: { name: t.string() } } };
      q1.schema = 'a';
      q2.schema = 'b';
      q1.as = 'a';
      q2.as = 'b';
      q1.from = testDb.sql`a`;
      q2.from = testDb.sql`b`;
      q1.coalesceValue = 'a';
      q2.coalesceValue = 'b';
      q1.parsers = { [getValueKey]: (x) => x, a: (x) => x };
      q2.parsers = { [getValueKey]: (x) => x, b: (x) => x };
      q1.notFoundDefault = 1;
      q2.notFoundDefault = 2;
      q1.defaults = { a: 1 };
      q2.defaults = { b: 2 };
      q1.before = [() => {}];
      q2.before = [() => {}];
      q1.log = logParamToLogObject(console, true);
      q2.log = logParamToLogObject(console, true);
      q1.logger = {
        log() {},
        error() {},
        warn() {},
      };
      q2.logger = console;
      q1.type = 'update';
      q2.type = 'insert';

      const computedA = new ComputedColumn('one', [], noop);
      const computedB = new ComputedColumn('one', [], noop);
      q1.selectedComputeds = { a: computedA };
      q2.selectedComputeds = { b: computedB };

      q1.distinct = ['id'];
      q2.distinct = ['name'];
      q1.only = false;
      q2.only = true;
      q1.joinedShapes = { a: q1.shape };
      q2.joinedShapes = { b: q2.shape };
      q1.joinedParsers = { a: q1.parsers };
      q2.joinedParsers = { b: q2.parsers };
      q1.joined = { a: db.user };
      q2.joined = { b: db.user };
      q1.group = ['a'];
      q2.group = ['b'];

      const sum = [db.user.sum('Id').gt(1).q.expr as Expression];
      const avg = [db.user.avg('Id').lt(10).q.expr as Expression];
      q1.having = [sum];
      q2.having = [avg];

      q1.union = {
        b: prepareSubQueryForSql(db.user, db.user),
        u: [{ a: testDb.sql`a`, k: 'UNION' }],
      };
      q2.union = {
        b: prepareSubQueryForSql(db.user, db.user),
        u: [{ a: testDb.sql`b`, k: 'EXCEPT' }],
      };
      q1.order = [{ id: 'ASC' }];
      q2.order = [{ name: 'DESC' }];
      q1.limit = 1;
      q2.limit = 2;
      q1.offset = 1;
      q2.offset = 2;
      q1.for = { type: 'UPDATE' };
      q2.for = { type: 'SHARE' };
      q1.getColumn = t.integer();
      q2.getColumn = t.string();

      q1.columns = ['id'];
      q2.columns = ['name'];
      q1.values = [[1]];
      q2.values = [['name']];
      q1.join = [{ type: 'a', args: { w: 'a', a: [emptyObject] } }];
      q2.join = [{ type: 'b', args: { w: 'b', a: [emptyObject] } }];
      q1.onConflict = {};
      q2.onConflict = {
        target: 'target',
        merge: 'merge',
      };
      q1.beforeCreate = [() => {}];
      q2.beforeCreate = [() => {}];
      q1.afterCreate = [() => {}];
      q2.afterCreate = [() => {}];
      q1.afterCreateSelect = new Set(['one']);
      q2.afterCreateSelect = new Set(['two']);

      q1.updateData = [{ id: 1 }];
      q2.updateData = [{ name: 'name' }];
      q1.beforeUpdate = [() => {}];
      q2.beforeUpdate = [() => {}];
      q1.afterUpdate = [() => {}];
      q2.afterUpdate = [() => {}];
      q1.afterUpdateSelect = new Set(['one']);
      q2.afterUpdateSelect = new Set(['two']);

      q1.beforeDelete = [() => {}];
      q2.beforeDelete = [() => {}];
      q1.afterDelete = [() => {}];
      q2.afterDelete = [() => {}];
      q1.afterDeleteSelect = new Set(['one']);
      q2.afterDeleteSelect = new Set(['two']);

      const { q } = query1.merge(query2);
      expect(q.shape).toEqual({
        number: q1.shape.number,
        string: q2.shape.string,
      });
      expect(q.wrapInTransaction).toBe(true);
      expect(q.throwOnNotFound).toBe(true);
      expect(q.withShapes).toEqual({
        ...q1.withShapes,
        ...q2.withShapes,
      });
      expect(q.schema).toBe('b');
      expect(q.as).toBe('b');
      expect(q.from).toEqual(testDb.sql`b`);
      expect(q.coalesceValue).toBe('b');
      expect(q.parsers).toEqual({
        ...q1.parsers,
        ...q2.parsers,
      });
      expect(q.notFoundDefault).toBe(2);
      expect(q.defaults).toEqual({
        ...q1.defaults,
        ...q2.defaults,
      });
      expect(q.before).toEqual([...q1.before, ...q2.before]);
      expect(q.log).toBe(q2.log);
      expect(q.logger).toBe(q2.logger);
      expect(q.type).toBe(q2.type);
      expect(q.selectedComputeds).toEqual({
        a: computedA,
        b: computedB,
      });

      expect(q.distinct).toEqual([...q1.distinct, ...q2.distinct]);
      expect(q.only).toEqual(q2.only);
      expect(q.joinedShapes).toEqual({
        ...q1.joinedShapes,
        ...q2.joinedShapes,
      });
      expect(q.joinedParsers).toEqual({
        ...q1.joinedParsers,
        ...q2.joinedParsers,
      });
      expect(q.joined).toEqual({
        ...q1.joined,
        ...q2.joined,
      });
      expect(q.group).toEqual([...q1.group, ...q2.group]);
      expect(q.having).toEqual([sum, avg]);
      expect(q.union).toEqual({
        b: db.user,
        u: [...q1.union.u, ...q2.union.u],
      });
      expect(q.order).toEqual([...q1.order, ...q2.order]);
      expect(q.limit).toEqual(q2.limit);
      expect(q.offset).toEqual(q2.offset);
      expect(q.for).toEqual(q2.for);
      expect(q.getColumn).toEqual(q2.getColumn);

      expect(q.columns).toEqual([...q1.columns, ...q2.columns]);
      expect(q.values).toEqual([...q1.values, ...q2.values]);
      expect(q.join).toEqual([...q1.join, ...q2.join]);
      expect(q.onConflict).toEqual(q2.onConflict);
      expect(q.beforeCreate).toEqual([...q1.beforeCreate, ...q2.beforeCreate]);
      expect(q.afterCreate).toEqual([...q1.afterCreate, ...q2.afterCreate]);
      expect(q.afterCreateSelect).toEqual(new Set(['one', 'two']));

      expect(q.updateData).toEqual([...q1.updateData, ...q2.updateData]);
      expect(q.beforeUpdate).toEqual([...q1.beforeUpdate, ...q2.beforeUpdate]);
      expect(q.afterUpdate).toEqual([...q1.afterUpdate, ...q2.afterUpdate]);
      expect(q.afterUpdateSelect).toEqual(new Set(['one', 'two']));

      expect(q.beforeDelete).toEqual([...q1.beforeDelete, ...q2.beforeDelete]);
      expect(q.afterDelete).toEqual([...q1.afterDelete, ...q2.afterDelete]);
      expect(q.afterDeleteSelect).toEqual(new Set(['one', 'two']));
    });
  });
});
