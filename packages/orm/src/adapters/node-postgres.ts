import {
  TableClasses,
  OrchidORM,
  OrchidOrmParam,
  orchidORMWithAdapter,
} from 'orchid-orm';
import {
  NodePostgresAdapter,
  NodePostgresAdapterOptions,
  createDb as cdb,
} from 'pqb/node-postgres';
import { DbSharedOptions } from 'pqb';

export const Adapter = NodePostgresAdapter;

export const createDb = cdb;

export const orchidORM = <T extends TableClasses>(
  options: OrchidOrmParam<NodePostgresAdapterOptions & DbSharedOptions>,
  tables: T,
): OrchidORM<T> => {
  return orchidORMWithAdapter(
    {
      ...options,
      adapter: new NodePostgresAdapter(options),
    },
    tables,
  );
};
