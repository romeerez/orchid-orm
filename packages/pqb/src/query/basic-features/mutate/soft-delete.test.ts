import { db, expectSql, testAdapter, testColumnTypes } from 'test-utils';
import { createDbWithAdapter } from '../../db';

const messageColumnsSql = db.message.q.selectAllColumns!.join(', ');

describe('softDelete', () => {
  it('should throw on empty effective where filter for delete and hardDelete', () => {
    expect(() => db.message.where({}).delete().toSQL()).toThrow(
      'Dangerous update without conditions',
    );
    expect(() => db.message.where({}).hardDelete().toSQL()).toThrow(
      'Dangerous delete without conditions',
    );
  });

  it('should have nonDeleted scope enabled by default', () => {
    expectSql(
      db.message.toSQL(),
      `
          SELECT ${messageColumnsSql} FROM "schema"."message" "Message"
          WHERE ("Message"."deleted_at" IS NULL)
        `,
    );
  });

  it('should have `includeDeleted` method to query all records', () => {
    expectSql(
      db.message.includeDeleted().toSQL(),
      `SELECT ${messageColumnsSql} FROM "schema"."message" "Message"`,
    );
  });

  it('should not apply soft delete filter to a relation join with `includeDeleted`', () => {
    const q = db.user.select('Id').join((q) => q.messages.includeDeleted());

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" "Id"
        FROM "schema"."user" "User"
        JOIN "schema"."message" "messages" ON
          "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
      `,
    );
  });

  it('should not apply soft delete filter to a selected relation with `includeDeleted`', () => {
    const q = db.user.select({
      messages: (q) => q.messages.select('Id').includeDeleted(),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT COALESCE("messages"."messages", '[]') "messages"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json(t.*)) "messages"
          FROM (
            SELECT "messages"."id" "Id"
            FROM "schema"."message" "messages"
            WHERE "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
          ) "t"
        ) "messages" ON true`,
    );
  });

  it('should set deletedAt to current time instead of deleting', () => {
    const q = db.message.all().delete();
    expectSql(
      q.toSQL(),
      `
        UPDATE "schema"."message" "Message"
           SET "deleted_at" = now(), "updated_at" = now()
         WHERE ("Message"."deleted_at" IS NULL)
      `,
    );
  });

  it('should respect `nowSql` option', () => {
    const customDb = createDbWithAdapter({
      snakeCase: true,
      adapter: testAdapter,
      columnTypes: testColumnTypes,
      nowSQL: 'CURRENT_TIMESTAMP',
    });

    const MessageSoftDelete = customDb(
      'message',
      (t) => ({
        Id: t.name('id').identity().primaryKey(),
        MessageKey: t.name('message_key').text(),
        ChatId: t.name('chat_id').integer(),
        AuthorId: t.name('author_id').integer().nullable(),
        Text: t.name('text').text(),
        Decimal: t.name('decimal').decimal().nullable(),
        Active: t.name('active').boolean().nullable(),
        DeletedAt: t.name('deleted_at').timestamp().nullable(),
        createdAt: t.name('created_at').timestamp(),
        updatedAt: t.name('updated_at').timestamp(),
      }),
      undefined,
      {
        schema: () => 'schema',
        softDelete: 'DeletedAt',
      },
    );

    const q = MessageSoftDelete.all().delete();
    expectSql(
      q.toSQL(),
      `
        UPDATE "schema"."message"
           SET "deleted_at" = CURRENT_TIMESTAMP
         WHERE ("message"."deleted_at" IS NULL)
      `,
    );
  });

  it('should delete records for real with `hardDelete`', () => {
    const q = db.message.all().hardDelete();
    expectSql(
      q.toSQL(),
      `
        DELETE FROM "schema"."message" "Message"
      `,
    );
  });

  it('should allow all with an empty effective where filter', () => {
    expectSql(
      db.message.all().where({ Id: undefined }).delete().toSQL(),
      `
        UPDATE "schema"."message" "Message" SET "deleted_at" = now(), "updated_at" = now()
        WHERE ("Message"."deleted_at" IS NULL)
      `,
    );

    expectSql(
      db.message.all().where({ Id: undefined }).hardDelete().toSQL(),
      `
        DELETE FROM "schema"."message" "Message"
      `,
    );
  });
});
