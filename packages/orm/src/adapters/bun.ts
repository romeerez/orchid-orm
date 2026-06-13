import {
  TableClasses,
  OrchidORM,
  OrchidORMTables,
  OrchidOrmParam,
  bundleOrchidORMTables,
  makeOrchidOrmDbWithAdapter,
} from 'orchid-orm';
import { BunAdapter, BunAdapterOptions, createDb as cdb } from 'pqb/bun';
import { DbSharedOptions, AdapterClass } from 'pqb/internal';
export { bunSchemaConfig } from 'pqb/bun';

export interface BunOrchidORMOptions
  extends BunAdapterOptions, DbSharedOptions {}

export const Adapter = BunAdapter;

export const createDb = cdb;

export const makeOrchidOrmDb = <T extends TableClasses>(
  orm: OrchidORMTables<T>,
  { log, ...options }: OrchidOrmParam<BunOrchidORMOptions>,
): OrchidORM<T> => {
  return makeOrchidOrmDbWithAdapter(orm, {
    ...options,
    log,
    adapter: new AdapterClass({
      driverAdapter: BunAdapter,
      config: options,
    }),
  });
};

export const orchidORM = <T extends TableClasses>(
  options: OrchidOrmParam<BunOrchidORMOptions>,
  tables: T,
): OrchidORM<T> => {
  const orm = bundleOrchidORMTables(tables);
  return makeOrchidOrmDb(orm, options);
};
