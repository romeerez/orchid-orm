import {
  AssertEqual,
  expectQueryNotMutated,
  insert,
  line,
  User,
  useTestDatabase,
} from '../test-utils';
import { columnTypes } from '../columnSchema';

describe('json methods', () => {
  useTestDatabase();

  describe('json', () => {
    it('wraps a query with json functions', () => {
      const q = User.all();
      expect(q.json().toSql()).toBe(
        line(`
          SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
          FROM (
            SELECT "user".* FROM "user"
          ) AS "t"
        `),
      );
      expectQueryNotMutated(q);
    });

    it('supports `take`', () => {
      const q = User.all();
      expect(q.take().json().toSql()).toBe(
        line(`
          SELECT COALESCE(row_to_json("t".*), '{}') AS "json"
          FROM (
            SELECT "user".* FROM "user" LIMIT 1
          ) AS "t"
        `),
      );
      expectQueryNotMutated(q);
    });
  });

  describe('processing and selecting json data', () => {
    beforeEach(async () => {
      const now = new Date();
      await insert('user', {
        id: 1,
        name: 'name',
        password: 'password',
        picture: null,
        data: `{"name": "value", "tags": ["one"]}`,
        createdAt: now,
        updatedAt: now,
      });
    });

    describe('jsonSet', () => {
      it('should select json with updated property', async () => {
        const q = User.all();

        const query = q.jsonSet('data', ['name'], 'new value');
        expect(query.toSql()).toBe(
          line(`
          SELECT jsonb_set("user"."data", '{name}', '"new value"') AS "data"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'new value', tags: ['one'] });

        const eq: AssertEqual<
          typeof result.data,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });

      it('should accept optional `as`, `createIfMissing`', async () => {
        const q = User.all();

        const query = q.jsonSet('data', ['name'], 'new value', {
          as: 'alias',
          createIfMissing: true,
        });
        expect(query.toSql()).toBe(
          line(`
          SELECT jsonb_set("user"."data", '{name}', '"new value"', true) AS "alias"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.alias).toEqual({ name: 'new value', tags: ['one'] });

        const eq: AssertEqual<
          typeof result.alias,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonSet(
          q.jsonInsert('data', ['tags', 0], 'two'),
          ['name'],
          'new value',
        );
        expect(query.toSql()).toBe(
          line(`
          SELECT jsonb_set(
            jsonb_insert("user"."data", '{tags, 0}', '"two"'),
            '{name}', '"new value"'
          ) AS "data"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.data).toEqual({
          name: 'new value',
          tags: ['two', 'one'],
        });

        const eq: AssertEqual<
          typeof result.data,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });
    });

    describe('jsonInsert', () => {
      it('should select json with updated property', async () => {
        const q = User.all();

        const query = q.jsonInsert('data', ['tags', 0], 'two');
        expect(query.toSql()).toBe(
          line(`
          SELECT jsonb_insert("user"."data", '{tags, 0}', '"two"') AS "data"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: ['two', 'one'] });

        const eq: AssertEqual<
          typeof result.data,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });

      it('should accept optional `as`, `insertAfter`', async () => {
        const q = User.all();

        const query = q.jsonInsert('data', ['tags', 0], 'two', {
          as: 'alias',
          insertAfter: true,
        });
        expect(query.toSql()).toBe(
          line(`
          SELECT jsonb_insert("user"."data", '{tags, 0}', '"two"', true) AS "alias"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.alias).toEqual({ name: 'value', tags: ['one', 'two'] });

        const eq: AssertEqual<
          typeof result.alias,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonInsert(
          q.jsonSet('data', ['tags'], []),
          ['tags', 0],
          'tag',
        );
        expect(query.toSql()).toBe(
          line(`
          SELECT jsonb_insert(
            jsonb_set("user"."data", '{tags}', '[]'),
            '{tags, 0}', '"tag"'
          ) AS "data"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: ['tag'] });

        const eq: AssertEqual<
          typeof result.data,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });
    });

    describe('jsonRemove', () => {
      it('should select json with removed property', async () => {
        const q = User.all();

        const query = q.jsonRemove('data', ['tags', 0]);
        expect(query.toSql()).toBe(
          line(`
          SELECT "user"."data" #- '{tags, 0}' AS "data"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: [] });

        const eq: AssertEqual<
          typeof result.data,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });

      it('should accept optional `as`', async () => {
        const q = User.all();

        const query = q.jsonRemove('data', ['tags', 0], { as: 'alias' });
        expect(query.toSql()).toBe(
          line(`
          SELECT "user"."data" #- '{tags, 0}' AS "alias"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.alias).toEqual({ name: 'value', tags: [] });

        const eq: AssertEqual<
          typeof result.alias,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonRemove(q.jsonSet('data', ['tags'], ['tag']), [
          'tags',
          0,
        ]);
        expect(query.toSql()).toBe(
          line(`
          SELECT 
            jsonb_set("user"."data", '{tags}', '["tag"]') #- '{tags, 0}' AS "data"
          FROM "user"
        `),
        );

        const result = await query.take();
        expect(result.data).toEqual({ name: 'value', tags: [] });

        const eq: AssertEqual<
          typeof result.data,
          { name: string; tags: string[] } | null
        > = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });
    });

    describe('selectJsonPathQuery', () => {
      it('should select json property', async () => {
        const q = User.all();

        const query = q.jsonPathQuery(
          columnTypes.text(),
          'data',
          '$.name',
          'name',
        );
        expect(query.toSql()).toBe(
          line(`
            SELECT jsonb_path_query("user"."data", '$.name') AS "name"
            FROM "user"
          `),
        );

        const result = await query.take();
        expect(result.name).toBe('value');

        const eq: AssertEqual<typeof result.name, string> = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });

      it('optionally supports vars and silent options', () => {
        const q = User.all();

        const query = q.jsonPathQuery(
          columnTypes.text(),
          'data',
          '$.name',
          'name',
          {
            vars: 'vars',
            silent: true,
          },
        );
        expect(query.toSql()).toBe(
          line(`
            SELECT jsonb_path_query("user"."data", '$.name', 'vars', true) AS "name"
            FROM "user"
          `),
        );

        expectQueryNotMutated(q);
      });

      it('supports nesting', async () => {
        const q = User.all();

        const query = q.jsonPathQuery(
          columnTypes.array(columnTypes.text()),
          q.jsonSet('data', ['tags'], ['tag']),
          '$.tags',
          'tags',
        );
        expect(query.toSql()).toBe(
          line(`
            SELECT 
              jsonb_path_query(
                jsonb_set("user"."data", '{tags}', '["tag"]'),
                '$.tags'
              ) AS "tags"
            FROM "user"
          `),
        );

        const result = await query.take();
        expect(result.tags).toEqual(['tag']);

        const eq: AssertEqual<typeof result.tags, string[]> = true;
        expect(eq).toBe(true);

        expectQueryNotMutated(q);
      });
    });
  });
});
