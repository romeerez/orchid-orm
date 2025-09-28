import { createPool, Pool, PoolOptions, PoolConnection } from 'mysql2/promise';
import { AdapterBase, QueryResult, QueryResultRow } from 'orchid-core';

export type QueryInput = string | { text: string; values?: unknown[] };

export type AdapterOptions = Omit<PoolOptions, 'host' | 'user' | 'database'> &
  (
    | {
        databaseURL: string;
      }
    | {
        host: string;
        user: string;
        database: string;
      }
  );

export class Adapter implements AdapterBase {
  pool: Pool;
  config: PoolOptions;

  constructor(params: AdapterOptions) {
    if ('databaseURL' in params) {
      const { databaseURL, ...rest } = params;
      const url = new URL(databaseURL);
      this.config = {
        ...rest,
        user: url.username,
        password: url.password,
        host: url.hostname,
        port: url.port ? parseInt(url.port) : undefined,
        database: url.pathname.slice(1),
        ssl: url.searchParams.get('ssl') === 'true' ? {} : undefined,
      };
    } else {
      this.config = params;
    }

    this.pool = createPool(this.config);
  }

  connect(): Promise<unknown> {
    throw new Error(`Not implemented for MySQL`);
  }

  reconfigure(_: {
    database?: string;
    user?: string;
    password?: string;
    schema?: string;
  }): AdapterBase {
    throw new Error('Not implemented for MySQL');
  }

  getDatabase(): string {
    throw new Error('Not implemented for MySQL');
  }

  getUser(): string {
    throw new Error('Not implemented for MySQL');
  }

  getSchema(): string {
    throw new Error('Not implemented for MySQL');
  }

  getHost(): string {
    throw new Error('Not implemented for MySQL');
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    query: QueryInput,
  ): Promise<QueryResult<T>> {
    return makeQuery<T>(this.pool, query) as never;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<T extends any[] = any[]>(
    query: QueryInput,
  ): Promise<QueryResult<T>> {
    return queryArrays<T>(this.pool, query) as never;
  }

  async transaction<Result>(
    options: string | undefined,
    cb: (adapter: AdapterBase) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.getConnection();
    try {
      await makeQuery(client, options ? `BEGIN ${options}` : 'BEGIN');
      let result;
      try {
        result = await cb(new TransactionAdapter(this, client));
      } catch (err) {
        await makeQuery(client, 'ROLLBACK');
        throw err;
      }
      await makeQuery(client, 'COMMIT');
      return result;
    } finally {
      client.release();
    }
  }

  close() {
    return this.pool.end();
  }
}

const makeQuery = <T extends QueryResultRow>(
  pool: Pool | PoolConnection,
  query: QueryInput,
) => {
  return pool.query<
    (T & {
      constructor: {
        name: 'RowDataPacket';
      };
    })[]
  >({
    sql: typeof query === 'string' ? query : query.text,
    values: typeof query === 'string' ? undefined : query.values,
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryArrays = <T extends any[]>(
  pool: Pool | PoolConnection,
  query: QueryInput,
) => {
  return pool.query<
    (T & {
      constructor: {
        name: 'RowDataPacket';
      };
    })[]
  >({
    sql: typeof query === 'string' ? query : query.text,
    values: typeof query === 'string' ? undefined : query.values,
    rowsAsArray: true,
  });
};

export class TransactionAdapter implements AdapterBase {
  pool: Pool;
  config: PoolOptions;

  constructor(public adapter: Adapter, public client: PoolConnection) {
    this.pool = adapter.pool;
    this.config = adapter.config;
  }

  connect(): Promise<PoolConnection> {
    return Promise.resolve(this.client);
  }

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    schema?: string;
  }): AdapterBase {
    return this.adapter.reconfigure(params);
  }

  getDatabase(): string {
    return this.adapter.getDatabase();
  }

  getUser(): string {
    return this.adapter.getUser();
  }

  getSchema(): string {
    return this.adapter.getSchema();
  }

  getHost(): string {
    return this.adapter.getHost();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends QueryResultRow = QueryResultRow>(
    query: QueryInput,
  ): Promise<QueryResult<T>> {
    return (await makeQuery<T>(this.client, query)) as never;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    query: QueryInput,
  ): Promise<QueryResult<R>> {
    return (await queryArrays<R>(this.client, query)) as never;
  }

  async transaction<Result>(
    _options: string | undefined,
    cb: (adapter: AdapterBase) => Promise<Result>,
  ): Promise<Result> {
    return await cb(this);
  }

  close() {
    return this.adapter.close();
  }
}
