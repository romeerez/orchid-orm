import {
  TableClasses,
  OrchidORM,
  OrchidORMBundle,
  OrchidOrmParam,
  bundleOrchidORM,
  makeOrchidOrmDbWithAdapter,
} from 'orchid-orm';
import {
  PostgresJsAdapter,
  PostgresJsAdapterOptions,
  createDb as cdb,
} from 'pqb/postgres-js';
import { DbSharedOptions, AdapterClass, EmptyObject } from 'pqb/internal';

export interface PostgresJsOrchidORMOptions
  extends PostgresJsAdapterOptions, DbSharedOptions {
  views?: TableClasses;
}

export const Adapter = PostgresJsAdapter;

export const createDb = cdb;

export const makeOrchidOrmDb = <
  T extends TableClasses,
  V extends TableClasses = EmptyObject,
>(
  orm: OrchidORMBundle<T, V>,
  { log, ...options }: OrchidOrmParam<PostgresJsOrchidORMOptions>,
): OrchidORM<T, V> => {
  return makeOrchidOrmDbWithAdapter(orm, {
    ...options,
    log,
    adapter: new AdapterClass({
      driverAdapter: PostgresJsAdapter,
      config: options,
    }),
  });
};

export const orchidORM = <
  T extends TableClasses,
  V extends TableClasses = EmptyObject,
>(
  {
    views,
    ...options
  }: OrchidOrmParam<PostgresJsOrchidORMOptions & { views?: V }>,
  tables: T,
): OrchidORM<T, V> => {
  const orm = bundleOrchidORM({ tables, views });
  return makeOrchidOrmDb(orm, options);
};
