import { change } from '../db-script';

change(async (db) => {
  await db.createTable(
    'schema.uniqueTable',
    (t) => ({
      id: t.id(),
      one: t.text().unique(),
      two: t.integer().unique(),
      thirdColumn: t.text(),
      fourthColumn: t.integer(),
    }),
    (t) => t.unique(['thirdColumn', 'fourthColumn']),
  );
});
