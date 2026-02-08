import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.message', (t) => ({
    id: t.id(),
    messageKey: t.text().nullable(),
    chatId: t.integer().foreignKey('schema.chat', 'idOfChat').index(),
    authorId: t.integer().foreignKey('schema.user', 'id').nullable().index(),
    text: t.text(),
    decimal: t.decimal().nullable(),
    meta: t.json().nullable(),
    active: t.boolean().nullable(),
    deletedAt: t.timestamp().nullable(),
    ...t.timestamps(),
  }));
});
