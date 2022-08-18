import { Migration } from 'rake-db';

export const change = (db: Migration) => {
  db.createTable('user', (t) => {
    t.text('name').required();
    t.text('password').required();
    t.text('picture');
    t.jsonb('data');
    t.integer('age');
    t.boolean('active');
    t.timestamps();
  });
};
