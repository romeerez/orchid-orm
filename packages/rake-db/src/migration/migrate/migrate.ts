import { clearChanges } from '../change';
import {
  getChanges,
  migrateAndClose,
  MigrateFnConfig,
  runMigration,
} from '../../commands/migrateOrRollback';
import {
  AdapterBase,
  QueryBase,
  defaultSchemaConfig,
  makeColumnTypes as defaultColumnTypes,
  Query,
} from 'pqb';
import {
  ensureMigrationsPath,
  migrationConfigDefaults,
  ensureBasePathAndDbScript,
} from '../../config';

interface OrmParam {
  $qb: QueryBase;
}

type UnknownPromiseFns = (() => Promise<unknown>)[];

export const migrateFiles = async (db: OrmParam, files: UnknownPromiseFns) => {
  const qb = db.$qb as Query;

  await qb.ensureTransaction(async () => {
    const adapter = qb.internal.transactionStorage.getStore()
      ?.adapter as AdapterBase;

    for (const load of files) {
      clearChanges();

      const changes = await getChanges({ load });
      const config = changes[0]?.config;

      await runMigration(adapter, true, changes, config);
    }
  });
};

export const makeMigrateAdapter = (
  config?: Partial<MigrateFnConfig>,
): ((
  adapter: AdapterBase,
  params?: { count?: number; force?: boolean },
) => Promise<void>) => {
  const conf = ensureMigrationsPath(ensureBasePathAndDbScript(config || {}));

  return async (adapter, params) => {
    await migrateAndClose({
      adapter,
      ...params,
      config: {
        ...conf,
        columnTypes:
          conf.columnTypes || defaultColumnTypes(defaultSchemaConfig),
        migrationId: conf.migrationId || migrationConfigDefaults.migrationId,
        migrationsTable:
          conf.migrationsTable || migrationConfigDefaults.migrationsTable,
        import: conf.import || migrationConfigDefaults.import,
        transaction: conf.transaction || 'single',
      },
    });
  };
};
