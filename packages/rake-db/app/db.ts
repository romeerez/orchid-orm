import { orchidORM } from 'orchid-orm';
import { SnakeTable } from './tables/snake';

export const db = orchidORM(
  {
    databaseURL: process.env.PG_URL,
  },
  {
    snake: SnakeTable,
  },
);
