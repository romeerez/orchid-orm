import { Adapter, PickQueryQ, QueryData } from 'pqb/internal';

export interface OrmParam {
  $qb?: PickQueryQ;
  q?: QueryData;
  $getAdapter(): Adapter;
}

export type DbParam = OrmParam | Adapter;

export const getMaybeTransactionAdapter = (db: DbParam): Adapter =>
  '$getAdapter' in db ? db.$getAdapter() : db;

export const runSqlInSavePoint = async (
  db: DbParam,
  sql: string,
  code: string,
): Promise<'done' | 'already'> => {
  const adapter = getMaybeTransactionAdapter(db);
  try {
    const query = () => adapter.query(sql);

    await (adapter.isInTransaction() ? adapter.savepoint('s', query) : query());

    return 'done';
  } catch (err) {
    if ((err as { code: string }).code === code) {
      return 'already';
    }
    throw err;
  }
};
