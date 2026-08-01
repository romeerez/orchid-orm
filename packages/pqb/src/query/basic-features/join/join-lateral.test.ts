import { messageData } from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  ChatData,
  db,
  expectSql,
  Message,
  MessageColumnsSql,
  MessageJsonBuildObject,
  UserData,
  UserSelectAllWithTable,
  useTestDatabase,
} from 'test-utils';

const insertUserAndMessage = async () => {
  const authorId = await db.user.get('Id').create(UserData);
  const chatId = await db.chat.get('IdOfChat').create(ChatData);
  await db.message.create({
    ...messageData,
    AuthorId: authorId,
    ChatId: chatId,
  });
};

describe('joinLateral', () => {
  useTestDatabase();

  it('should ignore duplicated joins', () => {
    const q = db.user.joinLateral(db.message, (q) =>
      q.on('AuthorId', 'User.Id'),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAllWithTable} FROM "schema"."user" "User"
        JOIN LATERAL (
          SELECT ${MessageColumnsSql}
          FROM "schema"."message" "Message"
          WHERE ("Message"."author_id" = "User"."id")
            AND ("Message"."deleted_at" IS NULL)
        ) "Message" ON true
      `,
    );
  });

  it('should join query, use joined columns in select and where', async () => {
    await insertUserAndMessage();

    const q = db.user
      .joinLateral(db.message.as('m'), (q) =>
        q
          .select('Text', 'createdAt')
          .where({ Text: messageData.Text, 'User.Name': UserData.Name })
          .on('AuthorId', 'User.Id')
          .order({ createdAt: 'DESC' }),
      )
      .select('Id', 'm.createdAt')
      .where({ 'm.Text': messageData.Text });

    assertType<Awaited<typeof q>, { Id: number; createdAt: Date }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" "Id", "m"."createdAt"
        FROM "schema"."user" "User"
        JOIN LATERAL (
          SELECT "m"."text" "Text", "m"."created_at" "createdAt"
          FROM "schema"."message" "m"
          WHERE ("m"."text" = $1
            AND "User"."name" = $2
            AND "m"."author_id" = "User"."id")
            AND ("m"."deleted_at" IS NULL)
          ORDER BY "m"."created_at" DESC
        ) "m" ON true
        WHERE "m"."Text" = $3
      `,
      [messageData.Text, UserData.Name, messageData.Text],
    );

    const data = await q;
    expect(data).toEqual([
      {
        Id: expect.any(Number),
        createdAt: expect.any(Date),
      },
    ]);
  });

  it('should join and select a full record', async () => {
    await insertUserAndMessage();

    const q = db.user
      .joinLateral(db.message.as('m'), (q) =>
        q.on('AuthorId', 'User.Id').order({ createdAt: 'DESC' }),
      )
      .select('Id', 'm.*');

    assertType<Awaited<typeof q>, { Id: number; m: Message }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" "Id", ${MessageJsonBuildObject('m')}
        FROM "schema"."user" "User"
        JOIN LATERAL (
          SELECT ${MessageColumnsSql}
          FROM "schema"."message" "m"
          WHERE ("m"."author_id" = "User"."id")
            AND ("m"."deleted_at" IS NULL)
          ORDER BY "m"."created_at" DESC
        ) "m" ON true
      `,
    );

    const data = await q;
    expect(data).toEqual([
      {
        Id: expect.any(Number),
        m: {
          Id: expect.any(Number),
          MessageKey: messageData.MessageKey,
          AuthorId: expect.any(Number),
          ChatId: expect.any(Number),
          Text: messageData.Text,
          Decimal: null,
          Active: null,
          DeletedAt: null,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        },
      },
    ]);
  });

  it('should make joined columns nullable for leftJoinLateral', () => {
    const q = db.user
      .leftJoinLateral(db.message.as('m'), (q) => q)
      .select('Id', 'm.Text');

    assertType<Awaited<typeof q>, { Id: number; Text: string | null }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" "Id", "m"."Text"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT ${MessageColumnsSql}
          FROM "schema"."message" "m"
          WHERE ("m"."deleted_at" IS NULL)
        ) "m" ON true
      `,
    );
  });

  it('should make joined table object nullable for leftJoinLateral', () => {
    const q = db.user
      .leftJoinLateral(db.message.as('m'), (q) => q)
      .select('Id', 'm.*');

    assertType<Awaited<typeof q>, { Id: number; m: Message | undefined }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" "Id", ${MessageJsonBuildObject('m')}
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT ${MessageColumnsSql}
          FROM "schema"."message" "m"
          WHERE ("m"."deleted_at" IS NULL)
        ) "m" ON true
      `,
    );
  });
});
