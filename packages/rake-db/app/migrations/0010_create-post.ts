import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.post', (t) => ({
    id: t.id(),
    title: t.text(),
    body: t.text(),
    generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
});
