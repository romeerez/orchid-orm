import {
  assertType,
  expectQueryNotMutated,
  expectSql,
  User,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { columnTypes } from '../columns';

describe('json methods', () => {
  useTestDatabase();

  describe('json', () => {
    it('wraps a query with json functions', () => {
      const q = User.all();
      expectSql(
        q.where({ id: 1 }).json().toSql(),
        `
          SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
          FROM (
            SELECT * FROM "user"
            WHERE "user"."id" = $1
          ) AS "t"
        `,
        [1],
      );
      expectQueryNotMutated(q);
    });

    it('supports `take`', () => {
      const q = User.all();
      expectSql(
        q.where({ id: 1 }).take().json().toSql(),
        `
          SELECT row_to_json("t".*)
          FROM (
            SELECT * FROM "user"
            WHERE "user"."id" = $1
            LIMIT $2
          ) AS "t"
        `,
        [1, 1],
      );
      expectQueryNotMutated(q);
    });
  });

  describe('processing and selecting json data', () => {
    beforeEach(async () => {
      await User.create({
        ...userData,
        data: { name: 'value', tags: ['one'] },
      });
    });

    describe('jsonSet', () => {
      it('should select json with updated property', async () => {
        const q = User.all();

        const query = q.jsonSet('data', ['name'], 'new value');
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_set("user"."data", '{name}', $1) AS "data"
            FROM "user"
          `,
          ['"new value"'],
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'new value', tags: ['one'] });

        assertType<
          typeof result.data,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });

      it('should accept optional `as`, `createIfMissing`', async () => {
        const q = User.all();

        const query = q.jsonSet('data', ['name'], 'new value', {
          as: 'alias',
          createIfMissing: true,
        });
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_set("user"."data", '{name}', $1, true) AS "alias"
            FROM "user"
          `,
          ['"new value"'],
        );

        const result = await query.take();
        expect(result.alias).toEqual({ name: 'new value', tags: ['one'] });

        assertType<
          typeof result.alias,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonSet(
          q.jsonInsert('data', ['tags', 0], 'two'),
          ['name'],
          'new value',
        );
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_set(
              jsonb_insert("user"."data", '{tags, 0}', $1),
              '{name}', $2
            ) AS "data"
            FROM "user"
          `,
          ['"two"', '"new value"'],
        );

        const result = await query.take();
        expect(result.data).toEqual({
          name: 'new value',
          tags: ['two', 'one'],
        });

        assertType<
          typeof result.data,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });
    });

    describe('jsonInsert', () => {
      it('should select json with updated property', async () => {
        const q = User.all();

        const query = q.jsonInsert('data', ['tags', 0], 'two');
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_insert("user"."data", '{tags, 0}', $1) AS "data"
            FROM "user"
          `,
          ['"two"'],
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: ['two', 'one'] });

        assertType<
          typeof result.data,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });

      it('should accept optional `as`, `insertAfter`', async () => {
        const q = User.all();

        const query = q.jsonInsert('data', ['tags', 0], 'two', {
          as: 'alias',
          insertAfter: true,
        });
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_insert("user"."data", '{tags, 0}', $1, true) AS "alias"
            FROM "user"
          `,
          ['"two"'],
        );

        const result = await query.take();
        expect(result.alias).toEqual({ name: 'value', tags: ['one', 'two'] });

        assertType<
          typeof result.alias,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonInsert(
          q.jsonSet('data', ['tags'], []),
          ['tags', 0],
          'tag',
        );
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_insert(
              jsonb_set("user"."data", '{tags}', $1),
              '{tags, 0}', $2
            ) AS "data"
            FROM "user"
          `,
          ['[]', '"tag"'],
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: ['tag'] });

        assertType<
          typeof result.data,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });
    });

    describe('jsonRemove', () => {
      it('should select json with removed property', async () => {
        const q = User.all();

        const query = q.jsonRemove('data', ['tags', 0]);
        expectSql(
          query.toSql(),
          `
            SELECT "user"."data" #- '{tags, 0}' AS "data"
            FROM "user"
          `,
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: [] });

        assertType<
          typeof result.data,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });

      it('should accept optional `as`', async () => {
        const q = User.all();

        const query = q.jsonRemove('data', ['tags', 0], { as: 'alias' });
        expectSql(
          query.toSql(),
          `
            SELECT "user"."data" #- '{tags, 0}' AS "alias"
            FROM "user"
          `,
        );

        const result = await query.take();
        expect(result.alias).toEqual({ name: 'value', tags: [] });

        assertType<
          typeof result.alias,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonRemove(q.jsonSet('data', ['tags'], ['tag']), [
          'tags',
          0,
        ]);
        expectSql(
          query.toSql(),
          `
            SELECT 
              jsonb_set("user"."data", '{tags}', $1) #- '{tags, 0}' AS "data"
            FROM "user"
          `,
          ['["tag"]'],
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: [] });

        assertType<
          typeof result.data,
          { name: string; tags: string[] } | null
        >();

        expectQueryNotMutated(q);
      });
    });

    describe('jsonPathQuery', () => {
      it('should select json property', async () => {
        const q = User.all();

        const query = q.jsonPathQuery(
          columnTypes.text(0, 100),
          'data',
          '$.name',
          'name',
        );
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_path_query("user"."data", $1) AS "name"
            FROM "user"
          `,
          ['$.name'],
        );

        const result = await query.take();
        expect(result.name).toBe('value');

        assertType<typeof result.name, string>();

        expectQueryNotMutated(q);
      });

      it('optionally supports vars and silent options', () => {
        const q = User.all();

        const query = q.jsonPathQuery(
          columnTypes.text(0, 100),
          'data',
          '$.name',
          'name',
          {
            vars: 'vars',
            silent: true,
          },
        );
        expectSql(
          query.toSql(),
          `
            SELECT jsonb_path_query("user"."data", $1, $2, true) AS "name"
            FROM "user"
          `,
          ['$.name', 'vars'],
        );

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonPathQuery(
          columnTypes.array(columnTypes.text(0, 100)),
          q.jsonSet('data', ['tags'], ['tag']),
          '$.tags',
          'tags',
        );
        expectSql(
          query.toSql(),
          `
            SELECT 
              jsonb_path_query(
                jsonb_set("user"."data", '{tags}', $1),
                $2
              ) AS "tags"
            FROM "user"
          `,
          ['["tag"]', '$.tags'],
        );

        const result = await query.take();
        expect(result.tags).toEqual(['tag']);

        assertType<typeof result.tags, string[]>();

        expectQueryNotMutated(q);
      });
    });
  });
});
