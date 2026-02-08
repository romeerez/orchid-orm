import { AdapterBase, Query } from 'pqb';

export interface OrmParam {
  $qb: Query;
  $adapter: AdapterBase;
}

export type DbParam = OrmParam | AdapterBase;

export const getNonTransactionAdapter = (db: DbParam): AdapterBase =>
  '$adapter' in db ? db.$adapter : db;

export const getMaybeTransactionAdapter = (db: DbParam): AdapterBase =>
  '$qb' in db
    ? db.$qb.internal.transactionStorage.getStore()?.adapter || db.$adapter
    : db;

export const ensureTransaction = (
  db: DbParam,
  fn: (trx: AdapterBase) => Promise<void>,
) => {
  const adapter = getMaybeTransactionAdapter(db);
  return adapter.isInTransaction()
    ? fn(adapter)
    : adapter.transaction(undefined, fn);
};

export const runSqlInSavePoint = async (
  db: DbParam,
  sql: string,
  code: string,
): Promise<'done' | 'already'> => {
  const adapter = getMaybeTransactionAdapter(db);
  try {
    await adapter.query(
      adapter.isInTransaction()
        ? `SAVEPOINT s; ${sql}; RELEASE SAVEPOINT s`
        : sql,
    );
    return 'done';
  } catch (err) {
    if ((err as { code: string }).code === code) {
      if (adapter.isInTransaction()) {
        await adapter.query(`ROLLBACK TO SAVEPOINT s`);
      }
      return 'already';
    }
    throw err;
  }
};
