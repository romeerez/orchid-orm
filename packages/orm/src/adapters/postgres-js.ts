import {
  TableClasses,
  OrchidORM,
  OrchidOrmParam,
  orchidORMWithAdapter,
} from 'orchid-orm';
import {
  PostgresJsAdapter,
  PostgresJsAdapterOptions,
  createDb as cdb,
} from 'pqb/postgres-js';
import { DbSharedOptions } from 'pqb';

export interface PostgresJsOrchidORMOptions
  extends PostgresJsAdapterOptions,
    DbSharedOptions {}

export const Adapter = PostgresJsAdapter;

export const createDb = cdb;

export const orchidORM = <T extends TableClasses>(
  { log, ...options }: OrchidOrmParam<PostgresJsOrchidORMOptions>,
  tables: T,
): OrchidORM<T> => {
  return orchidORMWithAdapter(
    {
      ...options,
      log,
      adapter: new PostgresJsAdapter(options),
    },
    tables,
  );
};
