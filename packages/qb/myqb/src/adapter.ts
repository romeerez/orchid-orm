import {
  createPool,
  Pool,
  PoolOptions,
  PoolConnection,
  FieldPacket,
} from 'mysql2/promise';
import { AdapterBase, QueryResultRow } from '../../common/src/adapter';

export type QueryResult<T extends QueryResultRow> = [
  (T & {
    constructor: {
      name: 'RowDataPacket';
    };
  })[],
  FieldPacket[],
];

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends QueryResultRow = any>(
    query: QueryInput,
  ): Promise<QueryResult<T>> {
    return makeQuery<T>(this.pool, query);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<T extends any[] = any[]>(
    query: QueryInput,
  ): Promise<QueryResult<T>> {
    return queryArrays<T>(this.pool, query);
  }

  async transaction<Result>(
    cb: (adapter: TransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.getConnection();
    try {
      await makeQuery(client, 'BEGIN');
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

export class TransactionAdapter implements Adapter {
  pool: Pool;
  config: PoolOptions;

  constructor(public adapter: Adapter, public client: PoolConnection) {
    this.pool = adapter.pool;
    this.config = adapter.config;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends QueryResultRow = any>(
    query: QueryInput,
  ): Promise<QueryResult<T>> {
    return await makeQuery<T>(this.client, query);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    query: QueryInput,
  ): Promise<QueryResult<R>> {
    return await queryArrays<R>(this.client, query);
  }

  async transaction<Result>(
    cb: (adapter: TransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    return await cb(this);
  }

  close() {
    return this.adapter.close();
  }
}
