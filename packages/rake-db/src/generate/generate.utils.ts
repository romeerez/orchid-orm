import { Query } from 'pqb';
import { AnyRakeDbConfig } from 'rake-db';

export interface DbInstance {
  $queryBuilder: Query;
}

export const getDbFromConfig = async (
  config: AnyRakeDbConfig,
  dbPath: string,
): Promise<DbInstance> => {
  const module = await config.import(dbPath);
  const db = (module as { [K: string]: DbInstance })[config.dbExportedAs];
  if (!db?.$queryBuilder) {
    throw new Error(
      `Unable to import OrchidORM instance as ${config.dbExportedAs} from ${config.dbPath}`,
    );
  }
  return db;
};
