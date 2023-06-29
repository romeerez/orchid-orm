import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.id(),
    title: t.text(),
    body: t.text(),
    generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
    ...t.timestamps(),
  }));
});
