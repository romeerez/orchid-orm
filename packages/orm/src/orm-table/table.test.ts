import {
  assertType,
  asMock,
  expectSql,
  testAdapter,
  testColumnTypes,
  testOrchidORMWithAdapter,
  useTestDatabase,
  zodSchemaConfig,
} from 'test-utils';
import {
  DefaultSelect,
  Insertable,
  Queryable,
  Selectable,
  Updatable,
} from './legacy-table';
import { createTableFactory } from './table';
import { z } from 'zod/v4';
import { bundleOrchidORM, makeOrchidOrmDbWithAdapter } from '../orm';
import { Expression, Query, QueryHelperResult } from 'pqb';
import {
  Column,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  getCallerFilePath,
  raw,
  RecordUnknown,
  RawSql,
} from 'pqb/internal';

type UniqueQueryTypeOrExpression<T> =
  | T
  | Expression<Column.Pick.QueryColumnOfType<T>>;
type UniqueNumber = UniqueQueryTypeOrExpression<number>;
type UniqueString = UniqueQueryTypeOrExpression<string>;

describe('table', () => {
  useTestDatabase();

  describe('createTableFactory', () => {
    it('should support getFilePath to return a path where the defineTable is defined', () => {
      asMock(getCallerFilePath).mockReturnValueOnce('path');

      const { defineTable } = createTableFactory();
      expect(defineTable.getFilePath()).toBe('path');
    });

    it('should throw if cannot determine file path and calling `getFilePath`', () => {
      asMock(getCallerFilePath).mockReturnValueOnce(undefined);

      const { defineTable } = createTableFactory();
      expect(() => defineTable.getFilePath()).toThrow(
        'Failed to determine file path',
      );
    });

    it('should use filePath option when provided', () => {
      const { defineTable } = createTableFactory({
        filePath: '/custom/path.ts',
      });
      expect(defineTable.getFilePath()).toBe('/custom/path.ts');
    });

    it('should set the default language to the table query', () => {
      const { defineTable } = createTableFactory({ language: 'Ukrainian' });
      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
      }));

      const db = testOrchidORMWithAdapter({ table: TestTable });

      expect(db.table.q.language).toBe('Ukrainian');
    });

    it('should produce custom SQL for timestamps when updating', () => {
      const nowSQL = `now() AT TIME ZONE 'UTC'`;
      const { defineTable } = createTableFactory({ nowSQL, snakeCase: true });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
        ...t.timestamps(),
      }));

      const db = testOrchidORMWithAdapter({ user: UserTable });

      expect(db.user.internal.nowSQL).toBe(nowSQL);

      expectSql(
        db.user.find(1).update({}).toSQL(),
        `
          UPDATE "user" SET "updated_at" = now() AT TIME ZONE 'UTC' WHERE "user"."id" = $1
        `,
        [1],
      );
    });

    it('should preserve columnTypes type on a table', () => {
      const { defineTable } = createTableFactory();
      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
      }));

      const db = testOrchidORMWithAdapter({ table: TestTable });
      assertType<
        typeof db.table.columnTypes,
        DefaultColumnTypes<DefaultSchemaConfig>
      >();
    });

    it('should have default exportAs on factory and table definitions', () => {
      const { defineTable, exportAs } = createTableFactory();
      expect(exportAs).toBe('defineTable');

      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
      }));
      expect(TestTable.exportAs).toBe('defineTable');
    });

    it('should allow custom defineTableExportAs on factory and table definitions', () => {
      const { defineTable, exportAs } = createTableFactory({
        defineTableExportAs: 'myDefineTable',
      });
      expect(exportAs).toBe('myDefineTable');

      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
      }));
      expect(TestTable.exportAs).toBe('myDefineTable');
    });

    it('should expose rake-db metadata on defineTable', () => {
      const nowSQL = `now() AT TIME ZONE 'UTC'`;
      const { defineTable } = createTableFactory({
        columnTypes: testColumnTypes,
        defineTableExportAs: 'myDefineTable',
        filePath: '/custom/path.ts',
        language: 'Ukrainian',
        nowSQL,
        snakeCase: true,
      });

      expect(defineTable.types).toBe(testColumnTypes);
      expect(defineTable.exportAs).toBe('myDefineTable');
      expect(defineTable.nowSQL).toBe(nowSQL);
      expect(defineTable.getFilePath()).toBe('/custom/path.ts');
      expect(defineTable.snakeCase).toBe(true);
      expect(defineTable.language).toBe('Ukrainian');
    });
  });

  describe('table options', () => {
    it('should support `schema` option', () => {
      const { defineTable } = createTableFactory();
      const TestTable = defineTable(
        'test',
        { schema: () => 'schema' },
        (t) => ({
          id: t.identity().primaryKey(),
          name: t.text(),
        }),
      );

      const db = testOrchidORMWithAdapter({ table: TestTable });

      expectSql(
        db.table.toSQL(),
        `
          SELECT *
          FROM "schema"."test"
        `,
      );
    });

    it('should support `noPrimaryKey` option to allow tables without a primary key', () => {
      const { defineTable } = createTableFactory();
      const TestTable = defineTable('test', { noPrimaryKey: true }, (t) => ({
        name: t.text(),
      }));

      const db = testOrchidORMWithAdapter({ table: TestTable });

      expect(db.table.table).toBe('test');
    });

    it('should warn when table has no primary key and noPrimaryKey is not set', () => {
      const { defineTable } = createTableFactory();

      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const TestTable = defineTable('test', (t) => ({
        name: t.text(),
      }));

      testOrchidORMWithAdapter({ table: TestTable });

      expect(spy).toHaveBeenCalledWith('Table test has no primary key');

      spy.mockRestore();
    });
  });

  it('should support defining a basic table', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
    }));

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expectSql(
      db.table.select('id', 'name').toSQL(),
      `
        SELECT "test"."id", "test"."name"
        FROM "test"
      `,
    );
  });

  it('should support tables being used via bundleOrchidORM to have makeHelper', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
    }));
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
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
    }));

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

  it('should support table type helpers', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.uuid().primaryKey(),
      visible: t.text().parse(() => true),
      hidden: t.text().select(false),
      optional: t.text().default('text'),
      required: t.boolean(),
    }));

    const db = testOrchidORMWithAdapter({ table: TestTable });

    assertType<
      Queryable<typeof TestTable>,
      {
        id?: string;
        visible?: string;
        hidden?: string;
        optional?: string;
        required?: boolean;
      }
    >();
    assertType<
      DefaultSelect<typeof TestTable>,
      { id: string; visible: boolean; optional: string; required: boolean }
    >();
    assertType<
      Selectable<typeof TestTable>,
      {
        id: string;
        visible: boolean;
        hidden: string;
        optional: string;
        required: boolean;
      }
    >();
    assertType<
      Insertable<typeof TestTable>,
      {
        id?: string;
        visible: string;
        hidden: string;
        optional?: string;
        required: boolean;
      }
    >();
    assertType<
      Updatable<typeof TestTable>,
      {
        id?: string;
        visible?: string;
        hidden?: string;
        optional?: string;
        required?: boolean;
      }
    >();
    expect(db.table.table).toBe('test');
  });

  it('should support validation schema methods on table definitions', () => {
    const { defineTable } = createTableFactory({
      schemaConfig: zodSchemaConfig,
    });
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
    }));

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
    const { defineTable } = createTableFactory({ snakeCase: true });
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));
    const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      userId: t.integer().nullable(),
    })).relations((main) => ({
      user: main('userId').belongsTo(() => UserTable('id')),
      requiredUser: main('userId')
        .belongsTo(() => UserTable('id'))
        .required(),
    }));

    const db = testOrchidORMWithAdapter({
      profile: ProfileTable,
      user: UserTable,
    });

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
    const { defineTable } = createTableFactory({ snakeCase: true });
    const CategoryTable = defineTable(
      'category',
      { schema: 'schema' },
      (t) => ({
        categoryName: t.text().primaryKey(),
        parentName: t.text().nullable(),
      }),
    ).relations((category) => ({
      category: category('parentName').belongsTo(() =>
        CategoryTable('categoryName'),
      ),
    }));

    const db = testOrchidORMWithAdapter({ category: CategoryTable });
    await db.category.createMany([
      { categoryName: 'parent' },
      { categoryName: 'child', parentName: 'parent' },
    ]);

    const result = await db.category.find('child').select({
      parent: (q) => q.category,
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
    const { defineTable } = createTableFactory({ snakeCase: true });
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    })).relations((user) => ({
      profile: user('id').hasOne(() => ProfileTable('userId')),
      requiredProfile: user('id')
        .hasOne(() => ProfileTable('userId'))
        .required(),
    }));

    const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      userId: t.integer().nullable(),
      bio: t.text().nullable(),
    }));

    const db = testOrchidORMWithAdapter({
      user: UserTable,
      profile: ProfileTable,
    });

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

  it('should support hasMany relation', async () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    })).relations((user) => ({
      posts: user('id').hasMany(() => PostTable('userId')),
      tags: user.hasMany(() => TagTable.through('posts', 'tags')),
      filteredTagsBefore: user.hasMany(() =>
        TagTable.where({ tag: 'tag' }).through('posts', 'tags'),
      ),
      filteredTagsAfter: user.hasMany(() =>
        TagTable.through('posts', 'tags').where({ tag: 'tag' }),
      ),
    }));
    const PostTable = defineTable('post', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      userId: t.integer().nullable(),
      title: t.text(),
      body: t.text(),
    })).relations((main) => ({
      postTags: main('id').hasMany(() => PostTagTable('postId')),
      tags: main.hasMany(() => TagTable.through('postTags', 'tagRecord')),
    }));
    const TagTable = defineTable('tag', { schema: 'schema' }, (t) => ({
      tag: t.text().primaryKey(),
    }));
    const PostTagTable = defineTable('postTag', { schema: 'schema' }, (t) => ({
      postId: t.integer(),
      tag: t.text(),
    }))
      .primaryKey(['postId', 'tag'])
      .relations((postTag) => ({
        tagRecord: postTag('tag').belongsTo(() => TagTable('tag')),
      }));

    const db = testOrchidORMWithAdapter({
      user: UserTable,
      post: PostTable,
      postTag: PostTagTable,
      tag: TagTable,
    });

    const post = { title: 'title', body: 'body' };
    const tag = { tag: 'tag' };
    const otherTag = { tag: 'other' };
    await db.tag.insert(tag);
    await db.tag.insert(otherTag);
    const userId = await db.user.get('id').create({
      name: 'name',
      password: 'password',
      posts: {
        create: [
          {
            ...post,
            postTags: {
              create: [tag],
            },
          },
        ],
      },
    });
    const postId = await db.post
      .where({
        userId,
        title: 'title',
      })
      .get('id');
    await db.postTag.create({ postId, tag: otherTag.tag });

    const result = await db.user.find(userId).select({
      posts: (q) => q.posts,
      tags: (q) => q.tags,
      filteredTagsBefore: (q) => q.filteredTagsBefore,
      filteredTagsAfter: (q) => q.filteredTagsAfter,
    });

    assertType<
      typeof result,
      {
        posts: {
          id: number;
          userId: number | null;
          title: string;
          body: string;
        }[];
        tags: { tag: string }[];
        filteredTagsBefore: { tag: string }[];
        filteredTagsAfter: { tag: string }[];
      }
    >();

    expect(result).toMatchObject({
      posts: [post],
      tags: [tag, otherTag],
      filteredTagsBefore: [tag],
      filteredTagsAfter: [tag],
    });
  });

  it('should type hasMany through recursive relations', () => {
    const { defineTable } = createTableFactory({});

    const PostTable = defineTable('post', (t) => ({
      Id: t.identity().primaryKey(),
    })).relations((post) => ({
      postTags: post('Id').hasMany(() => PostTagTable('PostId')),
      tags: post.hasMany(() => TagTable.through('postTags', 'tag')),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.identity().primaryKey(),
    })).relations((tag) => ({
      postTags: tag('Id').hasMany(() => PostTagTable('TagId')),
      posts: tag.hasMany(() => PostTable.through('postTags', 'post')),
    }));

    const PostTagTable = defineTable('postTag', (t) => ({
      PostId: t
        .name('postId')
        .integer()
        .foreignKey(() => PostTable, 'Id'),
      TagId: t
        .name('tagId')
        .integer()
        .foreignKey(() => TagTable, 'Id'),
    }))
      .primaryKey(['PostId', 'TagId'])
      .relations((postTag) => ({
        post: postTag('PostId').belongsTo(() => PostTable('Id')),
        tag: postTag('TagId').belongsTo(() => TagTable('Id')),
      }));

    void PostTable;
    void TagTable;
    void PostTagTable;
  });

  it('should support hasOne through relation', async () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    })).relations((user) => ({
      profile: user('id').hasOne(() => ProfileTable('userId')),
      picture: user.hasOne(() => ProfilePictureTable.through('profile', 'pic')),
      activePicture: user.hasOne(() =>
        ProfilePictureTable.where({ url: 'url' }).through('profile', 'pic'),
      ),
      requiredPicture: user
        .hasOne(() =>
          ProfilePictureTable.through('profile', 'activePic').where({
            url: 'url',
          }),
        )
        .required(),
    }));
    const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      userId: t.integer().unique(),
      bio: t.text().nullable(),
    })).relations((profile) => ({
      pic: profile('id').hasOne(() => ProfilePictureTable('profileId')),
      activePic: profile('id').hasOne(() =>
        ProfilePictureTable('profileId').where({ url: 'url' }),
      ),
    }));
    const ProfilePictureTable = defineTable(
      'profilePicture',
      { schema: 'schema', nameInDb: 'profilePic' },
      (t) => ({
        id: t.identity().primaryKey(),
        profilePicKey: t.text(),
        profileId: t.integer().unique(),
        url: t.text(),
      }),
    );

    const db = testOrchidORMWithAdapter({
      user: UserTable,
      profile: ProfileTable,
      profilePicture: ProfilePictureTable,
    });

    const userId = await db.user.get('id').insert({
      name: 'name',
      password: 'password',
    });
    const profileId = await db.profile.get('id').insert({
      userId,
      bio: 'bio',
    });
    const picture = await db.profilePicture.create({
      profilePicKey: 'key',
      profileId,
      url: 'url',
    });

    const optional = await db.user.find(userId).select({
      picture: (q) => q.picture,
      activePicture: (q) => q.activePicture,
    });
    const required = await db.user.find(userId).select({
      requiredPicture: (q) => q.requiredPicture,
    });

    assertType<
      typeof optional,
      {
        picture:
          | {
              id: number;
              profilePicKey: string;
              profileId: number;
              url: string;
            }
          | undefined;
        activePicture:
          | {
              id: number;
              profilePicKey: string;
              profileId: number;
              url: string;
            }
          | undefined;
      }
    >();
    assertType<
      typeof required,
      {
        requiredPicture: {
          id: number;
          profilePicKey: string;
          profileId: number;
          url: string;
        };
      }
    >();

    expect(optional).toMatchObject({
      picture,
      activePicture: picture,
    });
    expect(required).toMatchObject({ requiredPicture: picture });
  });

  it('should type hasOne through recursive relations', () => {
    const { defineTable } = createTableFactory({});

    const PostTable = defineTable('post', (t) => ({
      Id: t.identity().primaryKey(),
    })).relations((post) => ({
      postTag: post('Id').hasOne(() => PostTagTable('PostId')),
      tag: post.hasOne(() => TagTable.through('postTag', 'tag')),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.identity().primaryKey(),
    })).relations((tag) => ({
      postTag: tag('Id').hasOne(() => PostTagTable('TagId')),
      post: tag.hasOne(() => PostTable.through('postTag', 'post')),
    }));

    const PostTagTable = defineTable('postTag', (t) => ({
      PostId: t
        .name('postId')
        .integer()
        .foreignKey(() => PostTable, 'Id'),
      TagId: t
        .name('tagId')
        .integer()
        .foreignKey(() => TagTable, 'Id'),
    }))
      .primaryKey(['PostId', 'TagId'])
      .relations((postTag) => ({
        post: postTag('PostId').belongsTo(() => PostTable('Id')),
        tag: postTag('TagId').belongsTo(() => TagTable('Id')),
      }));

    void PostTable;
    void TagTable;
    void PostTagTable;
  });

  it('should support hasAndBelongsToMany relation', async () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const PostTable = defineTable('post', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      title: t.text(),
      body: t.text(),
    })).relations((main) => ({
      tags: main('id')
        .hasAndBelongsToMany(() => TagTable('tag'))
        .through('postTag', 'postId', 'tag'),
    }));
    const TagTable = defineTable('tag', { schema: 'schema' }, (t) => ({
      tag: t.text().primaryKey(),
    }));

    const db = testOrchidORMWithAdapter(
      { adapter: testAdapter, schema: () => 'schema' },
      {
        post: PostTable,
        tag: TagTable,
      },
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
    const { defineTable } = createTableFactory({ snakeCase: true });
    const PostTable = defineTable('post', (t) => ({
      id: t.identity().primaryKey(),
    })).relations((post) => ({
      defaultTags: post('id')
        .hasAndBelongsToMany(() => TagTable('id'))
        .through('postTag', 'postId', 'tagId'),
      tags: post('id')
        .hasAndBelongsToMany(() => TagTable('id'))
        .through('postTag', 'postId', 'tagId', {
          joinTableSnakeCase: false,
        }),
    }));
    const TagTable = defineTable('tag', (t) => ({
      id: t.identity().primaryKey(),
    }));

    const db = testOrchidORMWithAdapter({
      post: PostTable,
      tag: TagTable,
    });

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

  it('should support schema-qualified hasAndBelongsToMany join table names', () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const PostTable = defineTable('post', (t) => ({
      id: t.identity().primaryKey(),
    })).relations((post) => ({
      defaultTags: post('id')
        .hasAndBelongsToMany(() => TagTable('id'))
        .through('joinSchema.postTag', 'postId', 'tagId'),
      tags: post('id')
        .hasAndBelongsToMany(() => TagTable('id'))
        .through('joinSchema.postTag', 'postId', 'tagId', {
          joinTableSnakeCase: false,
        }),
    }));
    const TagTable = defineTable('tag', (t) => ({
      id: t.identity().primaryKey(),
    }));

    const db = testOrchidORMWithAdapter({
      post: PostTable,
      tag: TagTable,
    });

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
              SELECT 1 FROM "joinSchema"."post_tag"
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
              SELECT 1 FROM "joinSchema"."postTag"
              WHERE "postTag"."tag_id" = "tags"."id"
                AND "postTag"."post_id" = "post"."id"
            )
          ) "t"
        ) "tags" ON true
      `,
    );
  });

  it('should support schema option for hasAndBelongsToMany join table names', () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const PostTable = defineTable('post', (t) => ({
      id: t.identity().primaryKey(),
    })).relations((post) => ({
      tags: post('id')
        .hasAndBelongsToMany(() => TagTable('id'))
        .through('postTag', 'postId', 'tagId', {
          schema: () => 'joinSchema',
        }),
    }));
    const TagTable = defineTable('tag', (t) => ({
      id: t.identity().primaryKey(),
    }));

    const db = testOrchidORMWithAdapter({
      post: PostTable,
      tag: TagTable,
    });

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
              SELECT 1 FROM "joinSchema"."post_tag"
              WHERE "post_tag"."tag_id" = "tags"."id"
                AND "post_tag"."post_id" = "post"."id"
            )
          ) "t"
        ) "tags" ON true
      `,
    );
  });

  it('should support composite primary key', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      tenantId: t.integer(),
      id: t.integer(),
      name: t.text(),
    })).primaryKey(['tenantId', 'id']);

    const db = testOrchidORMWithAdapter({ table: TestTable });

    assertType<
      typeof db.table.internal.uniqueColumns,
      { tenantId: UniqueNumber; id: UniqueNumber }
    >();

    assertType<
      typeof db.table.internal.uniqueColumnTuples,
      ['tenantId', 'id']
    >();

    expect(db.table.internal.tableData.primaryKey).toEqual({
      columns: ['tenantId', 'id'],
    });
  });

  it('should save `tableData` to the table query builder `internal`', () => {
    const checkSql = raw({ raw: 'one > 5' });
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('table', (t) => ({
      id: t.identity().primaryKey(),
      name: t.string(),
    }))
      .primaryKey(['id', 'name'])
      .index(['id', 'name'])
      .check(checkSql, 'constraintName');

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.tableData).toMatchObject({
      primaryKey: { columns: ['id', 'name'] },
      indexes: [
        { columns: [{ column: 'id' }, { column: 'name' }], options: {} },
      ],
      constraints: [{ name: 'constraintName', check: checkSql }],
    });
  });

  it('should support composite index', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      tenantId: t.integer(),
      id: t.integer(),
      name: t.text(),
    })).index(['tenantId', 'name']);

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.tableData.indexes).toEqual([
      {
        columns: [{ column: 'tenantId' }, { column: 'name' }],
        options: {},
      },
    ]);
  });

  it('should support composite search index', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.integer(),
      title: t.text(),
      body: t.text(),
    })).searchIndex(['title', 'body']);

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.tableData.indexes).toEqual([
      {
        columns: [{ column: 'title' }, { column: 'body' }],
        options: { tsVector: true, using: 'gin' },
      },
    ]);
  });

  it('should support composite unique', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      tenantId: t.integer(),
      id: t.integer(),
      email: t.text(),
    })).unique(['tenantId', 'email']);

    const db = testOrchidORMWithAdapter({ table: TestTable });

    assertType<
      typeof db.table.internal.uniqueColumns,
      { tenantId: UniqueNumber; email: UniqueString }
    >();

    assertType<
      typeof db.table.internal.uniqueColumnTuples,
      ['tenantId', 'email']
    >();

    expect(db.table.internal.tableData.indexes).toEqual([
      {
        columns: [{ column: 'tenantId' }, { column: 'email' }],
        options: { unique: true },
      },
    ]);
  });

  it('should support composite exclude', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.integer(),
      roomId: t.integer(),
      timeRange: t.type('tstzrange').as(t.text()),
    })).exclude([
      { column: 'roomId', with: '=' },
      { column: 'timeRange', with: '&&' },
    ]);

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.tableData.excludes).toEqual([
      {
        columns: [
          { column: 'roomId', with: '=' },
          { column: 'timeRange', with: '&&' },
        ],
        options: {},
      },
    ]);
  });

  it('should support table check', () => {
    const { defineTable, sql } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.integer(),
      startAt: t.timestamp().asDate(),
      endAt: t.timestamp().asDate(),
    })).check(sql`"startAt" < "endAt"`);

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.tableData.constraints).toEqual([
      {
        check: sql`"startAt" < "endAt"`,
      },
    ]);
  });

  it('should support composite foreign key', () => {
    const { defineTable } = createTableFactory();
    const RelatedTable = defineTable('related', (t) => ({
      tenantId: t.integer(),
      id: t.integer(),
      name: t.text(),
    }));
    const relatedTable = () => RelatedTable;
    const TestTable = defineTable('test', (t) => ({
      tenantId: t.integer(),
      orgId: t.integer(),
      title: t.text(),
    })).foreignKey(['tenantId', 'orgId'], relatedTable, ['tenantId', 'id']);

    const db = testOrchidORMWithAdapter({
      table: TestTable,
      relatedTable: RelatedTable,
    });

    expect(db.table.internal.tableData.constraints).toEqual([
      {
        references: {
          columns: ['tenantId', 'orgId'],
          fnOrTable: relatedTable,
          foreignColumns: ['tenantId', 'id'],
          options: undefined,
        },
      },
    ]);
  });

  it('should support soft delete', () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const DefaultSoftDeleteTable = defineTable('defaultSoftDelete', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      deletedAt: t.timestamp().asDate().nullable(),
    })).softDelete();
    const CustomSoftDeleteTable = defineTable('customSoftDelete', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      archivedAt: t.timestamp().asDate().nullable(),
    })).softDelete('archivedAt');

    const db = testOrchidORMWithAdapter({
      defaultSoftDelete: DefaultSoftDeleteTable,
      customSoftDelete: CustomSoftDeleteTable,
    });

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
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      firstName: t.text(),
      lastName: t.text(),
    })).computed((q) => ({
      fullName: q.computeAtRuntime(
        ['firstName', 'lastName'],
        (record) => `${record.firstName} ${record.lastName}`,
      ),
    }));

    const db = testOrchidORMWithAdapter({ table: TestTable });

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
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      active: t.boolean(),
    })).scopes({
      active: (q) => q.where({ active: true }),
    });

    const db = testOrchidORMWithAdapter({ table: TestTable });

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
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
    })).grants([
      {
        to: 'app_user',
        grantedBy: 'owner',
        privileges: ['SELECT'],
        grantablePrivileges: ['UPDATE'],
      },
    ]);

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.tableGrants).toEqual([
      {
        to: 'app_user',
        grantedBy: 'owner',
        privileges: ['SELECT'],
        grantablePrivileges: ['UPDATE'],
      },
    ]);
    expect((db.table as unknown as { grants?: unknown }).grants).toBe(
      undefined,
    );
  });

  it('should pass grants through ORM setup to the query builder', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
    }));

    const db = testOrchidORMWithAdapter(
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
      { table: TestTable },
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
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
    }));

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        generatorIgnore: {
          grants: {
            roles: ['external'],
          },
        },
      },
      { table: TestTable },
    );

    expect(db.$qb.internal.generatorIgnore).toEqual({
      grants: {
        roles: ['external'],
      },
    });
  });

  it('should preserve table generatorIgnore option on table internal', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', { generatorIgnore: true }, (t) => ({
      id: t.identity().primaryKey(),
    }));

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.generatorIgnored).toBe(true);
  });

  it('should support RLS', () => {
    const { defineTable } = createTableFactory();
    const TestTable = defineTable('test', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
    })).rls({ enable: true, force: true, permit: [], restrict: [] });

    const db = testOrchidORMWithAdapter({ table: TestTable });

    expect(db.table.internal.tableRls).toEqual({
      enable: true,
      force: true,
      permit: [],
      restrict: [],
    });
  });

  it('should support init hook', async () => {
    const { defineTable } = createTableFactory();
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    })).init((_orm, hooks) => {
      hooks.beforeCreate(({ set }) => {
        set({ name: 'overridden' });
      });
    });

    const db = testOrchidORMWithAdapter({ user: UserTable });

    const user = await db.user.create({ name: 'name', password: 'password' });
    expect(user.name).toBe('overridden');
  });

  it('should expose sql', () => {
    const { sql } = createTableFactory({
      columnTypes: testColumnTypes,
    });

    let t: unknown;
    sql``.type((arg) => {
      t = arg;
      return arg.text();
    });

    expect(t).toBe(testColumnTypes);
  });

  describe('nameInDb', () => {
    it('should resolve database relation names for tables', () => {
      const { defineTable } = createTableFactory({ snakeCase: true });

      const DefaultTable = defineTable('defaultName', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const ExplicitTable = defineTable(
        'Explicit',
        { nameInDb: 'custom_name' },
        (t) => ({
          id: t.identity().primaryKey(),
        }),
      );
      const SnakeTable = defineTable('SnakeName', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const SameTable = defineTable('same_name', (t) => ({
        id: t.identity().primaryKey(),
      }));

      const db = testOrchidORMWithAdapter({
        defaultName: DefaultTable,
        explicit: ExplicitTable,
        snake: SnakeTable,
        same: SameTable,
      });

      expect(db.defaultName.table).toBe('defaultName');
      expect(db.defaultName.q.nameInDb).toBe('default_name');
      expect(db.explicit.table).toBe('Explicit');
      expect(db.explicit.q.nameInDb).toBe('custom_name');
      expect(db.explicit.clone().q.nameInDb).toBe('custom_name');
      expect(db.snake.q.nameInDb).toBe('snake_name');
      expect(db.same.q.nameInDb).toBe('same_name');
    });

    it('should render database relation names with query-facing table aliases', () => {
      const { defineTable } = createTableFactory({ snakeCase: true });

      const UserTable = defineTable('User', (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));
      const ProfileTable = defineTable(
        'Profile',
        { nameInDb: 'profiles' },
        (t) => ({
          id: t.identity().primaryKey(),
          userId: t.integer(),
        }),
      );

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

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
      const { defineTable } = createTableFactory({ snakeCase: true });

      const UserTable = defineTable('User', { schema: 'app' }, (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));

      const db = testOrchidORMWithAdapter({ user: UserTable });

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

  describe('relation foreignKey', () => {
    it('should create foreign key constraint with foreignKey() on belongsTo', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const ProfileTable = defineTable('profile', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      })).relations((profile) => ({
        user: profile('userId')
          .belongsTo(() => UserTable('id'))
          .foreignKey(),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

      expect(db.profile.internal.tableData.constraints).toEqual([
        {
          references: {
            columns: ['userId'],
            fnOrTable: 'user',
            foreignColumns: ['id'],
            options: { onUpdate: 'CASCADE' },
          },
        },
      ]);
    });

    it('should not create foreign key constraint with foreignKey(false)', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const ProfileTable = defineTable('profile', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      })).relations((profile) => ({
        user: profile('userId')
          .belongsTo(() => UserTable('id'))
          .foreignKey(false),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

      expect(db.profile.internal.tableData.constraints).toBeUndefined();
    });

    it('should create foreign key constraint with custom options', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const ProfileTable = defineTable('profile', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      })).relations((profile) => ({
        user: profile('userId')
          .belongsTo(() => UserTable('id'))
          .foreignKey({ onDelete: 'CASCADE' }),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

      expect(db.profile.internal.tableData.constraints).toEqual([
        {
          references: {
            columns: ['userId'],
            fnOrTable: 'user',
            foreignColumns: ['id'],
            options: { onDelete: 'CASCADE' },
          },
        },
      ]);
    });

    it('should create foreign key constraint on hasOne relation', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((user) => ({
        profile: user('id')
          .hasOne(() => ProfileTable('userId'))
          .foreignKey({ onDelete: 'SET NULL' }),
      }));
      const ProfileTable = defineTable('profile', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

      expect(db.profile.internal.tableData.constraints).toEqual([
        {
          references: {
            columns: ['userId'],
            fnOrTable: 'user',
            foreignColumns: ['id'],
            options: { onDelete: 'SET NULL' },
          },
        },
      ]);
    });

    it('should create foreign key constraint on hasMany relation', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((user) => ({
        posts: user('id')
          .hasMany(() => PostTable('userId'))
          .foreignKey({ onDelete: 'SET NULL' }),
      }));
      const PostTable = defineTable('post', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        post: PostTable,
      });

      expect(db.post.internal.tableData.constraints).toEqual([
        {
          references: {
            columns: ['userId'],
            fnOrTable: 'user',
            foreignColumns: ['id'],
            options: { onDelete: 'SET NULL' },
          },
        },
      ]);
    });

    it('should combine foreignKey with required', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((user) => ({
        profile: user('id')
          .hasOne(() => ProfileTable('userId'))
          .required()
          .foreignKey({ onDelete: 'CASCADE' }),
      }));
      const ProfileTable = defineTable('profile', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

      expect(db.profile.internal.tableData.constraints).toEqual([
        {
          references: {
            columns: ['userId'],
            fnOrTable: 'user',
            foreignColumns: ['id'],
            options: { onDelete: 'CASCADE' },
          },
        },
      ]);
    });

    it('should support autoForeignKeys option on createTableFactory', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const ProfileTable = defineTable('profile', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      })).relations((profile) => ({
        user: profile('userId').belongsTo(() => UserTable('id')),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

      expect(db.profile.internal.tableData.constraints).toEqual([
        {
          references: {
            columns: ['userId'],
            fnOrTable: 'user',
            foreignColumns: ['id'],
            options: { onUpdate: 'CASCADE' },
          },
        },
      ]);
    });

    it('should support autoForeignKeys: true on createTableFactory', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: true,
      });
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const ProfileTable = defineTable('profile', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      })).relations((profile) => ({
        user: profile('userId').belongsTo(() => UserTable('id')),
      }));

      const db = testOrchidORMWithAdapter({
        user: UserTable,
        profile: ProfileTable,
      });

      expect(db.profile.internal.tableData.constraints).toEqual([
        {
          references: {
            columns: ['userId'],
            fnOrTable: 'user',
            foreignColumns: ['id'],
            options: {},
          },
        },
      ]);
    });
  });

  describe('hasAndBelongsToMany foreignKey', () => {
    it('should set foreignKey on both sides with no arguments', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const PostTable = defineTable('post', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((post) => ({
        tags: post('id')
          .hasAndBelongsToMany(() => TagTable('tag'))
          .through('postTag', 'postId', 'tag')
          .foreignKey(),
      }));
      const TagTable = defineTable('tag', (t) => ({
        tag: t.text().primaryKey(),
      }));
      const PostTagTable = defineTable('postTag', (t) => ({
        postId: t.integer(),
        tag: t.text(),
      }));

      const db = testOrchidORMWithAdapter({
        post: PostTable,
        tag: TagTable,
        postTag: PostTagTable,
      });

      expect(
        ((db.post.shape as RecordUnknown).tags as { joinTable: Query })
          .joinTable.internal.tableData.constraints,
      ).toEqual([
        {
          references: {
            columns: ['postId'],
            fnOrTable: 'post',
            foreignColumns: ['id'],
            options: { onUpdate: 'CASCADE' },
          },
        },
        {
          references: {
            columns: ['tag'],
            fnOrTable: 'tag',
            foreignColumns: ['tag'],
            options: { onUpdate: 'CASCADE' },
          },
        },
      ]);
    });

    it('should disable foreignKey on both sides with false', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const PostTable = defineTable('post', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((post) => ({
        tags: post('id')
          .hasAndBelongsToMany(() => TagTable('tag'))
          .through('postTag', 'postId', 'tag')
          .foreignKey(false),
      }));
      const TagTable = defineTable('tag', (t) => ({
        tag: t.text().primaryKey(),
      }));
      const PostTagTable = defineTable('postTag', (t) => ({
        postId: t.integer(),
        tag: t.text(),
      }));

      const db = testOrchidORMWithAdapter({
        post: PostTable,
        tag: TagTable,
        postTag: PostTagTable,
      });

      expect(
        ((db.post.shape as RecordUnknown).tags as { joinTable: Query })
          .joinTable.internal.tableData.constraints,
      ).toBeUndefined();
    });

    it('should set different foreignKey options for each side', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const PostTable = defineTable('post', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((post) => ({
        tags: post('id')
          .hasAndBelongsToMany(() => TagTable('tag'))
          .through('postTag', 'postId', 'tag')
          .foreignKey({
            forThisTable: { onDelete: 'CASCADE' },
            forRelatedTable: { onUpdate: 'SET NULL' },
          }),
      }));
      const TagTable = defineTable('tag', (t) => ({
        tag: t.text().primaryKey(),
      }));
      const PostTagTable = defineTable('postTag', (t) => ({
        postId: t.integer(),
        tag: t.text(),
      }));

      const db = testOrchidORMWithAdapter({
        post: PostTable,
        tag: TagTable,
        postTag: PostTagTable,
      });

      expect(
        ((db.post.shape as RecordUnknown).tags as { joinTable: Query })
          .joinTable.internal.tableData.constraints,
      ).toEqual([
        {
          references: {
            columns: ['postId'],
            fnOrTable: 'post',
            foreignColumns: ['id'],
            options: { onDelete: 'CASCADE' },
          },
        },
        {
          references: {
            columns: ['tag'],
            fnOrTable: 'tag',
            foreignColumns: ['tag'],
            options: { onUpdate: 'SET NULL' },
          },
        },
      ]);
    });

    it('should set same foreignKey options for both sides with forBothTables', () => {
      const { defineTable } = createTableFactory({
        autoForeignKeys: { onUpdate: 'CASCADE' },
      });
      const PostTable = defineTable('post', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((post) => ({
        tags: post('id')
          .hasAndBelongsToMany(() => TagTable('tag'))
          .through('postTag', 'postId', 'tag')
          .foreignKey({
            forBothTables: { onDelete: 'SET NULL' },
          }),
      }));
      const TagTable = defineTable('tag', (t) => ({
        tag: t.text().primaryKey(),
      }));
      const PostTagTable = defineTable('postTag', (t) => ({
        postId: t.integer(),
        tag: t.text(),
      }));

      const db = testOrchidORMWithAdapter({
        post: PostTable,
        tag: TagTable,
        postTag: PostTagTable,
      });

      expect(
        ((db.post.shape as RecordUnknown).tags as { joinTable: Query })
          .joinTable.internal.tableData.constraints,
      ).toEqual([
        {
          references: {
            columns: ['postId'],
            fnOrTable: 'post',
            foreignColumns: ['id'],
            options: { onDelete: 'SET NULL' },
          },
        },
        {
          references: {
            columns: ['tag'],
            fnOrTable: 'tag',
            foreignColumns: ['tag'],
            options: { onDelete: 'SET NULL' },
          },
        },
      ]);
    });
  });

  describe('snake case', () => {
    it('should preserve column names in SQL by default when no snakeCase option is passed', () => {
      const { defineTable } = createTableFactory();
      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
        camelCase: t.integer(),
        snakeCase: t.integer(),
      }));

      const db = testOrchidORMWithAdapter({ table: TestTable });

      expectSql(
        db.table.select('camelCase', 'snakeCase').toSQL(),
        `
          SELECT "test"."camelCase", "test"."snakeCase"
          FROM "test"
        `,
      );
    });

    it('should preserve t.name() column names in SQL', () => {
      const { defineTable } = createTableFactory();
      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
        customCol: t.name('custom_name').integer(),
      }));

      const db = testOrchidORMWithAdapter({ table: TestTable });

      expectSql(
        db.table.select('customCol').toSQL(),
        `
          SELECT "test"."custom_name" "customCol"
          FROM "test"
        `,
      );
    });

    it('should preserve timestamps without snake case by default', () => {
      const { defineTable } = createTableFactory();
      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
        ...t.timestamps(),
      }));

      const db = testOrchidORMWithAdapter({ table: TestTable });

      expectSql(
        db.table.select('createdAt', 'updatedAt').toSQL(),
        `
          SELECT "test"."createdAt", "test"."updatedAt"
          FROM "test"
        `,
      );
    });

    it('should snake case columns and timestamps when snakeCase is set to true on factory', () => {
      const { defineTable } = createTableFactory({ snakeCase: true });
      const TestTable = defineTable('test', (t) => ({
        id: t.identity().primaryKey(),
        camelCase: t.name('camelCase').integer(),
        snakeCase: t.integer(),
        ...t.timestamps(),
      }));

      const db = testOrchidORMWithAdapter({ table: TestTable });

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
      const { defineTable, sql } = createTableFactory({ snakeCase: true });
      let fullNameSql: RawSql | undefined;
      const getColumnName = (column: unknown) =>
        (column as { data: { name?: string } }).data.name;
      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
        firstName: t.text(),
        lastName: t.text(),
      })).computed((q) => ({
        fullName: (fullNameSql ??= sql<string>`${q.column(
          'firstName',
        )} || ' ' || ${q.column('lastName')}`),
      }));

      const firstDb = testOrchidORMWithAdapter({ user: UserTable });
      const firstName = getColumnName(firstDb.user.shape.fullName);

      const secondDb = testOrchidORMWithAdapter({ user: UserTable });

      expect({
        firstName,
        secondName: getColumnName(secondDb.user.shape.fullName),
      }).toEqual({
        firstName: undefined,
        secondName: undefined,
      });
    });
  });
});
