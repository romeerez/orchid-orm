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

export type AdapterOptions = Omit<PoolConfig, 'types'> & {
  types?: TypeParsers;
};

export class Adapter {
  types: TypeParsers;
  pool: Pool;

  constructor({ types = defaultTypeParsers, ...config }: AdapterOptions) {
    this.types = types;
    this.pool = new Pool(config);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends QueryResultRow = any>(
    query: Query,
    types: TypeParsers = this.types,
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      return await performQuery<T>(client, query, types);
    } finally {
      client.release();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    query: Query,
    types: TypeParsers = this.types,
  ): Promise<QueryArraysResult<R>> {
    const client = await this.pool.connect();
    try {
      return await performQueryArrays<R>(client, query, types);
    } finally {
      client.release();
    }
  }

  async transaction<Result>(
    cb: (adapter: Adapter) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.connect();
    try {
      await performQuery(client, { text: 'BEGIN' }, this.types);
      const result = await cb(
        new TransactionAdapter(this.pool, client, this.types),
      );
      await performQuery(client, { text: 'COMMIT' }, this.types);
      return result;
    } catch (err) {
      await performQuery(client, { text: 'ROLLBACK' }, this.types);
      throw err;
    } finally {
      client.release();
    }
  }
  destroy(): Promise<void> {
    return this.pool.end();
  }
}

const performQuery = <T extends QueryResultRow>(
  client: PoolClient,
  query: Query,
  types: TypeParsers,
) => {
  return client.query<T>({
    text: typeof query === 'string' ? query : query.text,
    values: typeof query === 'string' ? undefined : query.values,
    types: types && {
      getTypeParser(id: number) {
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
      getTypeParser(id: number) {
        return types[id] || returnArg;
      },
    },
  });
};

export class TransactionAdapter implements Adapter {
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
    cb: (adapter: Adapter) => Promise<Result>,
  ): Promise<Result> {
    return await cb(this);
  }

  destroy() {
    return this.pool.end();
  }
}
