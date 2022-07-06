import { Migration } from 'rake-db';

export const change = async (db: Migration, up: boolean) => {
  if (up) {
    await db.exec('CREATE SCHEMA geo');
  } else {
    await db.exec('DROP SCHEMA geo');
  }
};
