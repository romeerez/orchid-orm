import { PostgresOrm} from '../src/postgres/postgres.orm';
import { Pg } from '../src/postgres/pg.adapter';
import { PostgresModel } from '../src/postgres/postgres.model';

export const pgConfig = {
  host: process.env.POSTGRES_HOST as string,
  port: Number(process.env.POSTGRES_POST as string),
  database: process.env.POSTGRES_DATABASE as string,
  user: process.env.POSTGRES_USER as string,
  password: process.env.POSTGRES_PASSWORD as string,
};

export const createPg = PostgresOrm(Pg(pgConfig));

export class SampleModel extends PostgresModel<{ id: number }> {}
