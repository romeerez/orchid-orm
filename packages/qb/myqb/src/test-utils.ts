import { Adapter } from './adapter';

export const adapter = new Adapter({
  databaseURL: process.env.MYSQL_URL as string,
});
