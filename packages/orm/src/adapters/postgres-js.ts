import {
  TableClasses,
  OrchidORM,
  OrchidORMTables,
  OrchidOrmParam,
  bundleOrchidORMTables,
  makeOrchidOrmDbWithAdapter,
} from 'orchid-orm';
import {
  PostgresJsAdapter,
  PostgresJsAdapterOptions,
  createDb as cdb,
} from 'pqb/postgres-js';
import { DbSharedOptions, AdapterClass } from 'pqb/internal';

export interface PostgresJsOrchidORMOptions
  extends PostgresJsAdapterOptions, DbSharedOptions {}

export const Adapter = PostgresJsAdapter;

export const createDb = cdb;

export const makeOrchidOrmDb = <T extends TableClasses>(
  orm: OrchidORMTables<T>,
  { log, ...options }: OrchidOrmParam<PostgresJsOrchidORMOptions>,
): OrchidORM<T> => {
  return makeOrchidOrmDbWithAdapter(orm, {
    ...options,
    log,
    adapter: new AdapterClass({
      driverAdapter: PostgresJsAdapter,
      config: options,
    }),
  });
};

export const orchidORM = <T extends TableClasses>(
  options: OrchidOrmParam<PostgresJsOrchidORMOptions>,
  tables: T,
): OrchidORM<T> => {
  const orm = bundleOrchidORMTables(tables);
  return makeOrchidOrmDb(orm, options);
};
