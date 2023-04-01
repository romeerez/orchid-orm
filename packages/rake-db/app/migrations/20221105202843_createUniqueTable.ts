import { change } from '../../src';

change(async (db) => {
  await db.createTable('uniqueTable', (t) => ({
    id: t.identity().primaryKey(),
    one: t.text().unique(),
    two: t.integer().unique(),
    thirdColumn: t.text(),
    fourthColumn: t.integer(),
    ...t.unique(['thirdColumn', 'fourthColumn']),
  }));
});
