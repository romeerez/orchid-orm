import {
  createBaseTable,
  DefaultSelect,
  Insertable,
  Queryable,
  Selectable,
  Updatable,
} from './legacy-table';
import {
  orchidORMWithAdapter,
  bundleOrchidORM,
  makeOrchidOrmDbWithAdapter,
  setGrants,
  defineRls,
} from '../orm';
import {
  getCallerFilePath,
  DefaultSchemaConfig,
  QuerySchema,
  DefaultColumnTypes,
  raw,
  RawSql,
} from 'pqb/internal';
import { useTestORM } from '../test-utils/orm.test-utils';
import {
  sql,
  asMock,
  assertType,
  expectSql,
  testAdapter,
  testColumnTypes,
  zodSchemaConfig,
} from 'test-utils';
import { z } from 'zod/v4';
import { QueryHelperResult } from 'pqb';

describe('baseTable', () => {
  useTestORM();

  describe('createBaseTable', () => {
    it('should support getFilePath to return a path where the baseTable is defined', () => {
      asMock(getCallerFilePath).mockReturnValueOnce('path');

      const Base = createBaseTable();
      expect(Base.getFilePath()).toBe('path');
    });

    it('should throw if cannot determine file path and calling `getFilePath`', () => {
      asMock(getCallerFilePath).mockReturnValueOnce(undefined);

      expect(() => createBaseTable().getFilePath()).toThrow(
        'Failed to determine file path',
      );
    });

    it('should set the default language to the table query', () => {
      const Base = createBaseTable({ language: 'Ukrainian' });
      class Table extends Base {
        table = 'table';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
      }
      const orm = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );

      expect(orm.table.q.language).toBe('Ukrainian');
    });

    it('should produce custom SQL for timestamps when updating', () => {
      const nowSQL = `now() AT TIME ZONE 'UTC'`;
      const Base = createBaseTable({ snakeCase: true, nowSQL });
      class UserTable extends Base {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          ...t.timestamps(),
        }));
      }

      const { user } = orchidORMWithAdapter(
        { adapter: testAdapter },
        { user: UserTable },
      );

      expect(user.internal.nowSQL).toBe(nowSQL);

      expectSql(
        user.find(1).update({}).toSQL(),
        `
          UPDATE "user" SET "updated_at" = now() AT TIME ZONE 'UTC' WHERE "user"."id" = $1
        `,
        [1],
      );
    });

    it('should preserve columnTypes type on a table', () => {
      class Table extends createBaseTable() {
        table = 'table';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
      }
      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );
      assertType<
        typeof db.table.columnTypes,
        DefaultColumnTypes<DefaultSchemaConfig>
      >();
    });

    it('should have default exportAs on BaseTable', () => {
      expect(createBaseTable().exportAs).toBe('BaseTable');
    });

    it('should allow custom exportAs on BaseTable', () => {
      const Custom = createBaseTable({ exportAs: 'custom' });
      expect(Custom.exportAs).toBe('custom');
    });
  });

  describe('table options', () => {
    it('should support `schema` option', () => {
      const Base = createBaseTable();
      class Table extends Base {
        readonly table = 'test';
        schema: QuerySchema = () => 'schema';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          name: t.text(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );

      expectSql(
        db.table.toSQL(),
        `
          SELECT *
          FROM "schema"."test"
        `,
      );
    });

    it('should support `noPrimaryKey` option to allow tables without a primary key', () => {
      const Base = createBaseTable();
      class Table extends Base {
        readonly table = 'test';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          name: t.text(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );

      expect(db.table.table).toBe('test');
    });

    it('should warn when table has no primary key and noPrimaryKey is not set', () => {
      const Base = createBaseTable();
      class Table extends Base {
        readonly table = 'test';
        columns = this.setColumns((t) => ({
          name: t.text(),
        }));
      }

      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

      expect(spy).toHaveBeenCalledWith('Table test has no primary key');
      spy.mockRestore();
    });
  });

  it('should support defining a basic table', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));
    }

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    expectSql(
      db.table.select('id', 'name').toSQL(),
      `
        SELECT "test"."id", "test"."name"
        FROM "test"
      `,
    );
  });

  it('should support tables being used via bundleOrchidORM to have makeHelper', () => {
    const Base = createBaseTable();
    class TestTable extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));
    }
    const orm = bundleOrchidORM({ tables: { table: TestTable } });
    const helper = orm.table.makeHelper((q) => q.select('id', 'name'));

    assertType<
      Awaited<QueryHelperResult<typeof helper>>,
      { id: number; name: string }[]
    >();

    const db = makeOrchidOrmDbWithAdapter(orm, {
      adapter: testAdapter,
    });

    expectSql(
      db.table.useHelper(helper).toSQL(),
      `
        SELECT "test"."id", "test"."name" FROM "test"
      `,
    );
  });

  it('should support table in makeOrchidOrmDbWithAdapter', () => {
    const Base = createBaseTable();
    class TestTable extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));
    }
    const orm = bundleOrchidORM({ tables: { table: TestTable } });
    const db = makeOrchidOrmDbWithAdapter(orm, { adapter: testAdapter });

    const query = db.table.select('id', 'name');
    assertType<Awaited<typeof query>, { id: number; name: string }[]>();

    expectSql(
      db.table.toSQL(),
      `
        SELECT * FROM "test"
      `,
    );
  });

  it('should save `tableData` to the table query builder `internal`', () => {
    const checkSql = raw({ raw: 'one > 5' });
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'table';
      columns = this.setColumns(
        (t) => ({
          id: t.identity().primaryKey(),
          name: t.string(),
        }),
        (t) => [
          t.primaryKey(['id', 'name']),
          t.index(['id', 'name']),
          t.check(checkSql, 'constraintName'),
        ],
      );
    }

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    expect(db.table.internal.tableData).toMatchObject({
      primaryKey: { columns: ['id', 'name'] },
      indexes: [
        { columns: [{ column: 'id' }, { column: 'name' }], options: {} },
      ],
      constraints: [{ name: 'constraintName', check: checkSql }],
    });
  });

  it('should support table type helpers', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        visible: t.text().parse(() => true),
        hidden: t.text().select(false),
        optional: t.text().default('text'),
        required: t.boolean(),
      }));
    }

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    assertType<
      Queryable<Table>,
      {
        id?: number;
        visible?: string;
        hidden?: string;
        optional?: string;
        required?: boolean;
      }
    >();
    assertType<
      DefaultSelect<Table>,
      { id: number; visible: boolean; optional: string; required: boolean }
    >();
    assertType<
      Selectable<Table>,
      {
        id: number;
        visible: boolean;
        hidden: string;
        optional: string;
        required: boolean;
      }
    >();
    assertType<
      Insertable<Table>,
      {
        id?: number;
        visible: string;
        hidden: string;
        optional?: string;
        required: boolean;
      }
    >();
    assertType<
      Updatable<Table>,
      {
        id?: number;
        visible?: string;
        hidden?: string;
        optional?: string;
        required?: boolean;
      }
    >();
    expect(db.table.table).toBe('test');
  });

  it('should support validation schema methods on table definitions', () => {
    const Base = createBaseTable({ schemaConfig: zodSchemaConfig });
    class TestTable extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));
    }

    const tableInputSchema = TestTable.inputSchema();
    const tableOutputSchema = TestTable.outputSchema();
    const tableQuerySchema = TestTable.querySchema();
    const tablePkeySchema = TestTable.pkeySchema();
    const tableCreateSchema = TestTable.createSchema();
    const tableUpdateSchema = TestTable.updateSchema();

    const expected = z.object({ id: z.number(), name: z.string() });
    const expectedQuery = expected.partial();
    const expectedPkey = expected.pick({ id: true });
    const expectedCreate = expected.omit({ id: true });
    const expectedUpdate = expectedCreate.partial();

    assertType<typeof tableInputSchema, typeof expected>();
    assertType<typeof tableOutputSchema, typeof expected>();
    assertType<typeof tableQuerySchema, typeof expectedQuery>();
    assertType<typeof tablePkeySchema, typeof expectedPkey>();
    assertType<typeof tableCreateSchema, typeof expectedCreate>();
    assertType<typeof tableUpdateSchema, typeof expectedUpdate>();

    expect(tableInputSchema.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,
      name: 'name',
    });
    expect(tableOutputSchema.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,
      name: 'name',
    });
    expect(tableQuerySchema.parse({ name: 'name' })).toEqual({
      name: 'name',
    });
    expect(tablePkeySchema.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,
    });
    expect(tableCreateSchema.parse({ name: 'name' })).toEqual({
      name: 'name',
    });
    expect(tableUpdateSchema.parse({})).toEqual({});

    expect(() => tableInputSchema.parse({ id: '1', name: 'name' })).toThrow(
      'Invalid input: expected number, received string',
    );
    expect(() => tableQuerySchema.parse({ id: '1' })).toThrow(
      'Invalid input: expected number, received string',
    );
    expect(tablePkeySchema.safeParse({}).success).toBe(false);
  });

  it('should support belongsTo relation', async () => {
    const Base = createBaseTable({ snakeCase: true });

    class UserTable extends Base {
      readonly table = 'user';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));
    }

    class ProfileTable extends Base {
      readonly table = 'profile';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer().nullable(),
      }));

      relations = {
        user: this.belongsTo(() => UserTable, {
          columns: ['userId'],
          references: ['id'],
        }),
        requiredUser: this.belongsTo(() => UserTable, {
          columns: ['userId'],
          references: ['id'],
          required: true,
        }),
      };
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      { profile: ProfileTable, user: UserTable },
    );

    const user = { name: 'name', password: 'password' };
    await db.profile.insert({
      user: {
        create: user,
      },
    });

    const optional = await db.profile.select({
      user: (q) => q.user,
    });
    const required = await db.profile.select({
      requiredUser: (q) => q.requiredUser,
    });

    assertType<
      typeof optional,
      { user: { id: number; name: string; password: string } | undefined }[]
    >();
    assertType<
      typeof required,
      { requiredUser: { id: number; name: string; password: string } }[]
    >();

    expect(optional).toMatchObject([{ user }]);
    expect(required).toMatchObject([{ requiredUser: user }]);
  });

  it('should support self-referencing relation', async () => {
    const Base = createBaseTable({ snakeCase: true });

    class CategoryTable extends Base {
      readonly table = 'category';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        categoryName: t.text().primaryKey(),
        parentName: t.text().nullable(),
      }));

      relations = {
        parentCategory: this.belongsTo(() => CategoryTable, {
          columns: ['parentName'],
          references: ['categoryName'],
        }),
      };
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      { category: CategoryTable },
    );
    await db.category.createMany([
      { categoryName: 'parent' },
      { categoryName: 'child', parentName: 'parent' },
    ]);

    const result = await db.category.find('child').select({
      parent: (q) => q.parentCategory,
    });

    assertType<
      typeof result,
      {
        parent:
          | {
              categoryName: string;
              parentName: string | null;
            }
          | undefined;
      }
    >();

    expect(result).toEqual({
      parent: {
        categoryName: 'parent',
        parentName: null,
      },
    });
  });

  it('should support hasOne relation', async () => {
    const Base = createBaseTable({ snakeCase: true });

    class UserTable extends Base {
      readonly table = 'user';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));

      relations = {
        profile: this.hasOne(() => ProfileTable, {
          columns: ['id'],
          references: ['userId'],
        }),
        requiredProfile: this.hasOne(() => ProfileTable, {
          columns: ['id'],
          references: ['userId'],
          required: true,
        }),
      };
    }

    class ProfileTable extends Base {
      readonly table = 'profile';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer().nullable(),
        bio: t.text().nullable(),
      }));
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      { user: UserTable, profile: ProfileTable },
    );

    const profile = { bio: 'bio' };
    await db.user.insert({
      name: 'name',
      password: 'password',
      profile: {
        create: profile,
      },
    });

    const optional = await db.user.select({
      profile: (q) => q.profile,
    });
    const required = await db.user.select({
      requiredProfile: (q) => q.requiredProfile,
    });

    assertType<
      typeof optional,
      {
        profile:
          | { id: number; userId: number | null; bio: string | null }
          | undefined;
      }[]
    >();
    assertType<
      typeof required,
      {
        requiredProfile: {
          id: number;
          userId: number | null;
          bio: string | null;
        };
      }[]
    >();

    expect(optional).toMatchObject([{ profile }]);
    expect(required).toMatchObject([{ requiredProfile: profile }]);
  });

  it('should support hasMany relation', () => {
    const Base = createBaseTable({ snakeCase: true });

    class UserTable extends Base {
      readonly table = 'user';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));

      relations = {
        posts: this.hasMany(() => PostTable, {
          columns: ['id'],
          references: ['userId'],
        }),
        tags: this.hasMany(() => TagTable, {
          through: 'posts',
          source: 'tags',
        }),
      };
    }

    class PostTable extends Base {
      readonly table = 'post';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer().nullable(),
        title: t.text(),
        body: t.text(),
      }));

      relations = {
        postTags: this.hasMany(() => PostTagTable, {
          columns: ['id'],
          references: ['postId'],
        }),
        tags: this.hasMany(() => TagTable, {
          through: 'postTags',
          source: 'tagRecord',
        }),
      };
    }

    class TagTable extends Base {
      readonly table = 'tag';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        tag: t.text().primaryKey(),
      }));
    }

    class PostTagTable extends Base {
      readonly table = 'postTag';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        postId: t.integer(),
        tag: t.text(),
      }));

      relations = {
        tagRecord: this.belongsTo(() => TagTable, {
          columns: ['tag'],
          references: ['tag'],
        }),
      };
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        user: UserTable,
        post: PostTable,
        postTag: PostTagTable,
        tag: TagTable,
      },
    );

    expect(db.user.relations).toHaveProperty('posts');
    expect(db.user.relations).toHaveProperty('tags');
  });

  it('should support hasOne through relation', () => {
    const Base = createBaseTable({ snakeCase: true });

    class UserTable extends Base {
      readonly table = 'user';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));

      relations = {
        profile: this.hasOne(() => ProfileTable, {
          columns: ['id'],
          references: ['userId'],
        }),
        picture: this.hasOne(() => ProfilePictureTable, {
          through: 'profile',
          source: 'pic',
        }),
        requiredPicture: this.hasOne(() => ProfilePictureTable, {
          through: 'profile',
          source: 'pic',
          required: true,
        }),
      };
    }

    class ProfileTable extends Base {
      readonly table = 'profile';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer().unique(),
        bio: t.text().nullable(),
      }));

      relations = {
        pic: this.hasOne(() => ProfilePictureTable, {
          columns: ['id'],
          references: ['profileId'],
        }),
      };
    }

    class ProfilePictureTable extends Base {
      readonly table = 'profilePicture';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        profilePicKey: t.text(),
        profileId: t.integer().unique(),
        url: t.text(),
      }));
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        user: UserTable,
        profile: ProfileTable,
        profilePicture: ProfilePictureTable,
      },
    );

    expect(db.user.relations).toHaveProperty('profile');
    expect(db.user.relations).toHaveProperty('picture');
    expect(db.user.relations).toHaveProperty('requiredPicture');
  });

  it('should support hasAndBelongsToMany relation', async () => {
    const Base = createBaseTable({ snakeCase: true });

    class PostTable extends Base {
      readonly table = 'post';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        title: t.text(),
        body: t.text(),
      }));

      relations = {
        tags: this.hasAndBelongsToMany(() => TagTable, {
          columns: ['id'],
          references: ['post_id'],
          through: {
            table: 'postTag',
            columns: ['tag'],
            references: ['tag'],
          },
        }),
      };
    }

    class TagTable extends Base {
      readonly table = 'tag';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        tag: t.text().primaryKey(),
      }));
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter, schema: () => 'schema' },
      { post: PostTable, tag: TagTable },
    );

    const tag = { tag: 'tag' };
    const postId = await db.post.get('id').insert({
      title: 'title',
      body: 'body',
      tags: {
        create: [tag],
      },
    });

    const result = await db.post.find(postId).select({
      tags: (q) => q.tags,
    });

    assertType<typeof result, { tags: { tag: string }[] }>();

    expect(result).toEqual({ tags: [tag] });
  });

  it('should allow hasAndBelongsToMany relation to opt out of join table snake case', () => {
    const Base = createBaseTable({ snakeCase: true });

    class PostTable extends Base {
      readonly table = 'post';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));

      relations = {
        defaultTags: this.hasAndBelongsToMany(() => TagTable, {
          columns: ['id'],
          references: ['postId'],
          through: {
            table: 'postTag',
            columns: ['tagId'],
            references: ['id'],
          },
        }),
        tags: this.hasAndBelongsToMany(() => TagTable, {
          columns: ['id'],
          references: ['postId'],
          through: {
            table: 'postTag',
            columns: ['tagId'],
            references: ['id'],
            snakeCase: false,
          },
        }),
      };
    }

    class TagTable extends Base {
      readonly table = 'tag';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      { post: PostTable, tag: TagTable },
    );

    expectSql(
      db.post.select({ defaultTags: (q) => q.defaultTags }).toSQL(),
      `
        SELECT COALESCE("defaultTags"."defaultTags", '[]') "defaultTags"
        FROM "post"
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json(t.*)) "defaultTags"
          FROM (
            SELECT * FROM "tag" "defaultTags"
            WHERE EXISTS (
              SELECT 1 FROM "post_tag"
              WHERE "post_tag"."tag_id" = "defaultTags"."id"
                AND "post_tag"."post_id" = "post"."id"
            )
          ) "t"
        ) "defaultTags" ON true
      `,
    );

    expectSql(
      db.post.select({ tags: (q) => q.tags }).toSQL(),
      `
        SELECT COALESCE("tags"."tags", '[]') "tags"
        FROM "post"
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json(t.*)) "tags"
          FROM (
            SELECT * FROM "tag" "tags"
            WHERE EXISTS (
              SELECT 1 FROM "postTag"
              WHERE "postTag"."tag_id" = "tags"."id"
                AND "postTag"."post_id" = "post"."id"
            )
          ) "t"
        ) "tags" ON true
      `,
    );
  });

  it('should support soft delete', () => {
    const Base = createBaseTable({ snakeCase: true });

    class DefaultSoftDeleteTable extends Base {
      readonly table = 'defaultSoftDelete';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        deletedAt: t.timestamp().asDate().nullable(),
      }));

      readonly softDelete = true;
    }

    class CustomSoftDeleteTable extends Base {
      readonly table = 'customSoftDelete';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        archivedAt: t.timestamp().asDate().nullable(),
      }));

      readonly softDelete = 'archivedAt' as const;
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        defaultSoftDelete: DefaultSoftDeleteTable,
        customSoftDelete: CustomSoftDeleteTable,
      },
    );

    const defaultQuery = db.defaultSoftDelete.select('id', 'name', 'deletedAt');
    const customQuery = db.customSoftDelete.select('id', 'name', 'archivedAt');

    assertType<
      Awaited<typeof defaultQuery>,
      { id: number; name: string; deletedAt: Date | null }[]
    >();
    assertType<
      Awaited<typeof customQuery>,
      { id: number; name: string; archivedAt: Date | null }[]
    >();

    expectSql(
      db.defaultSoftDelete.select('id', 'name', 'deletedAt').toSQL(),
      `
        SELECT "defaultSoftDelete"."id", "defaultSoftDelete"."name", "defaultSoftDelete"."deleted_at"  "deletedAt"
        FROM "default_soft_delete" "defaultSoftDelete"
        WHERE ("defaultSoftDelete"."deleted_at" IS NULL)
      `,
    );
    expectSql(
      db.customSoftDelete.select('id', 'name', 'archivedAt').toSQL(),
      `
        SELECT "customSoftDelete"."id", "customSoftDelete"."name", "customSoftDelete"."archived_at"  "archivedAt"
        FROM "custom_soft_delete" "customSoftDelete"
        WHERE ("customSoftDelete"."archived_at" IS NULL)
      `,
    );

    expectSql(
      db.defaultSoftDelete.all().hardDelete().toSQL(),
      `
        DELETE FROM "default_soft_delete" "defaultSoftDelete"
      `,
    );
    expectSql(
      db.customSoftDelete.all().hardDelete().toSQL(),
      `
        DELETE FROM "custom_soft_delete" "customSoftDelete"
      `,
    );
  });

  it('should support computed column', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        firstName: t.text(),
        lastName: t.text(),
      }));

      computed = this.setComputed((q) => ({
        fullName: q.computeAtRuntime(
          ['firstName', 'lastName'],
          (record) => `${record.firstName} ${record.lastName}`,
        ),
      }));
    }

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    const query = db.table.get('fullName');

    expectSql(
      query.toSQL(),
      `
        SELECT "test"."firstName", "test"."lastName"
        FROM "test"
        LIMIT 1
      `,
    );
  });

  it('should support scopes', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        active: t.boolean(),
      }));

      scopes = this.setScopes({
        active: (q) => q.where({ active: true }),
      });
    }

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    const query = db.table.scope('active');

    assertType<Awaited<typeof query>, { id: number; active: boolean }[]>();

    expectSql(
      query.toSQL(),
      `
        SELECT *
        FROM "test"
        WHERE ("test"."active" = $1)
      `,
      [true],
    );
  });

  it('should support grants', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));

      grants = setGrants([
        {
          to: 'app_user',
          grantedBy: 'owner',
          privileges: ['SELECT'],
          grantablePrivileges: ['UPDATE'],
        },
      ]);
    }

    const grants = setGrants([
      {
        to: 'reporting_user',
        privileges: ['SELECT'],
      },
    ]);

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    expect(grants).toEqual([
      {
        to: 'reporting_user',
        privileges: ['SELECT'],
      },
    ]);
    expect(db.table.internal.tableGrants).toEqual([
      {
        to: 'app_user',
        grantedBy: 'owner',
        privileges: ['SELECT'],
        grantablePrivileges: ['UPDATE'],
      },
    ]);
    expect((db.table as unknown as { setGrants?: unknown }).setGrants).toBe(
      undefined,
    );
  });

  it('should pass grants through ORM setup to the query builder', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }

    const db = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        defaultGrantedBy: 'owner',
        grants: [
          {
            to: ['app_user', 'readonly'],
            grantedBy: 'admin',
            allTablesIn: ['public'],
            privileges: ['SELECT'],
          },
        ],
      },
      { table: Table },
    );

    expect(db.$qb.internal.grants).toEqual([
      {
        to: ['app_user', 'readonly'],
        grantedBy: 'admin',
        allTablesIn: ['public'],
        privileges: ['SELECT'],
      },
    ]);
    expect(db.$qb.internal.defaultGrantedBy).toBe('owner');
  });

  it('should preserve generatorIgnore on ORM internal', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }

    const db = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        generatorIgnore: {
          grants: {
            roles: ['external'],
          },
        },
      },
      { table: Table },
    );

    expect(db.$qb.internal.generatorIgnore).toEqual({
      grants: {
        roles: ['external'],
      },
    });
  });

  it('should preserve table generatorIgnore option on table internal', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      readonly generatorIgnore = true;
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    expect(db.table.internal.generatorIgnored).toBe(true);
  });

  it('should support RLS', () => {
    const Base = createBaseTable();
    class Table extends Base {
      readonly table = 'test';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));

      rls = defineRls({
        enable: true,
        force: true,
        permit: [
          {
            name: 'test_select',
            for: 'SELECT',
            to: 'app_user',
            using: sql`true`,
          },
        ],
      });
    }

    const db = orchidORMWithAdapter({ adapter: testAdapter }, { table: Table });

    expect(db.table.internal.tableRls).toEqual({
      enable: true,
      force: true,
      permit: [
        {
          name: 'test_select',
          for: 'SELECT',
          to: 'app_user',
          using: expect.any(Object),
        },
      ],
    });
  });

  it('should support init hook', async () => {
    const Base = createBaseTable();
    class UserTable extends Base {
      readonly table = 'user';
      schema: QuerySchema = () => 'schema';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));

      init() {
        this.beforeCreate(({ set }) => {
          set({ name: 'overridden' });
        });
      }
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      { user: UserTable },
    );

    const user = await db.user.create({ name: 'name', password: 'password' });
    expect(user.name).toBe('overridden');
  });

  it('should expose sql', () => {
    createBaseTable({ columnTypes: testColumnTypes });

    let t: unknown;
    sql``.type((arg) => {
      t = arg;
      return arg.text();
    });

    expect(t).toBe(testColumnTypes);
  });

  describe('nameInDb', () => {
    it('should resolve database relation names for tables', () => {
      const Base = createBaseTable({ snakeCase: true });

      class DefaultTable extends Base {
        readonly table = 'defaultName';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
      }

      class ExplicitTable extends Base {
        readonly table = 'Explicit';
        readonly nameInDb = 'custom_name';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
      }

      class SnakeTable extends Base {
        readonly table = 'SnakeName';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
      }

      class SameTable extends Base {
        readonly table = 'same_name';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        {
          defaultName: DefaultTable,
          explicit: ExplicitTable,
          snake: SnakeTable,
          same: SameTable,
        },
      );

      expect(db.defaultName.table).toBe('defaultName');
      expect(db.defaultName.q.nameInDb).toBe('default_name');
      expect(db.explicit.table).toBe('Explicit');
      expect(db.explicit.q.nameInDb).toBe('custom_name');
      expect(db.explicit.clone().q.nameInDb).toBe('custom_name');
      expect(db.snake.q.nameInDb).toBe('snake_name');
      expect(db.same.q.nameInDb).toBe('same_name');
    });

    it('should render database relation names with query-facing table aliases', () => {
      const Base = createBaseTable({ snakeCase: true });

      class UserTable extends Base {
        readonly table = 'User';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          name: t.text(),
        }));
      }

      class ProfileTable extends Base {
        readonly table = 'Profile';
        readonly nameInDb = 'profiles';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          userId: t.integer(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { user: UserTable, profile: ProfileTable },
      );

      expectSql(
        db.user.select('id').where({ name: 'name' }).toSQL(),
        `
          SELECT "User"."id" FROM "user" "User"
          WHERE "User"."name" = $1
        `,
        ['name'],
      );

      expectSql(
        db.user.as('u').select('u.id').toSQL(),
        `
          SELECT "u"."id" FROM "user" "u"
        `,
      );

      expectSql(
        db.user
          .join(db.profile, 'Profile.userId', 'User.id')
          .select('User.id', 'Profile.id')
          .toSQL(),
        `
          SELECT "User"."id", "Profile"."id"
          FROM "user" "User"
          JOIN "profiles" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
      );
    });

    it('should render schema-qualified and mutation SQL with database relation names', () => {
      const Base = createBaseTable({ snakeCase: true });

      class UserTable extends Base {
        readonly table = 'User';
        schema: QuerySchema = () => 'app';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          name: t.text(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { user: UserTable },
      );

      expectSql(
        db.user.select('id').toSQL(),
        `
          SELECT "User"."id" FROM "app"."user" "User"
        `,
      );

      expectSql(
        db.user.create({ name: 'name' }).toSQL(),
        `
          INSERT INTO "app"."user" AS "User"("name")
          VALUES ($1)
          RETURNING *
        `,
        ['name'],
      );

      expectSql(db.user.truncate().toSQL(), 'TRUNCATE "app"."user"');
    });
  });

  describe('snake case', () => {
    it('should preserve column names in SQL by default when no snakeCase option is passed', () => {
      const Base = createBaseTable();
      class Table extends Base {
        readonly table = 'test';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          camelCase: t.integer(),
          snakeCase: t.integer(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );

      expectSql(
        db.table.select('camelCase', 'snakeCase').toSQL(),
        `
          SELECT "test"."camelCase", "test"."snakeCase"
          FROM "test"
        `,
      );
    });

    it('should preserve t.name() column names in SQL', () => {
      const Base = createBaseTable();
      class Table extends Base {
        readonly table = 'test';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          customCol: t.name('custom_name').integer(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );

      expectSql(
        db.table.select('customCol').toSQL(),
        `
          SELECT "test"."custom_name" "customCol"
          FROM "test"
        `,
      );
    });

    it('should preserve timestamps without snake case by default', () => {
      const Base = createBaseTable();
      class Table extends Base {
        readonly table = 'test';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          ...t.timestamps(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );

      expectSql(
        db.table.select('createdAt', 'updatedAt').toSQL(),
        `
          SELECT "test"."createdAt", "test"."updatedAt"
          FROM "test"
        `,
      );
    });

    it('should snake case columns and timestamps when snakeCase is set to true on factory', () => {
      const Base = createBaseTable({ snakeCase: true });
      class Table extends Base {
        readonly table = 'test';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          camelCase: t.name('camelCase').integer(),
          snakeCase: t.integer(),
          ...t.timestamps(),
        }));
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        { table: Table },
      );

      expect(db.table.shape.camelCase.data.name).toBe('camelCase');
      expect(db.table.shape.snakeCase.data.name).toBe('snake_case');
      expect(db.table.shape.createdAt.data.name).toBe('created_at');
      expect(db.table.shape.updatedAt.data.name).toBe('updated_at');

      expectSql(
        db.table
          .select('camelCase', 'snakeCase', 'createdAt', 'updatedAt')
          .toSQL(),
        `
          SELECT
            "test"."camelCase",
            "test"."snake_case" "snakeCase",
            "test"."created_at" "createdAt",
            "test"."updated_at" "updatedAt"
          FROM "test"
        `,
      );
    });

    it('should set snake case name for computed columns when initializing the same table twice', () => {
      const Base = createBaseTable({ snakeCase: true });
      const { sql } = Base;
      let fullNameSql: RawSql | undefined;
      const getColumnName = (column: unknown) =>
        (column as { data: { name?: string } }).data.name;

      class Table extends Base {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          firstName: t.text(),
          lastName: t.text(),
        }));

        computed = this.setComputed((q) => ({
          fullName: (fullNameSql ??= sql<string>`${q.column(
            'firstName',
          )} || ' ' || ${q.column('lastName')}`),
        }));
      }

      const firstDb = orchidORMWithAdapter(
        { adapter: testAdapter },
        { user: Table },
      );
      const firstName = getColumnName(firstDb.user.shape.fullName);

      const secondDb = orchidORMWithAdapter(
        { adapter: testAdapter },
        { user: Table },
      );

      expect({
        firstName,
        secondName: getColumnName(secondDb.user.shape.fullName),
      }).toEqual({
        firstName: undefined,
        secondName: undefined,
      });
    });
  });

  it('should use child schema override when parent instance was created first', () => {
    const Base = createBaseTable();

    class ParentTable extends Base {
      schema: QuerySchema = () => 'tenant';
      readonly table = 'item';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }

    class ChildTable extends ParentTable {
      schema: QuerySchema = 'saas';
    }

    orchidORMWithAdapter({ adapter: testAdapter }, { parent: ParentTable });

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      { item: ChildTable },
    );

    expectSql(
      db.item.select('id').toSQL(),
      `
        SELECT "item"."id"
        FROM "saas"."item"
      `,
    );
  });

  describe('hooks', () => {
    it('should set hooks in the init', async () => {
      const fns = {
        beforeQuery: jest.fn(),
        afterQuery: jest.fn(),
        beforeCreate: jest.fn(),
        afterCreate: jest.fn(),
        afterCreateCommit: jest.fn(),
        beforeUpdate: jest.fn(),
        afterUpdate: jest.fn(),
        afterUpdateCommit: jest.fn(),
        beforeDelete: jest.fn(),
        afterDelete: jest.fn(),
        afterDeleteCommit: jest.fn(),
        beforeSave: jest.fn(),
        afterSave: jest.fn(),
        afterSaveCommit: jest.fn(),
      };

      let initArg: unknown | undefined;

      const Base = createBaseTable();
      class Table extends Base {
        readonly table = 'table';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          one: t.text(),
          two: t.text(),
          three: t.text(),
          four: t.text(),
          five: t.text(),
          six: t.text(),
          seven: t.text(),
          eight: t.text(),
        }));

        init(orm: typeof db) {
          this.beforeQuery(fns.beforeQuery);
          this.beforeCreate(fns.beforeCreate);
          this.beforeUpdate(fns.beforeUpdate);
          this.beforeDelete(fns.beforeDelete);
          this.beforeSave(fns.beforeSave);
          this.afterQuery(fns.afterQuery);
          this.afterCreate(['one'], fns.afterCreate);
          this.afterCreateCommit(['two'], fns.afterCreateCommit);
          this.afterUpdate(['three'], fns.afterUpdate);
          this.afterUpdateCommit(['four'], fns.afterUpdateCommit);
          this.afterDelete(['five'], fns.afterDelete);
          this.afterDeleteCommit(['six'], fns.afterDeleteCommit);
          this.afterSave(['seven'], fns.afterSave);
          this.afterSaveCommit(['eight'], fns.afterSaveCommit);

          initArg = orm;
        }
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        {
          table: Table,
        },
      );

      expect(initArg).toBe(db);

      expect(db.table.baseQuery.q).toMatchObject({
        before: [fns.beforeQuery],
        after: [fns.afterQuery],
        // wraps callbacks
        beforeCreate: [expect.any(Function), expect.any(Function)],
        afterCreate: [fns.afterCreate],
        afterCreateCommit: [fns.afterCreateCommit],
        afterCreateSelect: new Set(['one', 'two', 'seven', 'eight']),
        // wraps callbacks
        beforeUpdate: [expect.any(Function), expect.any(Function)],
        afterUpdate: [fns.afterUpdate],
        afterUpdateCommit: [fns.afterUpdateCommit],
        afterUpdateSelect: new Set(['three', 'four', 'seven', 'eight']),
        afterSave: [fns.afterSave],
        afterSaveCommit: [fns.afterSaveCommit],
        beforeDelete: [fns.beforeDelete],
        afterDelete: [fns.afterDelete],
        afterDeleteCommit: [fns.afterDeleteCommit],
        afterDeleteSelect: new Set(['five', 'six']),
      });

      const { q } = db.table.baseQuery;
      const query = { q: { updateData: [] } } as never;

      q.beforeCreate?.[0](query);
      expect(fns.beforeCreate).toHaveBeenCalledTimes(1);

      q.beforeUpdate?.[0](query);
      expect(fns.beforeUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('schemaConfig', () => {
    const Base = createBaseTable({
      schemaConfig: zodSchemaConfig,
    });

    class SomeTable extends Base {
      readonly table = 'some';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));

      relations = {
        some: this.belongsTo(() => OtherTable, {
          columns: ['id'],
          references: ['someId'],
        }),
      };
    }

    class OtherTable extends Base {
      readonly table = 'some';
      columns = this.setColumns((t) => ({
        someId: t.integer().primaryKey(),
      }));
    }

    // need to instantiate tables so that the relations add special virtual columns
    orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        some: SomeTable,
        other: OtherTable,
      },
    );

    it('should expose inputSchema, outputSchema, querySchema, updateSchema, pkeySchema', () => {
      const inputSchema = SomeTable.inputSchema();
      const outputSchema = SomeTable.outputSchema();
      const querySchema = SomeTable.querySchema();
      const createSchema = SomeTable.createSchema();
      const updateSchema = SomeTable.updateSchema();
      const pkeySchema = SomeTable.pkeySchema();

      const expected = z.object({ id: z.number(), name: z.string() });
      assertType<typeof inputSchema, typeof expected>();
      assertType<typeof outputSchema, typeof expected>();

      const expectedQuery = z
        .object({ id: z.number(), name: z.string() })
        .partial();
      assertType<typeof querySchema, typeof expectedQuery>();

      const expectedCreate = expected.omit({ id: true });
      assertType<typeof createSchema, typeof expectedCreate>();

      const expectedUpdate = expectedCreate.partial();
      assertType<typeof updateSchema, typeof expectedUpdate>();

      const expectedPKeys = expected.pick({ id: true });
      assertType<typeof pkeySchema, typeof expectedPKeys>();

      const data = { id: 1, name: 'name' };
      for (const schema of [
        inputSchema,
        outputSchema,
        querySchema,
        createSchema,
        updateSchema,
        pkeySchema,
      ]) {
        expect(() => schema.parse(data)).not.toThrow();
      }
    });

    it('should be memoized', () => {
      const inputSchema = SomeTable.inputSchema();
      const outputSchema = SomeTable.outputSchema();
      const querySchema = SomeTable.querySchema();
      const inputSchema2 = SomeTable.inputSchema();
      const outputSchema2 = SomeTable.outputSchema();
      const querySchema2 = SomeTable.querySchema();

      expect(inputSchema2).toBe(inputSchema);
      expect(outputSchema2).toBe(outputSchema);
      expect(querySchema2).toBe(querySchema);
    });
  });

  describe('inheritance', () => {
    it('should create a separate cached instance for a subclass when parent was instantiated first', () => {
      const BaseTable = createBaseTable();

      class ParentTable extends BaseTable {
        schema: QuerySchema = () => 'tenant';
        readonly table = 'item';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
      }

      class ChildTable extends ParentTable {
        schema: QuerySchema = 'saas';
      }

      const parent = ParentTable.instance();
      const child = ChildTable.instance();

      expect(parent).toBeInstanceOf(ParentTable);
      expect(child).toBeInstanceOf(ChildTable);
      expect(child).not.toBe(parent);
      expect(child.schema).toBe('saas');
    });
  });
});
