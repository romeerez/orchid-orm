import { Message, Profile, User } from '../test-utils/test-utils';
import { QueryReturnType } from '../query';
import { IntegerColumn, TextColumn } from '../columns';
import { logParamToLogObject } from './log';
import {
  ColumnInfoQueryData,
  DeleteQueryData,
  InsertQueryData,
  SelectQueryData,
  TruncateQueryData,
  UpdateQueryData,
} from '../sql';
import { assertType, expectSql, testDb } from 'test-utils';
import { getValueKey } from 'orchid-core';

describe('merge queries', () => {
  describe('select', () => {
    it('should use second select when no select', () => {
      const q = User.merge(User.select('id'));

      assertType<Awaited<typeof q>, { id: number }[]>();

      expectSql(q.toSql(), `SELECT "user"."id" FROM "user"`);
    });

    it('should merge selects when both have it', () => {
      const q = User.select('id').merge(User.select('name'));

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();

      expectSql(q.toSql(), `SELECT "user"."id", "user"."name" FROM "user"`);
    });
  });

  describe('returnType', () => {
    it('should have default return type if none of the queries have it', () => {
      const q = User.merge(User);

      assertType<typeof q.returnType, QueryReturnType>();
    });

    it('should use left return type unless right has it', () => {
      const q = User.take().merge(User);

      assertType<typeof q.returnType, 'oneOrThrow'>();

      expectSql(q.toSql(), `SELECT * FROM "user" LIMIT 1`);
    });

    it('should prefer right return type', () => {
      const q = User.take().merge(User.all());

      assertType<typeof q.returnType, 'all'>();

      expectSql(q.toSql(), `SELECT * FROM "user"`);
    });
  });

  describe('where', () => {
    it('should use right where when left has no where', () => {
      const q = User.merge(User.where({ id: 1 }));

      assertType<(typeof q)['meta']['hasWhere'], true>();

      expectSql(q.toSql(), `SELECT * FROM "user" WHERE "user"."id" = $1`, [1]);
    });

    it('should merge where when both have it', () => {
      const q = User.where({ id: 1, name: 'name' }).merge(
        User.where({ id: 2 }),
      );

      assertType<(typeof q)['meta']['hasWhere'], true>();

      expectSql(
        q.toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" = $1 AND "user"."name" = $2 AND "user"."id" = $3
        `,
        [1, 'name', 2],
      );
    });
  });

  describe('join', () => {
    it('should keep join from left and have joined table in selectable if right query does not have it', () => {
      const joined = User.join(Message, 'authorId', 'id');

      const q = joined.merge(User);

      assertType<typeof q.selectable, typeof joined.selectable>();

      expectSql(
        q.toSql(),
        `
          SELECT "user".* FROM "user"
          JOIN "message" ON "message"."authorId" = "user"."id"
        `,
      );
    });

    it('should use join from right and have joined table in selectable when left query does not have it', () => {
      const joined = User.join(Message, 'authorId', 'id');

      const q = User.merge(joined);

      assertType<typeof q.selectable, typeof joined.selectable>();

      expectSql(
        q.toSql(),
        `
          SELECT "user".* FROM "user"
          JOIN "message" ON "message"."authorId" = "user"."id"
        `,
      );
    });

    it('should merge joins when both have it', () => {
      const left = User.join(Message, 'authorId', 'id');
      const right = User.join(Profile, 'userId', 'id');

      const q = left.merge(right);

      assertType<
        typeof q.selectable,
        typeof left.selectable & typeof right.selectable
      >();

      expectSql(
        q.toSql(),
        `
          SELECT "user".* FROM "user"
          JOIN "message" ON "message"."authorId" = "user"."id"
          JOIN "profile" ON "profile"."userId" = "user"."id"
        `,
      );
    });
  });

  describe('windows', () => {
    it('should keep windows from left when right does not have it', () => {
      const q = User.window({
        w: {
          partitionBy: 'id',
        },
      }).merge(User);

      assertType<typeof q.windows, { w: true }>();

      expectSql(
        q.toSql(),
        `
          SELECT * FROM "user"
          WINDOW "w" AS (PARTITION BY "user"."id")
        `,
      );
    });

    it('should use windows from right when left does not have it', () => {
      const q = User.merge(
        User.window({
          w: {
            partitionBy: 'id',
          },
        }),
      );

      assertType<typeof q.windows, { w: true }>();

      expectSql(
        q.toSql(),
        `
          SELECT * FROM "user"
          WINDOW "w" AS (PARTITION BY "user"."id")
        `,
      );
    });

    it('should merge windows when both have it', () => {
      const q = User.window({
        a: {
          partitionBy: 'id',
        },
      }).merge(
        User.window({
          b: {
            partitionBy: 'name',
          },
        }),
      );

      assertType<typeof q.windows, { a: true; b: true }>();

      expectSql(
        q.toSql(),
        `
          SELECT * FROM "user"
          WINDOW "a" AS (PARTITION BY "user"."id"),
                 "b" AS (PARTITION BY "user"."name")
        `,
      );
    });
  });

  describe('with', () => {
    it('should keep with from left when right does not have it', () => {
      const withQuery = User.select('id');

      const q = User.with('withAlias', withQuery).merge(User);

      assertType<
        typeof q.withData,
        {
          withAlias: {
            table: 'withAlias';
            shape: typeof withQuery.result;
            type: { id: number };
          };
        }
      >();

      expectSql(
        q.toSql(),
        `
          WITH "withAlias" AS (
            SELECT "user"."id" FROM "user"
          )
          SELECT * FROM "user"
        `,
      );
    });

    it('should use with from right when left does not have it', () => {
      const withQuery = User.select('id');

      const q = User.merge(User.with('withAlias', withQuery));

      assertType<
        typeof q.withData,
        {
          withAlias: {
            table: 'withAlias';
            shape: typeof withQuery.result;
            type: { id: number };
          };
        }
      >();

      expectSql(
        q.toSql(),
        `
          WITH "withAlias" AS (
            SELECT "user"."id" FROM "user"
          )
          SELECT * FROM "user"
        `,
      );
    });

    it('should merge withes when both have it', () => {
      const firstWith = User.select('id');
      const secondWith = User.select('name');

      const q = User.with('a', firstWith).merge(User.with('b', secondWith));

      assertType<
        typeof q.withData,
        {
          a: {
            table: 'a';
            shape: typeof firstWith.result;
            type: { id: number };
          };
          b: {
            table: 'b';
            shape: typeof secondWith.result;
            type: { name: string };
          };
        }
      >();

      expectSql(
        q.toSql(),
        `
          WITH "a" AS (
            SELECT "user"."id" FROM "user"
          ), "b" AS (
            SELECT "user"."name" FROM "user"
          )
          SELECT * FROM "user"
        `,
      );
    });
  });

  describe('queryData', () => {
    it('should merge query data', () => {
      const q1 = User.clone();
      const q2 = User.clone();

      q1.q.shape = {
        number: new IntegerColumn(),
      };
      q2.q.shape = {
        string: new TextColumn(),
      };
      q1.q.wrapInTransaction = false;
      q2.q.wrapInTransaction = true;
      q1.q.throwOnNotFound = false;
      q2.q.throwOnNotFound = true;
      q1.q.withShapes = { a: { id: new IntegerColumn() } };
      q2.q.withShapes = { b: { name: new TextColumn() } };
      q1.q.schema = 'a';
      q2.q.schema = 'b';
      q1.q.as = 'a';
      q2.q.as = 'b';
      q1.q.from = testDb.sql`a`;
      q2.q.from = testDb.sql`b`;
      q1.q.coalesceValue = 'a';
      q2.q.coalesceValue = 'b';
      q1.q.parsers = { [getValueKey]: (x) => x, a: (x) => x };
      q2.q.parsers = { [getValueKey]: (x) => x, b: (x) => x };
      q1.q.notFoundDefault = 1;
      q2.q.notFoundDefault = 2;
      q1.q.defaults = { a: 1 };
      q2.q.defaults = { b: 2 };
      q1.q.before = [() => {}];
      q2.q.before = [() => {}];
      q1.q.log = logParamToLogObject(console, true);
      q2.q.log = logParamToLogObject(console, true);
      q1.q.logger = { log() {}, error() {}, warn() {} };
      q2.q.logger = console;
      q1.q.type = 'update';
      q2.q.type = 'insert';

      const s1 = q1.q as unknown as SelectQueryData;
      const s2 = q2.q as unknown as SelectQueryData;
      s1.distinct = ['id'];
      s2.distinct = ['name'];
      s1.fromOnly = false;
      s2.fromOnly = true;
      s1.joinedShapes = { a: q1.q.shape };
      s2.joinedShapes = { b: q2.q.shape };
      s1.joinedParsers = { a: q1.q.parsers };
      s2.joinedParsers = { b: q2.q.parsers };
      s1.group = ['a'];
      s2.group = ['b'];
      s1.having = [{ a: { a: 1 } }];
      s2.having = [{ b: { b: 2 } }];
      s1.havingOr = [[{ a: { a: 1 } }]];
      s2.havingOr = [[{ b: { b: 2 } }]];
      s1.union = [{ arg: testDb.sql`a`, kind: 'UNION' }];
      s2.union = [{ arg: testDb.sql`b`, kind: 'EXCEPT' }];
      s1.order = [{ id: 'ASC' }];
      s2.order = [{ name: 'DESC' }];
      s1.limit = 1;
      s2.limit = 2;
      s1.offset = 1;
      s2.offset = 2;
      s1.for = { type: 'UPDATE' };
      s2.for = { type: 'SHARE' };
      s1[getValueKey] = new IntegerColumn();
      s2[getValueKey] = new TextColumn();

      const i1 = q1.q as unknown as InsertQueryData;
      const i2 = q2.q as unknown as InsertQueryData;
      i1.columns = ['id'];
      i2.columns = ['name'];
      i1.values = [[1]];
      i2.values = [['name']];
      i1.using = [{ type: 'a', args: ['a'], isSubQuery: false }];
      i2.using = [{ type: 'b', args: ['b'], isSubQuery: false }];
      i1.join = [{ type: 'a', args: ['a'], isSubQuery: false }];
      i2.join = [{ type: 'b', args: ['b'], isSubQuery: false }];
      i1.onConflict = { type: 'ignore' };
      i2.onConflict = { type: 'merge' };
      i1.beforeCreate = [() => {}];
      i2.beforeCreate = [() => {}];
      i1.afterCreate = [() => {}];
      i2.afterCreate = [() => {}];
      i1.afterCreateSelect = ['one'];
      i2.afterCreateSelect = ['two'];

      const u1 = q1.q as unknown as UpdateQueryData;
      const u2 = q2.q as unknown as UpdateQueryData;
      u1.updateData = [{ id: 1 }];
      u2.updateData = [{ name: 'name' }];
      u1.beforeUpdate = [() => {}];
      u2.beforeUpdate = [() => {}];
      i1.afterUpdate = [() => {}];
      i2.afterUpdate = [() => {}];
      i1.afterUpdateSelect = ['one'];
      i2.afterUpdateSelect = ['two'];

      const d1 = q1.q as unknown as DeleteQueryData;
      const d2 = q2.q as unknown as DeleteQueryData;
      d1.beforeDelete = [() => {}];
      d2.beforeDelete = [() => {}];
      i1.afterDelete = [() => {}];
      i2.afterDelete = [() => {}];
      i1.afterDeleteSelect = ['one'];
      i2.afterDeleteSelect = ['two'];

      const t1 = q1.q as unknown as TruncateQueryData;
      const t2 = q2.q as unknown as TruncateQueryData;
      t1.restartIdentity = false;
      t2.restartIdentity = true;
      t1.cascade = false;
      t2.cascade = true;

      const c1 = q1.q as unknown as ColumnInfoQueryData;
      const c2 = q2.q as unknown as ColumnInfoQueryData;
      c1.column = 'id';
      c2.column = 'name';

      const { q } = q1.merge(q2);
      expect(q.shape).toEqual({
        number: q1.q.shape.number,
        string: q2.q.shape.string,
      });
      expect(q.wrapInTransaction).toBe(true);
      expect(q.throwOnNotFound).toBe(true);
      expect(q.withShapes).toEqual({
        ...q1.q.withShapes,
        ...q2.q.withShapes,
      });
      expect(q.schema).toBe('b');
      expect(q.as).toBe('b');
      expect(q.from).toEqual(testDb.sql`b`);
      expect(q.coalesceValue).toBe('b');
      expect(q.parsers).toEqual({
        ...q1.q.parsers,
        ...q2.q.parsers,
      });
      expect(q.notFoundDefault).toBe(2);
      expect(q.defaults).toEqual({
        ...q1.q.defaults,
        ...q2.q.defaults,
      });
      expect(q.before).toEqual([...q1.q.before, ...q2.q.before]);
      expect(q.log).toBe(q2.q.log);
      expect(q.logger).toBe(q2.q.logger);
      expect(q.type).toBe(q2.q.type);

      const s = q as SelectQueryData;
      expect(s.distinct).toEqual([...s1.distinct, ...s2.distinct]);
      expect(s.fromOnly).toEqual(s2.fromOnly);
      expect(s.joinedShapes).toEqual({
        ...s1.joinedShapes,
        ...s2.joinedShapes,
      });
      expect(s.joinedParsers).toEqual({
        ...s1.joinedParsers,
        ...s2.joinedParsers,
      });
      expect(s.group).toEqual([...s1.group, ...s2.group]);
      expect(s.having).toEqual([...s1.having, ...s2.having]);
      expect(s.havingOr).toEqual([...s1.havingOr, ...s2.havingOr]);
      expect(s.union).toEqual([...s1.union, ...s2.union]);
      expect(s.order).toEqual([...s1.order, ...s2.order]);
      expect(s.limit).toEqual(s2.limit);
      expect(s.offset).toEqual(s2.offset);
      expect(s.for).toEqual(s2.for);
      expect(s[getValueKey]).toEqual(s2[getValueKey]);

      const i = q as InsertQueryData;
      expect(i.columns).toEqual([...i1.columns, ...i2.columns]);
      expect(i.values).toEqual([...i1.values, ...i2.values]);
      expect(i.using).toEqual([...i1.using, ...i2.using]);
      expect(i.join).toEqual([...i1.join, ...i2.join]);
      expect(i.onConflict).toEqual(i2.onConflict);
      expect(i.beforeCreate).toEqual([...i1.beforeCreate, ...i2.beforeCreate]);
      expect(i.afterCreate).toEqual([...i1.afterCreate, ...i2.afterCreate]);
      expect(i.afterCreateSelect).toEqual(['one', 'two']);

      const u = q as UpdateQueryData;
      expect(u.updateData).toEqual([...u1.updateData, ...u2.updateData]);
      expect(u.beforeUpdate).toEqual([...u1.beforeUpdate, ...u2.beforeUpdate]);
      expect(i.afterUpdate).toEqual([...i1.afterUpdate, ...i2.afterUpdate]);
      expect(i.afterUpdateSelect).toEqual(['one', 'two']);

      const d = q as DeleteQueryData;
      expect(d.beforeDelete).toEqual([...d1.beforeDelete, ...d2.beforeDelete]);
      expect(i.afterDelete).toEqual([...i1.afterDelete, ...i2.afterDelete]);
      expect(i.afterDeleteSelect).toEqual(['one', 'two']);

      const t = q as TruncateQueryData;
      expect(t.restartIdentity).toBe(t2.restartIdentity);
      expect(t.cascade).toBe(t2.cascade);

      const c = q as ColumnInfoQueryData;
      expect(c.column).toBe(c2.column);
    });
  });
});
