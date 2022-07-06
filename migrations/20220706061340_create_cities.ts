import { Migration } from 'rake-db';

export const before = async (db: Migration) => {
  await db.exec('SET search_path TO geo');
};

export const after = async (db: Migration) => {
  await db.exec('SET search_path TO public');
};

export const change = async (db: Migration) => {
  db.createTable('city', (t) => {
    t.text('name').required();
    t.integer('countryId').required().references('country', 'id');
  });
};
