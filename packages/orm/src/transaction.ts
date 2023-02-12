import { Db } from 'pqb';

export function transaction<T extends { $queryBuilder: Db }, Result>(
  this: T,
  fn: (db: T) => Promise<Result>,
): Promise<Result> {
  if (fn.length === 0) {
    throw new Error('Argument of $transaction callback should be used');
  }

  return this.$queryBuilder.transaction((q) => {
    const orm = {} as T;
    for (const key in this) {
      const value = this[key];
      if (value instanceof Db) {
        const table = value.transacting(q);
        table.baseQuery = table;
        (table as unknown as { db: unknown }).db = orm;
        orm[key] = table;
      } else {
        orm[key] = value;
      }
    }

    return fn(orm);
  });
}
