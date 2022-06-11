import { SqlAdapter } from '../sql/sql.types';
import { PostgresModelConstructors } from './model';

export type PostgresAdapter = SqlAdapter

type PostgresORM<T extends PostgresModelConstructors> = {
  [K in keyof T]: InstanceType<T[K]>;
} & {
  adapter: PostgresAdapter;
  destroy(): Promise<void>;
};

export const PostgresOrm = (adapter: PostgresAdapter) => <
  T extends PostgresModelConstructors
>(
  repos: T
): PostgresORM<T> => {
  const result = {
    adapter,
    destroy: () => adapter.destroy(),
  } as PostgresORM<T>;

  for (const key in repos) {
    if (key === 'destroy') {
      throw new Error('Please choose another key for repo');
    }
    result[key] = new repos[key](adapter) as any;
  }

  return result;
};
