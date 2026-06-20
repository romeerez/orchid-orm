import {
  TableClasses,
  OrchidORM,
  OrchidORMBundle,
  OrchidOrmParam,
  bundleOrchidORM,
  makeOrchidOrmDbWithAdapter,
} from 'orchid-orm';
import { BunAdapter, BunAdapterOptions, createDb as cdb } from 'pqb/bun';
import { DbSharedOptions, AdapterClass, EmptyObject } from 'pqb/internal';
export { bunSchemaConfig } from 'pqb/bun';

export interface BunOrchidORMOptions
  extends BunAdapterOptions, DbSharedOptions {
  views?: TableClasses;
}

export const Adapter = BunAdapter;

export const createDb = cdb;

export const makeOrchidOrmDb = <
  T extends TableClasses,
  V extends TableClasses = EmptyObject,
>(
  orm: OrchidORMBundle<T, V>,
  { log, ...options }: OrchidOrmParam<BunOrchidORMOptions>,
): OrchidORM<T, V> => {
  return makeOrchidOrmDbWithAdapter(orm, {
    ...options,
    log,
    adapter: new AdapterClass({
      driverAdapter: BunAdapter,
      config: options,
    }),
  });
};

export const orchidORM = <
  T extends TableClasses,
  V extends TableClasses = EmptyObject,
>(
  { views, ...options }: OrchidOrmParam<BunOrchidORMOptions & { views?: V }>,
  tables: T,
): OrchidORM<T, V> => {
  const orm = bundleOrchidORM({ tables, views });
  return makeOrchidOrmDb(orm, options);
};
