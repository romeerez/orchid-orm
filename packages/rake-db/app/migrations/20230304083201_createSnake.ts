import { change } from '../../src';

change(async (db) => {
  await db.createTable('snake', (t) => ({
    snake_name: t.text().primaryKey(),
    tailLength: t.name('tail_length').integer(),
    ...t.timestamps(),
  }));
});
