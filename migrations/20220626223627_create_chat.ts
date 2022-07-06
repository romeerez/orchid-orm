import { Migration } from 'rake-db';

export const change = (db: Migration) => {
  db.createTable('chat', (t) => {
    t.text('title').required();
    t.timestamps();
  });
};
