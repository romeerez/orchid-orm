import {
  Chat,
  chatData,
  Message,
  messageColumnsSql,
  messageData,
  MessageRecord,
  User,
  userData,
  userTableColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { assertType, expectSql, useTestDatabase } from 'test-utils';

const insertUserAndMessage = async () => {
  const authorId = await User.get('id').create(userData);
  const chatId = await Chat.get('idOfChat').create(chatData);
  await Message.create({ ...messageData, authorId, chatId });
};

describe('joinLateral', () => {
  useTestDatabase();

  it('should ignore duplicated joins', () => {
    const q = User.joinLateral(Message, (q) => q.on('authorId', 'User.id'));

    expectSql(
      q.toSQL(),
      `
        SELECT ${userTableColumnsSql} FROM "schema"."user" "User"
        JOIN LATERAL (
          SELECT ${messageColumnsSql}
          FROM "schema"."message" "Message"
          WHERE "Message"."author_id" = "User"."id"
        ) "Message" ON true
      `,
    );
  });

  it('should join query, use joined columns in select and where', async () => {
    await insertUserAndMessage();

    const q = User.joinLateral(Message.as('m'), (q) =>
      q
        .select('text', 'createdAt')
        .where({ text: messageData.text, 'User.name': userData.name })
        .on('authorId', 'User.id')
        .order({ createdAt: 'DESC' }),
    )
      .select('id', 'm.createdAt')
      .where({ 'm.text': messageData.text });

    assertType<Awaited<typeof q>, { id: number; createdAt: Date }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id", "m"."createdAt"
        FROM "schema"."user" "User"
        JOIN LATERAL (
          SELECT "m"."text", "m"."created_at" "createdAt"
          FROM "schema"."message" "m"
          WHERE "m"."text" = $1
            AND "User"."name" = $2
            AND "m"."author_id" = "User"."id"
          ORDER BY "m"."created_at" DESC
        ) "m" ON true
        WHERE "m"."text" = $3
      `,
      [messageData.text, userData.name, messageData.text],
    );

    const data = await q;
    expect(data).toEqual([
      {
        id: expect.any(Number),
        createdAt: expect.any(Date),
      },
    ]);
  });

  it('should join and select a full record', async () => {
    await insertUserAndMessage();

    const q = User.joinLateral(Message.as('m'), (q) =>
      q.on('authorId', 'User.id').order({ createdAt: 'DESC' }),
    ).select('id', 'm.*');

    assertType<Awaited<typeof q>, { id: number; m: MessageRecord }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id", row_to_json("m".*) "m"
        FROM "schema"."user" "User"
        JOIN LATERAL (
          SELECT ${messageColumnsSql}
          FROM "schema"."message" "m"
          WHERE "m"."author_id" = "User"."id"
          ORDER BY "m"."created_at" DESC
        ) "m" ON true
      `,
    );

    const data = await q;
    expect(data).toEqual([
      {
        id: expect.any(Number),
        m: {
          id: expect.any(Number),
          authorId: expect.any(Number),
          chatId: expect.any(Number),
          meta: null,
          text: messageData.text,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        },
      },
    ]);
  });

  it('should make joined columns nullable for leftJoinLateral', () => {
    const q = User.leftJoinLateral(Message.as('m'), (q) => q).select(
      'id',
      'm.text',
    );

    assertType<Awaited<typeof q>, { id: number; text: string | null }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id", "m"."text"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT ${messageColumnsSql}
          FROM "schema"."message" "m"
        ) "m" ON true
      `,
    );
  });

  it('should make joined table object nullable for leftJoinLateral', () => {
    const q = User.leftJoinLateral(Message.as('m'), (q) => q).select(
      'id',
      'm.*',
    );

    assertType<
      Awaited<typeof q>,
      { id: number; m: MessageRecord | undefined }[]
    >();

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id", row_to_json("m".*) "m"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT ${messageColumnsSql}
          FROM "schema"."message" "m"
        ) "m" ON true
      `,
    );
  });
});
