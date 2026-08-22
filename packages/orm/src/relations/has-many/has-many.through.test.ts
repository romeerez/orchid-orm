import { Query } from 'pqb';
import { useTestORM, chatSelectAll } from '../../test-utils/orm.test-utils';
import { orchidORMWithAdapter } from '../../orm-instance/orm-instance';
import {
  Chat,
  Profile,
  db,
  assertType,
  expectSql,
  ProfileSelectAll,
} from 'test-utils';
import { createTableFactory } from '../../orm-table/table';

const ormParams = {
  db: db.$qb,
};

describe('hasMany through', () => {
  useTestORM();

  it('should resolve recursive situation when both tables depends on each other', () => {
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

    const local = orchidORMWithAdapter(ormParams, {
      post: PostTable,
      tag: TagTable,
      postTag: PostTagTable,
    });

    expect(Object.keys(local.post.relations)).toEqual(['postTags', 'tags']);
    expect(Object.keys(local.tag.relations)).toEqual(['postTags', 'posts']);
  });

  it('should throw if through relation is not defined', () => {
    const { defineTable } = createTableFactory({});

    const PostTable = defineTable('post', (t) => ({
      Id: t.identity().primaryKey(),
    })).relations((post) => ({
      tags: post.hasMany(() => TagTable.through('postTags', 'tag')),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.identity().primaryKey(),
    }));

    expect(() => {
      orchidORMWithAdapter(ormParams, {
        post: PostTable,
        tag: TagTable,
      });
    }).toThrow(
      'Cannot define a `tags` relation on `post`: cannot find `postTags` relation required by the `through` option',
    );
  });

  it('should throw if source relation is not defined', () => {
    const { defineTable } = createTableFactory({});

    const PostTable = defineTable('post', (t) => ({
      Id: t.identity().primaryKey(),
    })).relations((post) => ({
      postTags: post('Id').hasMany(() => PostTagTable('PostId')),
      tags: post.hasMany(() => TagTable.through('postTags', 'tag')),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.identity().primaryKey(),
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
      orchidORMWithAdapter(ormParams, {
        post: PostTable,
        tag: TagTable,
        postTag: PostTagTable,
      });
    }).toThrow(
      'Cannot define a `tags` relation on `post`: cannot find `tag` relation in `postTag` required by the `source` option',
    );
  });

  describe('through hasMany', () => {
    describe('queryRelated', () => {
      it('should support `queryRelated` to query related data', async () => {
        const q = db.profile.queryRelated('chats', {
          UserId: 1,
          ProfileKey: 'key',
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "chats"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."chat_key" = "chats"."chat_key"
                  AND "chat_user"."user_id" = "user"."id"
                  AND "chat_user"."user_key" = "user"."user_key"
              )
              AND "User"."id" = $1
              AND "User"."user_key" = $2
            )
          `,
          [1, 'key'],
        );
      });

      it('should support `queryRelated` to query related data using `on`', async () => {
        const q = db.profile.queryRelated('activeChats', {
          UserId: 1,
          ProfileKey: 'key',
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "activeChats"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "activeUser"
              WHERE "activeChats"."active" = $1
                AND EXISTS (
                  SELECT 1 FROM "schema"."chat_user"
                  WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                    AND "chat_user"."chat_key" = "activeChats"."chat_key"
                    AND "chat_user"."user_id" = "activeUser"."id"
                    AND "chat_user"."user_key" = "activeUser"."user_key"
                )
                AND "activeUser"."active" = $2
                AND "activeUser"."id" = $3
                AND "activeUser"."user_key" = $4
            )
          `,
          [true, true, 1, 'key'],
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.profile.relations.chats.joinQuery(
            db.chat.as('c'),
            db.profile.as('p'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${chatSelectAll} FROM "schema"."chat" "c"
          WHERE
            EXISTS (
              SELECT 1 FROM "schema"."user"
              WHERE
                EXISTS (
                  SELECT 1 FROM "schema"."chat_user"
                  WHERE "chat_user"."chat_id" = "c"."id_of_chat"
                    AND "chat_user"."chat_key" = "c"."chat_key"
                    AND "chat_user"."user_id" = "user"."id"
                    AND "chat_user"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            )
        `,
      );
    });

    describe('whereExists', () => {
      it('should be supported in whereExists', () => {
        expectSql(
          db.profile.whereExists('chats').toSQL(),
          `
          SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat"  "chats"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user"
              WHERE EXISTS (
                  SELECT 1 FROM "schema"."chat_user"
                  WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                    AND "chat_user"."chat_key" = "chats"."chat_key"
                    AND "chat_user"."user_id" = "user"."id"
                AND "chat_user"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "Profile"."user_id"
                AND "user"."user_key" = "Profile"."profile_key"
            )
          )
        `,
        );

        expectSql(
          db.profile
            .as('p')
            .whereExists((q) => q.chats.where({ Title: 'title' }))
            .toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat"  "chats"
              WHERE "chats"."title" = $1
                AND EXISTS (
                  SELECT 1 FROM "schema"."user"
                  WHERE EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                      AND "chat_user"."chat_key" = "chats"."chat_key"
                      AND "chat_user"."user_id" = "user"."id"
                      AND "chat_user"."user_key" = "user"."user_key"
                  )
                  AND "user"."id" = "p"."user_id"
                  AND "user"."user_key" = "p"."profile_key"
                )
            )
          `,
          ['title'],
        );

        expectSql(
          db.profile
            .as('p')
            .whereExists('chats', (q) => q.where({ 'chats.Title': 'title' }))
            .toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat"  "chats"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user"
                WHERE EXISTS (
                  SELECT 1 FROM "schema"."chat_user"
                  WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                    AND "chat_user"."chat_key" = "chats"."chat_key"
                    AND "chat_user"."user_id" = "user"."id"
                    AND "chat_user"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
              )
              AND "chats"."title" = $1
            )
          `,
          ['title'],
        );
      });

      it('should be supported in whereExists using `on`', () => {
        expectSql(
          db.profile.whereExists('activeChats').toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat"  "activeChats"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "activeUser"
                WHERE "activeChats"."active" = $1
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                      AND "chat_user"."chat_key" = "activeChats"."chat_key"
                      AND "chat_user"."user_id" = "activeUser"."id"
                      AND "chat_user"."user_key" = "activeUser"."user_key"
                  )
                  AND "activeUser"."active" = $2
                  AND "activeUser"."id" = "Profile"."user_id"
                  AND "activeUser"."user_key" = "Profile"."profile_key"
              )
            )
          `,
          [true, true],
        );

        expectSql(
          db.profile
            .as('p')
            .whereExists((q) => q.activeChats.where({ Title: 'title' }))
            .toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat"  "activeChats"
              WHERE "activeChats"."title" = $1
                AND EXISTS (
                    SELECT 1 FROM "schema"."user" "activeUser"
                    WHERE "activeChats"."active" = $2
                      AND EXISTS (
                          SELECT 1 FROM "schema"."chat_user"
                          WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                            AND "chat_user"."chat_key" = "activeChats"."chat_key"
                            AND "chat_user"."user_id" = "activeUser"."id"
                            AND "chat_user"."user_key" = "activeUser"."user_key"
                      )
                      AND "activeUser"."active" = $3
                      AND "activeUser"."id" = "p"."user_id"
                      AND "activeUser"."user_key" = "p"."profile_key"
                )
            )
          `,
          ['title', true, true],
        );

        expectSql(
          db.profile
            .as('p')
            .whereExists('activeChats', (q) =>
              q.where({ 'activeChats.Title': 'title' }),
            )
            .toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat"  "activeChats"
              WHERE
                EXISTS (
                  SELECT 1 FROM "schema"."user" "activeUser"
                  WHERE "activeChats"."active" = $1
                    AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                        AND "chat_user"."user_id" = "activeUser"."id"
                        AND "chat_user"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $2
                    AND "activeUser"."id" = "p"."user_id"
                    AND "activeUser"."user_key" = "p"."profile_key"
                )
                AND "activeChats"."title" = $3
            )
          `,
          [true, true, 'title'],
        );
      });
    });

    describe('join', () => {
      it('should be supported in join', () => {
        const q = db.profile
          .as('p')
          .join('chats', (q) => q.where({ Title: 'title' }))
          .select('Bio', 'chats.Title');

        assertType<
          Awaited<typeof q>,
          { Bio: string | null; Title: string }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "chats"."title" "Title"
            FROM "schema"."profile" "p"
            JOIN "schema"."chat" "chats"
              ON EXISTS (
                SELECT 1 FROM "schema"."user"
                WHERE EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                      AND "chat_user"."chat_key" = "chats"."chat_key"
                      AND "chat_user"."user_id" = "user"."id"
                  AND "chat_user"."user_key" = "user"."user_key"
                  )
                  AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
              )
              AND "chats"."title" = $1
          `,
          ['title'],
        );
      });

      it('should be supported in join using `on`', () => {
        const q = db.profile
          .as('p')
          .join('activeChats', (q) => q.where({ Title: 'title' }))
          .select('Bio', 'activeChats.Title');

        assertType<
          Awaited<typeof q>,
          { Bio: string | null; Title: string }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "activeChats"."title" "Title"
            FROM "schema"."profile" "p"
            JOIN "schema"."chat"  "activeChats"
              ON
                EXISTS (
                  SELECT 1 FROM "schema"."user" "activeUser"
                  WHERE "activeChats"."active" = $1
                    AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                        AND "chat_user"."user_id" = "activeUser"."id"
                        AND "chat_user"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $2
                    AND "activeUser"."id" = "p"."user_id"
                    AND "activeUser"."user_key" = "p"."profile_key"
                )
             AND "activeChats"."title" = $3
          `,
          [true, true, 'title'],
        );
      });

      it('should be supported in join with a callback', () => {
        const now = new Date();

        const q = db.profile
          .as('p')
          .join(
            (q) => q.chats.as('c').where({ updatedAt: now }),
            (q) => q.where({ Title: 'title' }),
          )
          .select('Bio', 'c.Title');

        assertType<
          Awaited<typeof q>,
          { Bio: string | null; Title: string }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "c"."title" "Title"
            FROM "schema"."profile" "p"
            JOIN "schema"."chat" "c"
              ON "c"."title" = $1
              AND "c"."updated_at" = $2
              AND EXISTS (
                SELECT 1 FROM "schema"."user"
                WHERE EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "c"."id_of_chat"
                          AND "chat_user"."chat_key" = "c"."chat_key"
                      AND "chat_user"."user_id" = "user"."id"
                  AND "chat_user"."user_key" = "user"."user_key"
                  )
                  AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
              )
          `,
          ['title', now],
        );
      });

      it('should be supported in join with a callback using `on`', () => {
        const now = new Date();

        const q = db.profile
          .as('p')
          .join(
            (q) => q.activeChats.as('c').where({ updatedAt: now }),
            (q) => q.where({ Title: 'title' }),
          )
          .select('Bio', 'c.Title');

        assertType<
          Awaited<typeof q>,
          { Bio: string | null; Title: string }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "c"."title" "Title"
            FROM "schema"."profile" "p"
            JOIN "schema"."chat" "c"
              ON "c"."title" = $1
             AND "c"."updated_at" = $2
             AND
               EXISTS (
                 SELECT 1 FROM "schema"."user" "activeUser"
                 WHERE "c"."active" = $3
                   AND EXISTS (
                     SELECT 1 FROM "schema"."chat_user"
                     WHERE "chat_user"."chat_id" = "c"."id_of_chat"
                       AND "chat_user"."chat_key" = "c"."chat_key"
                       AND "chat_user"."user_id" = "activeUser"."id"
                       AND "chat_user"."user_key" = "activeUser"."user_key"
                   )
                   AND "activeUser"."active" = $4
                   AND "activeUser"."id" = "p"."user_id"
                   AND "activeUser"."user_key" = "p"."profile_key"
               )
          `,
          ['title', now, true, true],
        );
      });

      it('should be supported in joinLateral', () => {
        const q = db.profile
          .joinLateral('chats', (q) => q.as('c').where({ Title: 'one' }))
          .where({ 'c.Title': 'two' })
          .select('Bio', { chat: 'c.*' });

        assertType<Awaited<typeof q>, { Bio: string | null; chat: Chat }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "Profile"."bio" "Bio", row_to_json("c".*) "chat"
            FROM "schema"."profile" "Profile"
            JOIN LATERAL (
              SELECT ${chatSelectAll}
              FROM "schema"."chat" "c"
              WHERE "c"."title" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user"
                  WHERE
                    EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "c"."id_of_chat"
                            AND "chat_user"."chat_key" = "c"."chat_key"
                        AND "chat_user"."user_id" = "user"."id"
                      AND "chat_user"."user_key" = "user"."user_key"
                    )
                    AND "user"."id" = "Profile"."user_id"
                    AND "user"."user_key" = "Profile"."profile_key"
                )
            ) "c" ON true
            WHERE "c"."Title" = $2
          `,
          ['one', 'two'],
        );
      });

      it('should be supported in joinLateral', () => {
        const q = db.profile
          .joinLateral('activeChats', (q) => q.as('c').where({ Title: 'one' }))
          .where({ 'c.Title': 'two' })
          .select('Bio', { chat: 'c.*' });

        assertType<Awaited<typeof q>, { Bio: string | null; chat: Chat }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "Profile"."bio" "Bio", row_to_json("c".*) "chat"
            FROM "schema"."profile" "Profile"
            JOIN LATERAL (
              SELECT ${chatSelectAll}
              FROM "schema"."chat" "c"
              WHERE "c"."title" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user" "activeUser"
                  WHERE "c"."active" = $2
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "c"."id_of_chat"
                            AND "chat_user"."chat_key" = "c"."chat_key"
                        AND "chat_user"."user_id" = "activeUser"."id"
                      AND "chat_user"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $3
                    AND "activeUser"."id" = "Profile"."user_id"
                    AND "activeUser"."user_key" = "Profile"."profile_key"
                )
            ) "c" ON true
            WHERE "c"."Title" = $4
          `,
          ['one', true, true, 'two'],
        );
      });
    });

    describe('select', () => {
      it('should be selectable', () => {
        const q = db.profile.as('p').select('Id', {
          chats: (q) => q.chats.where({ Title: 'title' }),
        });

        assertType<Awaited<typeof q>, { Id: number; chats: Chat[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("chats"."chats", '[]') "chats"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "chats"
              FROM (
                SELECT ${chatSelectAll}
                FROM "schema"."chat" "chats"
                WHERE "chats"."title" = $1
                  AND EXISTS (
                    SELECT 1 FROM "schema"."user"
                    WHERE EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                        AND "chat_user"."chat_key" = "chats"."chat_key"
                        AND "chat_user"."user_id" = "user"."id"
                      AND "chat_user"."user_key" = "user"."user_key"
                    )
                  AND "user"."id" = "p"."user_id"
                  AND "user"."user_key" = "p"."profile_key"
                )
              ) "t"
            ) "chats" ON true
          `,
          ['title'],
        );
      });

      it('should be selectable using `on`', () => {
        const q = db.profile.as('p').select('Id', {
          chats: (q) => q.activeChats.where({ Title: 'title' }),
        });

        assertType<Awaited<typeof q>, { Id: number; chats: Chat[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("chats"."chats", '[]') "chats"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "chats"
              FROM (
                SELECT ${chatSelectAll}
                FROM "schema"."chat" "activeChats"
                WHERE "activeChats"."title" = $1
                  AND EXISTS (
                  SELECT 1 FROM "schema"."user" "activeUser"
                  WHERE "activeChats"."active" = $2
                    AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                        AND "chat_user"."user_id" = "activeUser"."id"
                        AND "chat_user"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $3
                    AND "activeUser"."id" = "p"."user_id"
                    AND "activeUser"."user_key" = "p"."profile_key"
                )
              ) "t"
            ) "chats" ON true
          `,
          ['title', true, true],
        );
      });

      it('should support require() for inner join', () => {
        const q = db.profile.as('p').select('Id', {
          chats: (q) => q.chats.require(),
        });

        assertType<Awaited<typeof q>, { Id: number; chats: Chat[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              "chats"."chats" "chats"
            FROM "schema"."profile" "p"
            JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "chats"
              FROM (
                 SELECT ${chatSelectAll}
                 FROM "schema"."chat" "chats"
                 WHERE EXISTS (
                   SELECT 1 FROM "schema"."user"
                   WHERE EXISTS (
                     SELECT 1 FROM "schema"."chat_user"
                     WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                       AND "chat_user"."chat_key" = "chats"."chat_key"
                       AND "chat_user"."user_id" = "user"."id"
                       AND "chat_user"."user_key" = "user"."user_key"
                   )
                     AND "user"."id" = "p"."user_id"
                     AND "user"."user_key" = "p"."profile_key"
                 )
               ) "t"
            ) "chats" ON "chats"."chats" IS NOT NULL
          `,
        );
      });

      it('should allow to select count', () => {
        const q = db.profile.as('p').select('Id', {
          chatsCount: (q) => q.chats.count(),
        });

        assertType<Awaited<typeof q>, { Id: number; chatsCount: number }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              "chatsCount"."chatsCount" "chatsCount"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT count(*) "chatsCount"
              FROM "schema"."chat" "chats"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user"
                WHERE EXISTS (
                  SELECT 1 FROM "schema"."chat_user"
                  WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                    AND "chat_user"."chat_key" = "chats"."chat_key"
                    AND "chat_user"."user_id" = "user"."id"
                  AND "chat_user"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
              )
            ) "chatsCount" ON true
          `,
        );
      });

      it('should allow to select count using `on`', () => {
        const q = db.profile.as('p').select('Id', {
          chatsCount: (q) => q.activeChats.count(),
        });

        assertType<Awaited<typeof q>, { Id: number; chatsCount: number }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              "chatsCount"."chatsCount" "chatsCount"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT count(*) "chatsCount"
              FROM "schema"."chat" "activeChats"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "activeUser"
                WHERE "activeChats"."active" = $1
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                      AND "chat_user"."chat_key" = "activeChats"."chat_key"
                      AND "chat_user"."user_id" = "activeUser"."id"
                      AND "chat_user"."user_key" = "activeUser"."user_key"
                  )
                  AND "activeUser"."active" = $2
                  AND "activeUser"."id" = "p"."user_id"
                  AND "activeUser"."user_key" = "p"."profile_key"
              )
              ) "chatsCount" ON true
          `,
          [true, true],
        );
      });

      it('should allow to pluck values', () => {
        const q = db.profile.as('p').select('Id', {
          titles: (q) => q.chats.pluck('Title'),
        });

        assertType<Awaited<typeof q>, { Id: number; titles: string[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("titles"."titles", '[]') "titles"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT json_agg("t"."Title") "titles"
              FROM (
                SELECT "chats"."title" "Title"
                FROM "schema"."chat" "chats"
                WHERE EXISTS (
                  SELECT 1 FROM "schema"."user"
                  WHERE EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                      AND "chat_user"."chat_key" = "chats"."chat_key"
                      AND "chat_user"."user_id" = "user"."id"
                    AND "chat_user"."user_key" = "user"."user_key"
                  )
                  AND "user"."id" = "p"."user_id"
                  AND "user"."user_key" = "p"."profile_key"
                )
              ) "t"
            ) "titles" ON true
          `,
        );
      });

      it('should allow to pluck values using `on`', () => {
        const q = db.profile.as('p').select('Id', {
          titles: (q) => q.activeChats.pluck('Title'),
        });

        assertType<Awaited<typeof q>, { Id: number; titles: string[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("titles"."titles", '[]') "titles"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT json_agg("t"."Title") "titles"
              FROM (
                 SELECT "activeChats"."title" "Title"
                 FROM "schema"."chat" "activeChats"
                 WHERE EXISTS (
                   SELECT 1 FROM "schema"."user" "activeUser"
                   WHERE "activeChats"."active" = $1
                     AND EXISTS (
                       SELECT 1 FROM "schema"."chat_user"
                       WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                         AND "chat_user"."chat_key" = "activeChats"."chat_key"
                         AND "chat_user"."user_id" = "activeUser"."id"
                         AND "chat_user"."user_key" = "activeUser"."user_key"
                     )
                     AND "activeUser"."active" = $2
                     AND "activeUser"."id" = "p"."user_id"
                     AND "activeUser"."user_key" = "p"."profile_key"
                 )
              ) "t"
            ) "titles" ON true
          `,
          [true, true],
        );
      });

      it('should handle exists sub query', () => {
        const q = db.profile.as('p').select('Id', {
          hasChats: (q) => q.chats.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasChats: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("hasChats"."hasChats", false) "hasChats"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT true "hasChats"
              FROM "schema"."chat" "chats"
              WHERE EXISTS (
                  SELECT 1 FROM "schema"."user"
                  WHERE EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                      AND "chat_user"."chat_key" = "chats"."chat_key"
                      AND "chat_user"."user_id" = "user"."id"
                    AND "chat_user"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
              )
              LIMIT 1
            ) "hasChats" ON true
          `,
        );
      });

      it('should handle exists sub query using `on`', () => {
        const q = db.profile.as('p').select('Id', {
          hasChats: (q) => q.activeChats.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasChats: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("hasChats"."hasChats", false) "hasChats"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT true "hasChats"
              FROM "schema"."chat" "activeChats"
              WHERE EXISTS (
                  SELECT 1 FROM "schema"."user" "activeUser"
                  WHERE "activeChats"."active" = $1
                    AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                        AND "chat_user"."user_id" = "activeUser"."id"
                      AND "chat_user"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $2
                    AND "activeUser"."id" = "p"."user_id"
                    AND "activeUser"."user_key" = "p"."profile_key"
              )
              LIMIT 1
            ) "hasChats" ON true
          `,
          [true, true],
        );
      });

      it('should support recurring select', () => {
        const q = db.profile.select({
          chats: (q) =>
            q.chats.select({
              profiles: (q) =>
                q.profiles.select({
                  chats: (q) => q.chats,
                }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT COALESCE("chats"."chats", '[]') "chats"
            FROM "schema"."profile" "Profile"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "chats"
              FROM (
                SELECT COALESCE("profiles"."profiles", '[]') "profiles"
                FROM "schema"."chat" "chats"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json(t.*)) "profiles"
                  FROM (
                    SELECT COALESCE("chats2"."chats", '[]') "chats"
                    FROM "schema"."profile" "profiles"
                    LEFT JOIN LATERAL (
                      SELECT json_agg(row_to_json(t.*)) "chats"
                      FROM (
                        SELECT ${chatSelectAll}
                        FROM "schema"."chat" "chats2"
                        WHERE EXISTS (
                          SELECT 1
                          FROM "schema"."user"
                          WHERE
                            EXISTS (
                              SELECT 1
                              FROM "schema"."chat_user"
                              WHERE "chat_user"."chat_id" = "chats2"."id_of_chat"
                                AND "chat_user"."chat_key" = "chats2"."chat_key"
                                AND "chat_user"."user_id" = "user"."id"
                              AND "chat_user"."user_key" = "user"."user_key"
                            )
                            AND "user"."id" = "profiles"."user_id"
                            AND "user"."user_key" = "profiles"."profile_key"
                        )
                      ) "t"
                    ) "chats2" ON true
                    WHERE EXISTS (
                      SELECT 1
                      FROM "schema"."user" "users"
                      WHERE "profiles"."user_id" = "users"."id"
                        AND "profiles"."profile_key" = "users"."user_key"
                        AND EXISTS (
                          SELECT 1
                          FROM "schema"."chat_user"
                          WHERE "chat_user"."user_id" = "users"."id"
                            AND "chat_user"."user_key" = "users"."user_key"
                            AND "chat_user"."chat_id" = "chats"."id_of_chat"
                          AND "chat_user"."chat_key" = "chats"."chat_key"
                        )
                    )
                  ) "t"
                ) "profiles" ON true
                WHERE EXISTS (
                  SELECT 1
                  FROM "schema"."user"
                  WHERE EXISTS (
                    SELECT 1
                    FROM "schema"."chat_user"
                    WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                      AND "chat_user"."chat_key" = "chats"."chat_key"
                      AND "chat_user"."user_id" = "user"."id"
                    AND "chat_user"."user_key" = "user"."user_key"
                   ) AND "user"."id" = "Profile"."user_id"
                     AND "user"."user_key" = "Profile"."profile_key"
                )
              ) "t"
            ) "chats" ON true
          `,
        );
      });

      it('should support recurring select using `on`', () => {
        const q = db.profile.as('activeProfiles').select({
          activeChats: (q) =>
            q.activeChats.select({
              activeProfiles: (q) =>
                q.activeProfiles.select({
                  chats: (q) => q.activeChats,
                }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT COALESCE("activeChats"."activeChats", '[]') "activeChats"
            FROM "schema"."profile" "activeProfiles"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "activeChats"
              FROM (
                SELECT COALESCE("activeProfiles2"."activeProfiles", '[]') "activeProfiles"
                FROM "schema"."chat" "activeChats"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json(t.*)) "activeProfiles"
                  FROM (
                    SELECT COALESCE("chats"."chats", '[]') "chats"
                    FROM "schema"."profile" "activeProfiles2"
                    LEFT JOIN LATERAL (
                      SELECT json_agg(row_to_json(t.*)) "chats"
                      FROM (
                        SELECT ${chatSelectAll}
                        FROM "schema"."chat" "activeChats2"
                        WHERE EXISTS (
                          SELECT 1
                          FROM "schema"."user" "activeUser"
                          WHERE "activeChats2"."active" = $1
                            AND EXISTS (
                              SELECT 1
                              FROM "schema"."chat_user"
                              WHERE "chat_user"."chat_id" = "activeChats2"."id_of_chat"
                                AND "chat_user"."chat_key" = "activeChats2"."chat_key"
                                AND "chat_user"."user_id" = "activeUser"."id"
                                AND "chat_user"."user_key" = "activeUser"."user_key"
                            )
                            AND "activeUser"."active" = $2
                            AND "activeUser"."id" = "activeProfiles2"."user_id"
                            AND "activeUser"."user_key" = "activeProfiles2"."profile_key"
                        )
                      ) "t"
                    ) "chats" ON true
                    WHERE EXISTS (
                      SELECT 1
                      FROM "schema"."user" "activeUsers"
                      WHERE "activeProfiles2"."active" = $3
                        AND "activeProfiles2"."user_id" = "activeUsers"."id"
                        AND "activeProfiles2"."profile_key" = "activeUsers"."user_key"
                        AND "activeUsers"."active" = $4
                        AND EXISTS (
                          SELECT 1
                          FROM "schema"."chat_user"
                          WHERE "chat_user"."user_id" = "activeUsers"."id"
                            AND "chat_user"."user_key" = "activeUsers"."user_key"
                            AND "chat_user"."chat_id" = "activeChats"."id_of_chat"
                            AND "chat_user"."chat_key" = "activeChats"."chat_key"
                        )
                    )
                  ) "t"
                ) "activeProfiles2" ON true
                WHERE EXISTS (
                  SELECT 1
                  FROM "schema"."user" "activeUser"
                  WHERE "activeChats"."active" = $5
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                        AND "chat_user"."user_id" = "activeUser"."id"
                      AND "chat_user"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $6
                    AND "activeUser"."id" = "activeProfiles"."user_id"
                    AND "activeUser"."user_key" = "activeProfiles"."profile_key"
                )
              ) "t"
            ) "activeChats" ON true
          `,
          [true, true, true, true, true, true],
        );
      });
    });

    describe('where', () => {
      it('should be supported in a `where` callback', () => {
        const q = db.profile.where((q) =>
          q.chats.whereIn('Title', ['a', 'b']).count().equals(10),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile" WHERE (
              SELECT count(*) = $1
              FROM "schema"."chat" "chats"
              WHERE "chats"."title" IN ($2, $3)
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user"
                  WHERE
                    EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                        AND "chat_user"."chat_key" = "chats"."chat_key"
                        AND "chat_user"."user_id" = "user"."id"
                      AND "chat_user"."user_key" = "user"."user_key"
                    )
                     AND "user"."id" = "Profile"."user_id"
                     AND "user"."user_key" = "Profile"."profile_key"
                )
            )
          `,
          [10, 'a', 'b'],
        );
      });

      it('should be supported in a `where` callback using `on`', () => {
        const q = db.profile.where((q) =>
          q.activeChats.whereIn('Title', ['a', 'b']).count().equals(10),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile" WHERE (
              SELECT count(*) = $1
              FROM "schema"."chat" "activeChats"
              WHERE "activeChats"."title" IN ($2, $3)
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user" "activeUser"
                  WHERE "activeChats"."active" = $4
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                        AND "chat_user"."user_id" = "activeUser"."id"
                        AND "chat_user"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $5
                    AND "activeUser"."id" = "Profile"."user_id"
                    AND "activeUser"."user_key" = "Profile"."profile_key"
                )
            )
          `,
          [10, 'a', 'b', true, true],
        );
      });
    });
  });

  describe('through hasOne', () => {
    describe('queryRelated', () => {
      it('should support `queryRelated` to query related data', () => {
        const q = db.chat.queryRelated('profiles', {
          IdOfChat: 1,
          ChatKey: 'key',
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "users"
              WHERE "profiles"."user_id" = "users"."id"
                AND "profiles"."profile_key" = "users"."user_key"
              AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."user_id" = "users"."id"
                  AND "chat_user"."user_key" = "users"."user_key"
                  AND "chat_user"."chat_id" = $1
                  AND "chat_user"."chat_key" = $2
              )
            )
          `,
          [1, 'key'],
        );
      });

      it('should support `queryRelated` to query related data using `on`', () => {
        const q = db.chat.queryRelated('activeProfiles', {
          IdOfChat: 1,
          ChatKey: 'key',
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "activeProfiles"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "activeUsers"
              WHERE "activeProfiles"."active" = $1
                AND "activeProfiles"."user_id" = "activeUsers"."id"
                AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                AND "activeUsers"."active" = $2
                AND EXISTS (
                  SELECT 1 FROM "schema"."chat_user"
                  WHERE "chat_user"."user_id" = "activeUsers"."id"
                    AND "chat_user"."user_key" = "activeUsers"."user_key"
                    AND "chat_user"."chat_id" = $3
                    AND "chat_user"."chat_key" = $4
                )
            )
          `,
          [true, true, 1, 'key'],
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.chat.relations.profiles.joinQuery(
            db.profile.as('p'),
            db.chat.as('c'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."user" "users"
            WHERE "p"."user_id" = "users"."id"
              AND "p"."profile_key" = "users"."user_key"
              AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."user_id" = "users"."id"
                  AND "chat_user"."user_key" = "users"."user_key"
                  AND "chat_user"."chat_id" = "c"."id_of_chat"
                    AND "chat_user"."chat_key" = "c"."chat_key"
              )
          )
        `,
      );
    });

    describe('whereExists', () => {
      it('should be supported in whereExists', () => {
        expectSql(
          db.chat.whereExists('profiles').toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "Chat"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"  "profiles"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                       AND "chat_user"."chat_id" = "Chat"."id_of_chat"
                     AND "chat_user"."chat_key" = "Chat"."chat_key"
                  )
              )
            )
          `,
        );

        expectSql(
          db.chat
            .as('c')
            .whereExists((q) => q.profiles.where({ Bio: 'bio' }))
            .toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "c"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"  "profiles"
              WHERE "profiles"."bio" = $1
                AND EXISTS (
                  SELECT 1 FROM "schema"."user" "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "users"."id"
                        AND "chat_user"."user_key" = "users"."user_key"
                        AND "chat_user"."chat_id" = "c"."id_of_chat"
                          AND "chat_user"."chat_key" = "c"."chat_key"
                    )
                )
            )
          `,
          ['bio'],
        );

        expectSql(
          db.chat
            .as('c')
            .whereExists('profiles', (q) => q.where({ 'profiles.Bio': 'bio' }))
            .toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "c"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"  "profiles"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
              AND "profiles"."bio" = $1
            )
          `,
          ['bio'],
        );
      });

      it('should be supported in whereExists using `on`', () => {
        expectSql(
          db.chat.whereExists('activeProfiles').toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "Chat"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"  "activeProfiles"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "activeUsers"
                WHERE "activeProfiles"."active" = $1
                  AND "activeProfiles"."user_id" = "activeUsers"."id"
                  AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                  AND "activeUsers"."active" = $2
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "activeUsers"."id"
                      AND "chat_user"."user_key" = "activeUsers"."user_key"
                       AND "chat_user"."chat_id" = "Chat"."id_of_chat"
                     AND "chat_user"."chat_key" = "Chat"."chat_key"
                  )
              )
            )
          `,
          [true, true],
        );

        expectSql(
          db.chat
            .as('c')
            .whereExists((q) => q.activeProfiles.where({ Bio: 'bio' }))
            .toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "c"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"  "activeProfiles"
              WHERE "activeProfiles"."bio" = $1
                AND EXISTS (
                  SELECT 1 FROM "schema"."user" "activeUsers"
                  WHERE "activeProfiles"."active" = $2
                    AND "activeProfiles"."user_id" = "activeUsers"."id"
                    AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                    AND "activeUsers"."active" = $3
                    AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "activeUsers"."id"
                        AND "chat_user"."user_key" = "activeUsers"."user_key"
                        AND "chat_user"."chat_id" = "c"."id_of_chat"
                          AND "chat_user"."chat_key" = "c"."chat_key"
                    )
                )
            )
          `,
          ['bio', true, true],
        );

        expectSql(
          db.chat
            .as('c')
            .whereExists('activeProfiles', (q) =>
              q.where({ 'activeProfiles.Bio': 'bio' }),
            )
            .toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "c"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"  "activeProfiles"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "activeUsers"
                WHERE "activeProfiles"."active" = $1
                  AND "activeProfiles"."user_id" = "activeUsers"."id"
                  AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                  AND "activeUsers"."active" = $2
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "activeUsers"."id"
                      AND "chat_user"."user_key" = "activeUsers"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
              AND "activeProfiles"."bio" = $3
            )
          `,
          [true, true, 'bio'],
        );
      });
    });

    describe('join', () => {
      it('should be supported in join', () => {
        const q = db.chat
          .as('c')
          .join('profiles', (q) => q.where({ Bio: 'bio' }))
          .select('Title', 'profiles.Bio');

        assertType<
          Awaited<typeof q>,
          { Title: string; Bio: string | null }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "c"."title" "Title", "profiles"."bio" "Bio"
            FROM "schema"."chat" "c"
            JOIN "schema"."profile"  "profiles"
              ON EXISTS (
                SELECT 1 FROM "schema"."user" "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
              AND "profiles"."bio" = $1
          `,
          ['bio'],
        );
      });

      it('should be supported in join', () => {
        const q = db.chat
          .as('c')
          .join('activeProfiles', (q) => q.where({ Bio: 'bio' }))
          .select('Title', 'activeProfiles.Bio');

        assertType<
          Awaited<typeof q>,
          { Title: string; Bio: string | null }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "c"."title" "Title", "activeProfiles"."bio" "Bio"
            FROM "schema"."chat" "c"
            JOIN "schema"."profile"  "activeProfiles"
              ON EXISTS (
                SELECT 1 FROM "schema"."user" "activeUsers"
                WHERE "activeProfiles"."active" = $1
                  AND "activeProfiles"."user_id" = "activeUsers"."id"
                  AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                  AND "activeUsers"."active" = $2
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "activeUsers"."id"
                      AND "chat_user"."user_key" = "activeUsers"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
              AND "activeProfiles"."bio" = $3
          `,
          [true, true, 'bio'],
        );
      });

      it('should be supported in join with a callback', () => {
        const q = db.chat
          .as('c')
          .join(
            (q) => q.profiles.as('p').where({ UserId: 123 }),
            (q) => q.where({ Bio: 'bio' }),
          )
          .select('Title', 'p.Bio');

        assertType<
          Awaited<typeof q>,
          { Title: string; Bio: string | null }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "c"."title" "Title", "p"."bio" "Bio"
            FROM "schema"."chat" "c"
            JOIN "schema"."profile"  "p"
              ON "p"."bio" = $1
              AND "p"."user_id" = $2
              AND EXISTS (
                SELECT 1 FROM "schema"."user" "users"
                WHERE "p"."user_id" = "users"."id"
                  AND "p"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
          `,
          ['bio', 123],
        );
      });

      it('should be supported in join with a callback using `on`', () => {
        const q = db.chat
          .as('c')
          .join(
            (q) => q.activeProfiles.as('p').where({ UserId: 123 }),
            (q) => q.where({ Bio: 'bio' }),
          )
          .select('Title', 'p.Bio');

        assertType<
          Awaited<typeof q>,
          { Title: string; Bio: string | null }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "c"."title" "Title", "p"."bio" "Bio"
            FROM "schema"."chat" "c"
            JOIN "schema"."profile"  "p"
              ON "p"."bio" = $1
              AND "p"."user_id" = $2
              AND EXISTS (
                SELECT 1 FROM "schema"."user" "activeUsers"
                WHERE "p"."active" = $3
                  AND "p"."user_id" = "activeUsers"."id"
                  AND "p"."profile_key" = "activeUsers"."user_key"
                  AND "activeUsers"."active" = $4
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "activeUsers"."id"
                      AND "chat_user"."user_key" = "activeUsers"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
          `,
          ['bio', 123, true, true],
        );
      });

      it('should be supported in joinLateral', () => {
        const q = db.chat
          .joinLateral('profiles', (q) => q.as('p').where({ Bio: 'one' }))
          .where({ 'p.Bio': 'two' })
          .select('Title', { profile: 'p.*' });

        assertType<Awaited<typeof q>, { Title: string; profile: Profile }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "Chat"."title" "Title", row_to_json("p".*) "profile"
            FROM "schema"."chat" "Chat"
            JOIN LATERAL (
              SELECT ${ProfileSelectAll}
              FROM "schema"."profile" "p"
              WHERE "p"."bio" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user" "users"
                  WHERE "p"."user_id" = "users"."id"
                    AND "p"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "users"."id"
                        AND "chat_user"."user_key" = "users"."user_key"
                         AND "chat_user"."chat_id" = "Chat"."id_of_chat"
                       AND "chat_user"."chat_key" = "Chat"."chat_key"
                    )
                )
            ) "p" ON true
            WHERE "p"."Bio" = $2
          `,
          ['one', 'two'],
        );
      });

      it('should be supported in joinLateral', () => {
        const q = db.chat
          .joinLateral('activeProfiles', (q) => q.as('p').where({ Bio: 'one' }))
          .where({ 'p.Bio': 'two' })
          .select('Title', { profile: 'p.*' });

        assertType<Awaited<typeof q>, { Title: string; profile: Profile }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "Chat"."title" "Title", row_to_json("p".*) "profile"
            FROM "schema"."chat" "Chat"
            JOIN LATERAL (
              SELECT ${ProfileSelectAll}
              FROM "schema"."profile" "p"
              WHERE "p"."bio" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user" "activeUsers"
                  WHERE "p"."active" = $2
                    AND "p"."user_id" = "activeUsers"."id"
                    AND "p"."profile_key" = "activeUsers"."user_key"
                    AND "activeUsers"."active" = $3
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "activeUsers"."id"
                        AND "chat_user"."user_key" = "activeUsers"."user_key"
                         AND "chat_user"."chat_id" = "Chat"."id_of_chat"
                       AND "chat_user"."chat_key" = "Chat"."chat_key"
                    )
                )
            ) "p" ON true
            WHERE "p"."Bio" = $4
          `,
          ['one', true, true, 'two'],
        );
      });
    });

    describe('select', () => {
      it('should be selectable', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          profiles: (q) => q.profiles.where({ Bio: 'bio' }),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; profiles: Profile[] }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("profiles"."profiles", '[]') "profiles"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "profiles"
              FROM (
                SELECT ${ProfileSelectAll}
                FROM "schema"."profile" "profiles"
                WHERE "profiles"."bio" = $1
                  AND EXISTS (
                    SELECT 1 FROM "schema"."user" "users"
                    WHERE "profiles"."user_id" = "users"."id"
                      AND "profiles"."profile_key" = "users"."user_key"
                      AND EXISTS (
                        SELECT 1 FROM "schema"."chat_user"
                        WHERE "chat_user"."user_id" = "users"."id"
                          AND "chat_user"."user_key" = "users"."user_key"
                          AND "chat_user"."chat_id" = "c"."id_of_chat"
                          AND "chat_user"."chat_key" = "c"."chat_key"
                      )
                  )
              ) "t"
            ) "profiles" ON true
          `,
          ['bio'],
        );
      });

      it('should be selectable using `on`', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          profiles: (q) => q.activeProfiles.where({ Bio: 'bio' }),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; profiles: Profile[] }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("profiles"."profiles", '[]') "profiles"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "profiles"
              FROM (
                SELECT ${ProfileSelectAll}
                FROM "schema"."profile" "activeProfiles"
                WHERE "activeProfiles"."bio" = $1
                  AND EXISTS (
                  SELECT 1 FROM "schema"."user" "activeUsers"
                  WHERE "activeProfiles"."active" = $2
                    AND "activeProfiles"."user_id" = "activeUsers"."id"
                    AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                    AND "activeUsers"."active" = $3
                    AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "activeUsers"."id"
                      AND "chat_user"."user_key" = "activeUsers"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                      AND "chat_user"."chat_key" = "c"."chat_key"
                  )
                )
              ) "t"
            ) "profiles" ON true
          `,
          ['bio', true, true],
        );
      });

      it('should support require() for inner join', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          profiles: (q) => q.profiles.require(),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              "profiles"."profiles" "profiles"
            FROM "schema"."chat" "c"
            JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "profiles"
              FROM (
                SELECT ${ProfileSelectAll}
                FROM "schema"."profile" "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "schema"."user" "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                      AND "chat_user"."chat_key" = "c"."chat_key"
                    )
                )
              ) "t"
            ) "profiles" ON "profiles"."profiles" IS NOT NULL
          `,
        );
      });

      it('should allow to select count', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          profilesCount: (q) => q.profiles.count(),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; profilesCount: number }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              "profilesCount"."profilesCount" "profilesCount"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT count(*) "profilesCount"
              FROM "schema"."profile" "profiles"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                      AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
            ) "profilesCount" ON true
          `,
          [],
        );
      });

      it('should allow to select count using `on`', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          profilesCount: (q) => q.activeProfiles.count(),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; profilesCount: number }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              "profilesCount"."profilesCount" "profilesCount"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT count(*) "profilesCount"
              FROM "schema"."profile" "activeProfiles"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user" "activeUsers"
                WHERE "activeProfiles"."active" = $1
                  AND "activeProfiles"."user_id" = "activeUsers"."id"
                  AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                  AND "activeUsers"."active" = $2
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "activeUsers"."id"
                      AND "chat_user"."user_key" = "activeUsers"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                      AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
              ) "profilesCount" ON true
          `,
          [true, true],
        );
      });

      it('should allow to pluck values', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          bios: (q) => q.profiles.pluck('Bio'),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; bios: (string | null)[] }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("bios"."bios", '[]') "bios"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT json_agg("t"."Bio") "bios"
              FROM (
                SELECT "profiles"."bio" "Bio"
                FROM "schema"."profile" "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "schema"."user" "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "users"."id"
                        AND "chat_user"."user_key" = "users"."user_key"
                        AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                    )
                )
              ) "t"
            ) "bios" ON true
          `,
        );
      });

      it('should allow to pluck values using `on`', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          bios: (q) => q.activeProfiles.pluck('Bio'),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; bios: (string | null)[] }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("bios"."bios", '[]') "bios"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT json_agg("t"."Bio") "bios"
              FROM (
                SELECT "activeProfiles"."bio" "Bio"
                FROM "schema"."profile" "activeProfiles"
                WHERE EXISTS (
                  SELECT 1 FROM "schema"."user" "activeUsers"
                  WHERE "activeProfiles"."active" = $1
                    AND "activeProfiles"."user_id" = "activeUsers"."id"
                    AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                    AND "activeUsers"."active" = $2
                    AND EXISTS (
                      SELECT 1 FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "activeUsers"."id"
                        AND "chat_user"."user_key" = "activeUsers"."user_key"
                        AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                    )
                )
              ) "t"
            ) "bios" ON true
          `,
          [true, true],
        );
      });

      it('should handle exists sub query', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          hasProfiles: (q) => q.profiles.exists(),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; hasProfiles: boolean }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("hasProfiles"."hasProfiles", false) "hasProfiles"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT true "hasProfiles"
              FROM "schema"."profile" "profiles"
              WHERE EXISTS (
                SELECT 1
                FROM "schema"."user" "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
              LIMIT 1
            ) "hasProfiles" ON true
          `,
        );
      });

      it('should handle exists sub query using `on`', () => {
        const q = db.chat.as('c').select('IdOfChat', {
          hasProfiles: (q) => q.activeProfiles.exists(),
        });

        assertType<
          Awaited<typeof q>,
          { IdOfChat: number; hasProfiles: boolean }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("hasProfiles"."hasProfiles", false) "hasProfiles"
            FROM "schema"."chat" "c"
            LEFT JOIN LATERAL (
              SELECT true "hasProfiles"
              FROM "schema"."profile" "activeProfiles"
              WHERE EXISTS (
                SELECT 1
                FROM "schema"."user" "activeUsers"
                WHERE "activeProfiles"."active" = $1
                  AND "activeProfiles"."user_id" = "activeUsers"."id"
                  AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                  AND "activeUsers"."active" = $2
                  AND EXISTS (
                    SELECT 1 FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "activeUsers"."id"
                      AND "chat_user"."user_key" = "activeUsers"."user_key"
                      AND "chat_user"."chat_id" = "c"."id_of_chat"
                        AND "chat_user"."chat_key" = "c"."chat_key"
                  )
              )
              LIMIT 1
            ) "hasProfiles" ON true
          `,
          [true, true],
        );
      });

      it('should support recurring select', () => {
        const q = db.chat.select({
          profiles: (q) =>
            q.profiles.select({
              chats: (q) =>
                q.chats.select({
                  profiles: (q) => q.profiles,
                }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT COALESCE("profiles"."profiles", '[]') "profiles"
            FROM "schema"."chat" "Chat"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "profiles"
              FROM (
                SELECT COALESCE("chats"."chats", '[]') "chats"
                FROM "schema"."profile" "profiles"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json(t.*)) "chats"
                  FROM (
                    SELECT COALESCE("profiles2"."profiles", '[]') "profiles"
                    FROM "schema"."chat" "chats"
                    LEFT JOIN LATERAL (
                      SELECT json_agg(row_to_json(t.*)) "profiles"
                      FROM (
                        SELECT ${ProfileSelectAll}
                        FROM "schema"."profile" "profiles2"
                        WHERE EXISTS (
                          SELECT 1
                          FROM "schema"."user" "users"
                          WHERE "profiles2"."user_id" = "users"."id"
                            AND "profiles2"."profile_key" = "users"."user_key"
                          AND EXISTS (
                            SELECT 1
                            FROM "schema"."chat_user"
                            WHERE "chat_user"."user_id" = "users"."id"
                              AND "chat_user"."user_key" = "users"."user_key"
                              AND "chat_user"."chat_id" = "chats"."id_of_chat"
                            AND "chat_user"."chat_key" = "chats"."chat_key"
                          )
                      )
                    ) "t"
                  ) "profiles2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "schema"."user"
                    WHERE
                      EXISTS (
                        SELECT 1
                        FROM "schema"."chat_user"
                        WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                          AND "chat_user"."chat_key" = "chats"."chat_key"
                          AND "chat_user"."user_id" = "user"."id"
                          AND "chat_user"."user_key" = "user"."user_key"
                      )
                      AND "user"."id" = "profiles"."user_id"
                      AND "user"."user_key" = "profiles"."profile_key"
                  )
                ) "t"
              ) "chats" ON true
                WHERE EXISTS (
                  SELECT 1
                  FROM "schema"."user" "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "users"."id"
                        AND "chat_user"."user_key" = "users"."user_key"
                         AND "chat_user"."chat_id" = "Chat"."id_of_chat"
                         AND "chat_user"."chat_key" = "Chat"."chat_key"
                    )
                )
              ) "t"
            ) "profiles" ON true
          `,
        );
      });

      it('should support recurring select using `on`', () => {
        const q = db.chat.as('activeChats').select({
          activeProfiles: (q) =>
            q.activeProfiles.select({
              activeChats: (q) =>
                q.activeChats.select({
                  activeProfiles: (q) => q.activeProfiles,
                }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT COALESCE("activeProfiles"."activeProfiles", '[]') "activeProfiles"
            FROM "schema"."chat" "activeChats"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) "activeProfiles"
              FROM (
                SELECT COALESCE("activeChats2"."activeChats", '[]') "activeChats"
                FROM "schema"."profile" "activeProfiles"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json(t.*)) "activeChats"
                  FROM (
                    SELECT COALESCE("activeProfiles2"."activeProfiles", '[]') "activeProfiles"
                    FROM "schema"."chat" "activeChats2"
                    LEFT JOIN LATERAL (
                      SELECT json_agg(row_to_json(t.*)) "activeProfiles"
                      FROM (
                        SELECT ${ProfileSelectAll}
                        FROM "schema"."profile" "activeProfiles2"
                        WHERE EXISTS (
                          SELECT 1
                          FROM "schema"."user" "activeUsers"
                          WHERE "activeProfiles2"."active" = $1
                            AND "activeProfiles2"."user_id" = "activeUsers"."id"
                            AND "activeProfiles2"."profile_key" = "activeUsers"."user_key"
                            AND "activeUsers"."active" = $2
                            AND EXISTS (
                              SELECT 1
                              FROM "schema"."chat_user"
                              WHERE "chat_user"."user_id" = "activeUsers"."id"
                                AND "chat_user"."user_key" = "activeUsers"."user_key"
                                AND "chat_user"."chat_id" = "activeChats2"."id_of_chat"
                              AND "chat_user"."chat_key" = "activeChats2"."chat_key"
                            )
                      )
                    ) "t"
                  ) "activeProfiles2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "schema"."user" "activeUser"
                    WHERE "activeChats2"."active" = $3
                      AND EXISTS (
                        SELECT 1
                        FROM "schema"."chat_user"
                        WHERE "chat_user"."chat_id" = "activeChats2"."id_of_chat"
                          AND "chat_user"."chat_key" = "activeChats2"."chat_key"
                          AND "chat_user"."user_id" = "activeUser"."id"
                          AND "chat_user"."user_key" = "activeUser"."user_key"
                      )
                      AND "activeUser"."active" = $4
                      AND "activeUser"."id" = "activeProfiles"."user_id"
                      AND "activeUser"."user_key" = "activeProfiles"."profile_key"
                  )
                ) "t"
              ) "activeChats2" ON true
              WHERE
                EXISTS (
                  SELECT 1
                  FROM "schema"."user" "activeUsers"
                  WHERE "activeProfiles"."active" = $5
                    AND "activeProfiles"."user_id" = "activeUsers"."id"
                    AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                    AND "activeUsers"."active" = $6
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "activeUsers"."id"
                        AND "chat_user"."user_key" = "activeUsers"."user_key"
                        AND "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                    )
                )
              ) "t"
            ) "activeProfiles" ON true
          `,
          [true, true, true, true, true, true],
        );
      });
    });

    describe('where', () => {
      it('should be supported in a `where` callback', () => {
        const q = db.chat.where((q) =>
          q.profiles.whereIn('Bio', ['a', 'b']).count().equals(10),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "Chat" WHERE (
              SELECT count(*) = $1
              FROM "schema"."profile" "profiles"
              WHERE "profiles"."bio" IN ($2, $3)
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user" "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "users"."id"
                        AND "chat_user"."user_key" = "users"."user_key"
                         AND "chat_user"."chat_id" = "Chat"."id_of_chat"
                         AND "chat_user"."chat_key" = "Chat"."chat_key"
                    )
                )
            )
          `,
          [10, 'a', 'b'],
        );
      });

      it('should be supported in a `where` callback using `on`', () => {
        const q = db.chat.where((q) =>
          q.activeProfiles.whereIn('Bio', ['a', 'b']).count().equals(10),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${chatSelectAll} FROM "schema"."chat" "Chat" WHERE (
              SELECT count(*) = $1
              FROM "schema"."profile" "activeProfiles"
              WHERE "activeProfiles"."bio" IN ($2, $3)
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."user" "activeUsers"
                  WHERE "activeProfiles"."active" = $4
                    AND "activeProfiles"."user_id" = "activeUsers"."id"
                    AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                    AND "activeUsers"."active" = $5
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "activeUsers"."id"
                        AND "chat_user"."user_key" = "activeUsers"."user_key"
                         AND "chat_user"."chat_id" = "Chat"."id_of_chat"
                         AND "chat_user"."chat_key" = "Chat"."chat_key"
                    )
                )
            )
          `,
          [10, 'a', 'b', true, true],
        );
      });
    });
  });
});
