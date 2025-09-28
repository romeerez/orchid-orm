import {
  TableClasses,
  OrchidORM,
  OrchidOrmParam,
  orchidORMWithAdapter,
} from 'orchid-orm';
import { PostgresJsAdapter, PostgresJsAdapterOptions } from 'pqb/postgres-js';
import { DbSharedOptions } from 'pqb';

export interface PostgresJsOrchidORMOptions
  extends PostgresJsAdapterOptions,
    DbSharedOptions {}

export const Adapter = PostgresJsAdapter;

export const orchidORM = <T extends TableClasses>(
  options: OrchidOrmParam<PostgresJsOrchidORMOptions>,
  tables: T,
): OrchidORM<T> => {
  return orchidORMWithAdapter(
    {
      ...options,
      adapter: new PostgresJsAdapter(options),
    },
    tables,
  );
};
