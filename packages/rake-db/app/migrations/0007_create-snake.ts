import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.snake', (t) => ({
    snakeId: t.name('snake_id').identity().primaryKey(),
    snake_name: t.text(),
    tailLength: t.name('tail_length').integer(),
    snakeData: t.name('snake_data').json().nullable(),
    updated_at: t.timestamps().updatedAt,
    created_at: t.timestamps().createdAt,
  }));
});
