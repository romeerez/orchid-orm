import { useTestORM, messageSelectAll } from '../../test-utils/orm.test-utils';
import { Query } from 'pqb';
import {
  db,
  assertType,
  expectSql,
  Profile,
  ProfileSelectAll,
  MessageData,
  ChatData,
  defineTable,
  testOrchidORMWithAdapter,
} from 'test-utils';

const ormParams = {
  db: db.$qb,
};

useTestORM();

describe('hasOne through', () => {
  it('should resolve recursive situation when both tables depends on each other', () => {
    const PostTable = defineTable('post', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    })).relations((post) => ({
      postTag: post('Id').hasOne(() => PostTagTable('PostId')),
      tag: post.hasOne(() => TagTable.through('postTag', 'tag')),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    })).relations((tag) => ({
      postTag: tag('Id').hasOne(() => PostTagTable('PostId')),
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

    const local = testOrchidORMWithAdapter(ormParams, {
      post: PostTable,
      tag: TagTable,
      postTag: PostTagTable,
    });

    expect(Object.keys(local.post.relations)).toEqual(['postTag', 'tag']);
    expect(Object.keys(local.tag.relations)).toEqual(['postTag', 'post']);
  });

  it('should throw if through relation is not defined', () => {
    const PostTable = defineTable('post', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    })).relations((post) => ({
      tag: post.hasOne(() => TagTable.through('postTag', 'tag')),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    }));

    expect(() => {
      testOrchidORMWithAdapter(ormParams, {
        post: PostTable,
        tag: TagTable,
      });
    }).toThrow(
      'Cannot define a `tag` relation on `post`: cannot find `postTag` relation required by the `through` option',
    );
  });

  it('should throw if source relation is not defined', () => {
    const PostTable = defineTable('post', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    })).relations((post) => ({
      postTag: post('Id').hasOne(() => PostTagTable('PostId')),
      tag: post.hasOne(() => TagTable.through('postTag', 'tag')),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.name('id').identity().primaryKey(),
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
    })).primaryKey(['PostId', 'TagId']);

    expect(() => {
      testOrchidORMWithAdapter(ormParams, {
        post: PostTable,
        tag: TagTable,
        postTag: PostTagTable,
      });
    }).toThrow(
      'Cannot define a `tag` relation on `post`: cannot find `tag` relation in `postTag` required by the `source` option',
    );
  });

  describe('queryRelated', () => {
    it('should query related record', async () => {
      const q = db.message.queryRelated('profile', {
        AuthorId: 1,
        MessageKey: 'key',
      });

      expectSql(
        q.toSQL(),
        `
          SELECT ${ProfileSelectAll} FROM "schema"."profile"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."user" "sender"
            WHERE "profile"."user_id" = "sender"."id"
              AND "profile"."profile_key" = "sender"."user_key"
              AND "sender"."id" = $1
              AND "sender"."user_key" = $2
          )
        `,
        [1, 'key'],
      );
    });

    it('should query related record using `on`', async () => {
      const q = db.message.queryRelated('activeProfile', {
        AuthorId: 1,
        MessageKey: 'key',
      });

      expectSql(
        q.toSQL(),
        `
          SELECT ${ProfileSelectAll} FROM "schema"."profile" "activeProfile"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."user" "activeSender"
            WHERE "activeProfile"."active" = $1
              AND "activeProfile"."user_id" = "activeSender"."id"
              AND "activeProfile"."profile_key" = "activeSender"."user_key"
              AND "activeSender"."active" = $2
              AND "activeSender"."id" = $3
              AND "activeSender"."user_key" = $4
          )
        `,
        [true, true, 1, 'key'],
      );
    });
  });

  it('should have proper joinQuery', () => {
    expectSql(
      (
        db.message.relations.profile.joinQuery(
          db.profile.as('p'),
          db.message.as('m'),
        ) as Query
      ).toSQL(),
      `
        SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."user" "sender"
          WHERE "p"."user_id" = "sender"."id"
            AND "p"."profile_key" = "sender"."user_key"
            AND "sender"."id" = "m"."author_id"
            AND "sender"."user_key" = "m"."message_key"
        )
      `,
    );
  });

  describe('whereExists', () => {
    it('should be supported in whereExists', () => {
      expectSql(
        db.message.whereExists('profile').toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "Message"
          WHERE (EXISTS (
            SELECT 1 FROM "schema"."profile"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "Message"."author_id"
                AND "sender"."user_key" = "Message"."message_key"
            )
          ))
            AND ("Message"."deleted_at" IS NULL)
        `,
      );

      expectSql(
        db.message
          .as('m')
          .whereExists((q) => q.profile.where({ Bio: 'bio' }))
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "schema"."profile"
            WHERE "Profile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."user" "sender"
                WHERE "profile"."user_id" = "sender"."id"
                  AND "profile"."profile_key" = "sender"."user_key"
                  AND "sender"."id" = "m"."author_id"
                  AND "sender"."user_key" = "m"."message_key"
              )
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );

      expectSql(
        db.message
          .as('m')
          .whereExists('profile', (q) => q.where({ 'profile.Bio': 'bio' }))
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "schema"."profile"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
            AND "profile"."bio" = $1
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should be supported in whereExists using `on`', () => {
      expectSql(
        db.message.whereExists('activeProfile').toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "Message"
          WHERE (EXISTS (
            SELECT 1 FROM "schema"."profile" "activeProfile"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "activeSender"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $2
                AND "activeSender"."id" = "Message"."author_id"
                AND "activeSender"."user_key" = "Message"."message_key"
            )
          ))
            AND ("Message"."deleted_at" IS NULL)
        `,
        [true, true],
      );

      expectSql(
        db.message
          .as('m')
          .whereExists((q) => q.activeProfile.where({ Bio: 'bio' }))
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "schema"."profile" "activeProfile"
            WHERE "activeProfile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."user" "activeSender"
                WHERE "activeProfile"."active" = $2
                  AND "activeProfile"."user_id" = "activeSender"."id"
                  AND "activeProfile"."profile_key" = "activeSender"."user_key"
                  AND "activeSender"."active" = $3
                  AND "activeSender"."id" = "m"."author_id"
                  AND "activeSender"."user_key" = "m"."message_key"
              )
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        ['bio', true, true],
      );

      expectSql(
        db.message
          .as('m')
          .whereExists('activeProfile', (q) =>
            q.where({ 'activeProfile.Bio': 'bio' }),
          )
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "schema"."profile" "activeProfile"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "activeSender"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $2
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
            AND "activeProfile"."bio" = $3
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        [true, true, 'bio'],
      );
    });
  });

  describe('join', () => {
    it('should be supported in join', () => {
      const q = db.message
        .as('m')
        .join('profile', (q) => q.where({ Bio: 'bio' }))
        .select('Text', 'profile.Bio');

      assertType<Awaited<typeof q>, { Text: string; Bio: string | null }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "m"."text" "Text", "profile"."bio" "Bio"
          FROM "schema"."message" "m"
          JOIN "schema"."profile"
            ON EXISTS (
              SELECT 1 FROM "schema"."user" "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
            AND "profile"."bio" = $1
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should be supported in join using `on`', () => {
      const q = db.message
        .as('m')
        .join('activeProfile', (q) => q.where({ Bio: 'bio' }))
        .select('Text', 'activeProfile.Bio');

      assertType<Awaited<typeof q>, { Text: string; Bio: string | null }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "m"."text" "Text", "activeProfile"."bio" "Bio"
          FROM "schema"."message" "m"
          JOIN "schema"."profile" "activeProfile"
            ON EXISTS (
              SELECT 1 FROM "schema"."user" "activeSender"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $2
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
            AND "activeProfile"."bio" = $3
          WHERE ("m"."deleted_at" IS NULL)
        `,
        [true, true, 'bio'],
      );
    });

    it('should be supported in join with a callback', () => {
      const q = db.message
        .as('m')
        .join(
          (q) => q.profile.as('p').where({ UserId: 123 }),
          (q) => q.where({ Bio: 'bio' }),
        )
        .select('Text', 'p.Bio');

      assertType<Awaited<typeof q>, { Text: string; Bio: string | null }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "m"."text" "Text", "p"."bio" "Bio"
          FROM "schema"."message" "m"
          JOIN "schema"."profile" "p"
            ON "p"."bio" = $1
           AND "p"."user_id" = $2
           AND EXISTS (
              SELECT 1 FROM "schema"."user" "sender"
              WHERE "p"."user_id" = "sender"."id"
                AND "p"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio', 123],
      );
    });

    it('should be supported in join with a callback using `on`', () => {
      const q = db.message
        .as('m')
        .join(
          (q) => q.activeProfile.as('p').where({ UserId: 123 }),
          (q) => q.where({ Bio: 'bio' }),
        )
        .select('Text', 'p.Bio');

      assertType<Awaited<typeof q>, { Text: string; Bio: string | null }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "m"."text" "Text", "p"."bio" "Bio"
          FROM "schema"."message" "m"
          JOIN "schema"."profile" "p"
            ON "p"."bio" = $1
           AND "p"."user_id" = $2
           AND EXISTS (
              SELECT 1 FROM "schema"."user" "activeSender"
              WHERE "p"."active" = $3
                AND "p"."user_id" = "activeSender"."id"
                AND "p"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $4
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio', 123, true, true],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.message
        .joinLateral('profile', (q) => q.as('p').where({ Bio: 'one' }))
        .where({ 'p.Bio': 'two' })
        .select('Text', 'p.*');

      assertType<Awaited<typeof q>, { Text: string; p: Profile }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "Message"."text" "Text", row_to_json("p".*) "p"
          FROM "schema"."message" "Message"
          JOIN LATERAL (
            SELECT ${ProfileSelectAll}
            FROM "schema"."profile" "p"
            WHERE "p"."bio" = $1
              AND EXISTS (
              SELECT 1
              FROM "schema"."user" "sender"
              WHERE "p"."user_id" = "sender"."id"
                AND "p"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "Message"."author_id"
                AND "sender"."user_key" = "Message"."message_key"
            )
          ) "p" ON true
          WHERE ("p"."Bio" = $2)
            AND ("Message"."deleted_at" IS NULL)
        `,
        ['one', 'two'],
      );
    });

    it('should be supported in joinLateral using `on`', () => {
      const q = db.message
        .joinLateral('activeProfile', (q) => q.as('p').where({ Bio: 'one' }))
        .where({ 'p.Bio': 'two' })
        .select('Text', 'p.*');

      assertType<Awaited<typeof q>, { Text: string; p: Profile }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "Message"."text" "Text", row_to_json("p".*) "p"
          FROM "schema"."message" "Message"
          JOIN LATERAL (
            SELECT ${ProfileSelectAll}
            FROM "schema"."profile" "p"
            WHERE "p"."bio" = $1
              AND EXISTS (
              SELECT 1
              FROM "schema"."user" "activeSender"
              WHERE "p"."active" = $2
                AND "p"."user_id" = "activeSender"."id"
                AND "p"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $3
                AND "activeSender"."id" = "Message"."author_id"
                AND "activeSender"."user_key" = "Message"."message_key"
            )
          ) "p" ON true
          WHERE ("p"."Bio" = $4)
            AND ("Message"."deleted_at" IS NULL)
        `,
        ['one', true, true, 'two'],
      );
    });
  });

  describe('select', () => {
    it('should be selectable', () => {
      const q = db.message.as('m').select('Id', {
        profile: (q) => q.profile.where({ Bio: 'bio' }),
      });

      assertType<Awaited<typeof q>, { Id: number; profile: Profile }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "m"."id" "Id",
            row_to_json("profile".*) "profile"
          FROM "schema"."message" "m"
          LEFT JOIN LATERAL (
            SELECT ${ProfileSelectAll} FROM "schema"."profile"
            WHERE "profile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."user" "sender"
                WHERE "profile"."user_id" = "sender"."id"
                  AND "profile"."profile_key" = "sender"."user_key"
                  AND "sender"."id" = "m"."author_id"
                  AND "sender"."user_key" = "m"."message_key"
              )
          ) "profile" ON true
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should be selectable using `on`', () => {
      const q = db.message.as('m').select('Id', {
        profile: (q) => q.activeProfile.where({ Bio: 'bio' }),
      });

      assertType<Awaited<typeof q>, { Id: number; profile: Profile }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "m"."id" "Id",
            row_to_json("profile".*) "profile"
          FROM "schema"."message" "m"
          LEFT JOIN LATERAL (
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "activeProfile"
            WHERE "activeProfile"."bio" = $1
              AND EXISTS (
              SELECT 1 FROM "schema"."user" "activeSender"
              WHERE "activeProfile"."active" = $2
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $3
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
          ) "profile" ON true
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio', true, true],
      );
    });

    it('should support require() for inner join', () => {
      const q = db.message.as('m').select('Id', {
        profile: (q) => q.profile.require(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT
            "m"."id" "Id",
            row_to_json("profile".*) "profile"
          FROM "schema"."message" "m"
          JOIN LATERAL (
            SELECT ${ProfileSelectAll} FROM "schema"."profile"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
          ) "profile" ON true
          WHERE ("m"."deleted_at" IS NULL)
        `,
      );
    });

    it('should handle exists sub query', () => {
      const q = db.message.as('m').select('Id', {
        hasProfile: (q) => q.profile.exists(),
      });

      assertType<Awaited<typeof q>, { Id: number; hasProfile: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "m"."id" "Id",
            COALESCE("hasProfile"."hasProfile", false) "hasProfile"
          FROM "schema"."message" "m"
          LEFT JOIN LATERAL (
            SELECT true "hasProfile"
            FROM "schema"."profile"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
          ) "hasProfile" ON true
          WHERE ("m"."deleted_at" IS NULL)
        `,
      );
    });

    it('should support recurring select', async () => {
      const q = db.message.select({
        profile: (q) =>
          q.profile.select({
            messages: (q) =>
              q.messages
                .select({
                  profile: (q) => q.profile,
                })
                .where({ 'profile.Bio': 'bio' }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("profile".*) "profile"
          FROM "schema"."message" "Message"
          LEFT JOIN LATERAL (
            SELECT COALESCE("messages"."messages", '[]') "messages"
            FROM "schema"."profile"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "messages"
              FROM (
                SELECT row_to_json("profile2".*) "profile"
                FROM "schema"."message" "messages"
                LEFT JOIN LATERAL (
                  SELECT ${ProfileSelectAll}
                  FROM "schema"."profile" "profile2"
                  WHERE EXISTS (
                    SELECT 1
                    FROM "schema"."user" "sender"
                    WHERE "profile2"."user_id" = "sender"."id"
                      AND "profile2"."profile_key" = "sender"."user_key"
                      AND "sender"."id" = "messages"."author_id"
                      AND "sender"."user_key" = "messages"."message_key"
                  )
                ) "profile2" ON true
                WHERE ("profile2"."Bio" = $1
                  AND EXISTS (
                    SELECT 1
                    FROM "schema"."user"
                    WHERE ("messages"."author_id" = "user"."id"
                      AND "messages"."message_key" = "user"."user_key")
                      AND ("messages"."deleted_at" IS NULL)
                      AND "user"."id" = "profile"."user_id"
                      AND "user"."user_key" = "profile"."profile_key"
                  )
                ) AND ("messages"."deleted_at" IS NULL)
              ) "t"
            ) "messages" ON true
            WHERE EXISTS (
              SELECT 1
              FROM "schema"."user" "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "Message"."author_id"
                AND "sender"."user_key" = "Message"."message_key"
            )
          ) "profile" ON true
          WHERE ("Message"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should support recurring select using `on`', async () => {
      const q = db.message.select({
        profile: (q) =>
          q.activeProfile.select({
            messages: (q) =>
              q.messages
                .select({
                  profile: (q) => q.activeProfile,
                })
                .where({ 'profile.Bio': 'bio' }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("profile".*) "profile"
          FROM "schema"."message" "Message"
          LEFT JOIN LATERAL (
            SELECT COALESCE("messages"."messages", '[]') "messages"
            FROM "schema"."profile" "activeProfile"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "messages"
              FROM (
                SELECT row_to_json("profile".*) "profile"
                FROM "schema"."message" "messages"
                LEFT JOIN LATERAL (
                  SELECT ${ProfileSelectAll}
                  FROM "schema"."profile" "activeProfile2"
                  WHERE EXISTS (
                    SELECT 1
                    FROM "schema"."user" "activeSender"
                    WHERE "activeProfile2"."active" = $1
                      AND "activeProfile2"."user_id" = "activeSender"."id"
                      AND "activeProfile2"."profile_key" = "activeSender"."user_key"
                      AND "activeSender"."active" = $2
                      AND "activeSender"."id" = "messages"."author_id"
                      AND "activeSender"."user_key" = "messages"."message_key"
                  )
                ) "profile" ON true
                WHERE ("profile"."Bio" = $3
                  AND EXISTS (
                    SELECT 1
                    FROM "schema"."user"
                    WHERE ("messages"."author_id" = "user"."id"
                      AND "messages"."message_key" = "user"."user_key")
                      AND ("messages"."deleted_at" IS NULL)
                      AND "user"."id" = "activeProfile"."user_id"
                      AND "user"."user_key" = "activeProfile"."profile_key")
                ) AND ("messages"."deleted_at" IS NULL)
              ) "t"
            ) "messages" ON true
            WHERE EXISTS (
              SELECT 1
              FROM "schema"."user" "activeSender"
              WHERE "activeProfile"."active" = $4
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $5
                AND "activeSender"."id" = "Message"."author_id"
                AND "activeSender"."user_key" = "Message"."message_key"
            )
          ) "profile" ON true
          WHERE ("Message"."deleted_at" IS NULL)
        `,
        [true, true, 'bio', true, true],
      );
    });
  });

  describe('not required hasOne through', () => {
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      Name: t.name('name').text(),
      Password: t.name('password').text(),
    })).relations((user) => ({
      profile: user('Id').hasOne(() => ProfileTable('UserId')),
    }));

    const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      UserId: t.name('user_id').integer().nullable(),
    }));

    const MessageTable = defineTable('message', { schema: 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      ChatId: t.name('chat_id').integer(),
      AuthorId: t.name('author_id').integer().nullable(),
      Text: t.name('text').text(),
      MessageKey: t.name('message_key').string().nullable(),
      ...t.timestamps(),
    })).relations((message) => ({
      user: message('AuthorId').belongsTo(() => UserTable('Id')),
      profile: message.hasOne(() => ProfileTable.through('user', 'profile')),
    }));

    const local = testOrchidORMWithAdapter(ormParams, {
      user: UserTable,
      profile: ProfileTable,
      message: MessageTable,
    });

    it('should query related record and get an `undefined`', async () => {
      const profile = await local.message.queryRelated('profile', {
        AuthorId: 123,
      });
      expect(profile).toBe(undefined);
    });

    it('should be selectable', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const id = await local.message
        .get('Id')
        .create({ ...MessageData, ChatId });

      const result = await local.message.select('Id', {
        profile: (q) => q.profile,
      });

      assertType<
        typeof result,
        {
          Id: number;
          profile:
            | {
                Id: number;
                UserId: number | null;
              }
            | undefined;
        }[]
      >();

      expect(result).toEqual([
        {
          Id: id,
          profile: undefined,
        },
      ]);
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.message.where((q) =>
      q.profile.whereIn('Bio', ['a', 'b']).count().equals(1),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${messageSelectAll} FROM "schema"."message" "Message" WHERE ((
          SELECT count(*) = $1
          FROM "schema"."profile"
          WHERE "profile"."bio" IN ($2, $3)
            AND EXISTS (
              SELECT 1
              FROM "schema"."user" "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "Message"."author_id"
                AND "sender"."user_key" = "Message"."message_key"
            )
        )) AND ("Message"."deleted_at" IS NULL)
      `,
      [1, 'a', 'b'],
    );
  });
});
