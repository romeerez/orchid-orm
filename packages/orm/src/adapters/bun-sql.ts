import {
  OrchidORM,
  OrchidOrmParam,
  orchidORMWithAdapter,
  TableClasses,
} from 'orchid-orm';
import {
  BunSqlAdapter,
  BunSqlAdapterOptions,
  createDb as cdb,
} from 'pqb/bun-sql';
import { DbSharedOptions } from 'pqb';

export interface BunSqlOrchidORMOptions
  extends BunSqlAdapterOptions,
    DbSharedOptions {}

export const Adapter = BunSqlAdapter;

export const createDb = cdb;

export const orchidORM = <T extends TableClasses>(
  { log, ...options }: OrchidOrmParam<BunSqlOrchidORMOptions>,
  tables: T,
): OrchidORM<T> => {
  return orchidORMWithAdapter(
    {
      ...options,
      adapter: new BunSqlAdapter(options),
      log,
    },
    tables,
  );
};
