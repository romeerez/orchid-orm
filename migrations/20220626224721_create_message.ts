import { Migration } from 'rake-db';

export const change = (db: Migration) => {
  db.createTable('message', (t) => {
    t.integer('chatId').required().references('chat', 'id').index();
    t.integer('authorId').required().references('user', 'id').index();
    t.text('text').required();
    t.timestamps();
  });
};
