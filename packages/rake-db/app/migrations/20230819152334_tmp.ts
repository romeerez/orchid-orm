import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('test', (t) => ({
    id: t.uuid().primaryKey(),
    data: t.json((t) =>
      t.object({
        foo: t.string(),
      }),
    ),
  }));
});
