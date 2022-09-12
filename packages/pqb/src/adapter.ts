import { Pool, PoolClient, PoolConfig, types } from 'pg';

export interface QueryResultRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [column: string]: any;
}

export type TypeParsers = Record<number, (input: string) => unknown>;

type Query = string | { text: string; values?: unknown[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResult<T extends QueryResultRow = any> = {
  rowCount: number;
  rows: T[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryArraysResult<R extends any[] = any[]> = {
  rowCount: number;
  rows: R[];
  fields: { name: string }[];
};

export type PostgresAdapter = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T extends QueryResultRow = any>(
    query: Query,
    types?: TypeParsers,
  ): Promise<QueryResult<T>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    query: Query,
    types?: TypeParsers,
  ): Promise<QueryArraysResult<R>>;
  transaction<Result>(
    cb: (adapter: PostgresAdapter) => Promise<Result>,
  ): Promise<Result>;
  destroy(): Promise<void>;
};

const defaultTypeParsers: TypeParsers = {};

for (const key in types.builtins) {
  const id = types.builtins[key as keyof typeof types.builtins];
  defaultTypeParsers[id] = types.getTypeParser(id);
}

[
  types.builtins.DATE,
  types.builtins.TIMESTAMP,
  types.builtins.TIMESTAMPTZ,
  types.builtins.TIME,
].forEach((id) => {
  delete defaultTypeParsers[id];
});

const returnArg = (arg: unknown) => arg;

export const Adapter = ({
  types: configTypes = defaultTypeParsers,
  ...config
}: Omit<PoolConfig, 'types'> & { types?: TypeParsers }): PostgresAdapter => {
  const pool = new Pool(config);

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async query<T extends QueryResultRow = any>(
      query: Query,
      types: TypeParsers = configTypes,
    ): Promise<QueryResult<T>> {
      const client = await pool.connect();
      try {
        return await performQuery<T>(client, query, types);
      } finally {
        client.release();
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async arrays<R extends any[] = any[]>(
      query: Query,
      types: TypeParsers = configTypes,
    ): Promise<QueryArraysResult<R>> {
      const client = await pool.connect();
      try {
        return await performQueryArrays<R>(client, query, types);
      } finally {
        client.release();
      }
    },
    transaction: async <Result>(
      cb: (adapter: PostgresAdapter) => Promise<Result>,
    ) => {
      const client = await pool.connect();
      try {
        await performQuery(client, { text: 'BEGIN' }, configTypes);
        const result = await cb(
          new TransactionAdapter(pool, client, configTypes),
        );
        await performQuery(client, { text: 'COMMIT' }, configTypes);
        return result;
      } catch (err) {
        await performQuery(client, { text: 'ROLLBACK' }, configTypes);
        throw err;
      } finally {
        client.release();
      }
    },
    destroy() {
      return pool.end();
    },
  };
};

const performQuery = <T extends QueryResultRow>(
  client: PoolClient,
  query: Query,
  types: TypeParsers,
) => {
  return client.query<T>({
    text: typeof query === 'string' ? query : query.text,
    values: typeof query === 'string' ? undefined : query.values,
    types: types && {
      getTypeParser(id) {
        return types[id] || returnArg;
      },
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const performQueryArrays = <T extends any[] = any[]>(
  client: PoolClient,
  query: Query,
  types: TypeParsers,
) => {
  return client.query<T>({
    text: typeof query === 'string' ? query : query.text,
    values: typeof query === 'string' ? undefined : query.values,
    rowMode: 'array',
    types: types && {
      getTypeParser(id) {
        return types[id] || returnArg;
      },
    },
  });
};

export class TransactionAdapter implements PostgresAdapter {
  constructor(
    public pool: Pool,
    public client: PoolClient,
    public types: TypeParsers,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends QueryResultRow = any>(
    query: Query,
    types: TypeParsers = this.types,
  ): Promise<QueryResult<T>> {
    return await performQuery<T>(this.client, query, types);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    query: Query,
    types: TypeParsers = this.types,
  ): Promise<QueryArraysResult<R>> {
    return await performQueryArrays<R>(this.client, query, types);
  }

  async transaction<Result>(
    cb: (adapter: PostgresAdapter) => Promise<Result>,
  ): Promise<Result> {
    return await cb(this);
  }

  destroy() {
    return this.pool.end();
  }
}
