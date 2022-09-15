import { Migration } from 'rake-db';

export const change = (db: Migration) => {
  db.createTable('profile', (t) => {
    t.integer('userId').references('user', 'id');
    t.text('bio');
    t.timestamps();
  });
};
