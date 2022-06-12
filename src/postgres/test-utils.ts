import { PostgresOrm } from './orm';
import { Pg } from './pg.adapter';
import { model } from './model';

export const pgConfig = {
  host: process.env.POSTGRES_HOST as string,
  port: Number(process.env.POSTGRES_POST as string),
  database: process.env.POSTGRES_DATABASE as string,
  user: process.env.POSTGRES_USER as string,
  password: process.env.POSTGRES_PASSWORD as string,
};

export const createPg = PostgresOrm(Pg(pgConfig));

export class SampleModel extends model({
  table: 'sample',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    name: t.string(),
  })
}) {
  customMethod() {
    return 123
  }
}

export const testDb = createPg({
  model: SampleModel
})

export type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;
