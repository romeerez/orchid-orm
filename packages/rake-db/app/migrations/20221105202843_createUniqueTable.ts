import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('uniqueTable', (t) => ({
    id: t.id(),
    one: t.text().unique(),
    two: t.integer().unique(),
    thirdColumn: t.text(),
    fourthColumn: t.integer(),
    ...t.unique(['thirdColumn', 'fourthColumn']),
  }));
});
