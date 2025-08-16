import { QueryBase } from 'orchid-core';
import { clearChanges } from '../change';
import { getChanges, runMigration } from '../../commands/migrateOrRollback';
import { Query, TransactionAdapter } from 'pqb';

interface OrmParam {
  $qb: QueryBase;
}

type UnknownPromiseFns = (() => Promise<unknown>)[];

export const migrateFiles = async (db: OrmParam, files: UnknownPromiseFns) => {
  const qb = db.$qb as Query;

  await qb.ensureTransaction(async () => {
    const adapter = qb.internal.transactionStorage.getStore()
      ?.adapter as TransactionAdapter;

    for (const load of files) {
      clearChanges();

      const changes = await getChanges({ load });
      const config = changes[0]?.config;

      await runMigration(adapter as TransactionAdapter, true, changes, config);
    }
  });
};
