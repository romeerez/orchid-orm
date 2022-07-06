import { Migration } from 'rake-db';

export const change = (db: Migration) => {
  db.createTable('profile', (t) => {
    t.integer('userId').required().references('user', 'id');
    t.text('bio');
    t.timestamps();
  });
};
