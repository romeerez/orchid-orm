import { Migration } from 'rake-db';

export const change = (db: Migration) => {
  db.createTable('message', (t) => {
    t.integer('chatId').required().references('chat', 'id').index();
    t.integer('authorId').references('user', 'id').index();
    t.text('text').required();
    t.jsonb('meta');
    t.timestamps();
  });
};
