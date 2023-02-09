import { Adapter } from './adapter';

export const adapter = new Adapter({
  databaseURL: process.env.DATABASE_URL as string,
});
