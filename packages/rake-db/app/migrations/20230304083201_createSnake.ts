import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('snake', (t) => ({
    snakeId: t.name('snake_id').identity().primaryKey(),
    snake_name: t.text(),
    tailLength: t.name('tail_length').integer(),
    snakeData: t.name('snake_data').json().nullable(),
    ...t.timestampsSnakeCase(),
  }));
});
