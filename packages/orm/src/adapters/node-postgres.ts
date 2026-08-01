import {
  OrmTableThunks,
  OrchidORM,
  OrchidORMBundle,
  OrchidOrmParam,
  bundleOrchidORM,
  makeOrchidOrmDbWithAdapter,
} from 'orchid-orm';
import {
  NodePostgresAdapter,
  NodePostgresAdapterOptions,
  createDb as cdb,
} from 'pqb/node-postgres';
import { DbSharedOptions, AdapterClass, EmptyObject } from 'pqb/internal';
export { nodePostgresSchemaConfig } from 'pqb/node-postgres';

export const Adapter = NodePostgresAdapter;

export const createDb = cdb;

export interface NodePostgresOrchidORMOptions
  extends NodePostgresAdapterOptions, DbSharedOptions {
  views?: OrmTableThunks;
}

export const makeOrchidOrmDb = <
  T extends OrmTableThunks,
  V extends OrmTableThunks = EmptyObject,
>(
  orm: OrchidORMBundle<T, V>,
  {
    log,
    ...options
  }: OrchidOrmParam<NodePostgresAdapterOptions & DbSharedOptions>,
): OrchidORM<T, V> => {
  return makeOrchidOrmDbWithAdapter(orm, {
    ...options,
    adapter: new AdapterClass({
      driverAdapter: NodePostgresAdapter,
      config: options,
    }),
    log,
  });
};

export const orchidORM = <
  T extends OrmTableThunks,
  V extends OrmTableThunks = EmptyObject,
>(
  {
    views,
    ...options
  }: OrchidOrmParam<NodePostgresOrchidORMOptions & { views?: V }>,
  tables: T,
): OrchidORM<T, V> => {
  const orm = bundleOrchidORM({ tables, views });
  return makeOrchidOrmDb(orm, options);
};
