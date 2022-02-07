export interface QueryResultRow {
  [column: string]: any;
}

export type PostgresAdapter = {
  query<T extends QueryResultRow = any>(query: string): Promise<{ rows: T[] }>;
  destroy(): Promise<void>;
};

export class PostgresRepo<Model> {
  constructor(public adapter: PostgresAdapter) {}

  model() {
    return ({} as any) as Model;
  }
  where(conditions: any) {
    console.log(conditions);
    return (this as any) as Model[];
  }
  first() {
    return this;
  }
}

type RepoConstructor = {
  new (adapter: PostgresAdapter): PostgresRepo<unknown>;
};

type PostgresORM<T> = { [K in keyof T]: PostgresRepo<T[K]> } & {
  destroy(): Promise<void>;
};

export const PostgresDialect = (adapter: PostgresAdapter) => <
  T extends Record<string, RepoConstructor>
>(
  repos: T
): PostgresORM<T> => {
  const result = {
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
