import {
  TableClasses,
  OrchidORM,
  OrchidORMTables,
  OrchidOrmParam,
  bundleOrchidORMTables,
  makeOrchidOrmDbWithAdapter,
} from 'orchid-orm';
import {
  NodePostgresAdapter,
  NodePostgresAdapterOptions,
  createDb as cdb,
} from 'pqb/node-postgres';
import { DbSharedOptions, AdapterClass } from 'pqb/internal';
export { nodePostgresSchemaConfig } from 'pqb/node-postgres';

export const Adapter = NodePostgresAdapter;

export const createDb = cdb;

export const makeOrchidOrmDb = <T extends TableClasses>(
  orm: OrchidORMTables<T>,
  {
    log,
    ...options
  }: OrchidOrmParam<NodePostgresAdapterOptions & DbSharedOptions>,
): OrchidORM<T> => {
  return makeOrchidOrmDbWithAdapter(orm, {
    ...options,
    adapter: new AdapterClass({
      driverAdapter: NodePostgresAdapter,
      config: options,
    }),
    log,
  });
};

export const orchidORM = <T extends TableClasses>(
  options: OrchidOrmParam<NodePostgresAdapterOptions & DbSharedOptions>,
  tables: T,
): OrchidORM<T> => {
  const orm = bundleOrchidORMTables(tables);
  return makeOrchidOrmDb(orm, options);
};
