import { orchidORM } from 'orchid-orm';

export const db = orchidORM(
  {
    databaseURL: process.env.PG_URL,
  },
  {},
);
