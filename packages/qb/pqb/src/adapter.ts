import pg, { Pool, PoolClient, PoolConfig } from 'pg';
import {
  AdapterBase,
  AdapterConfigBase,
  emptyObject,
  QueryInput,
  QueryResultRow,
  setAdapterConnectRetry,
  Sql,
} from 'orchid-core';

const { types } = pg;

export type TypeParsers = Record<number, (input: string) => unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResult<T extends QueryResultRow = any> = {
  rowCount: number;
  rows: T[];
  fields: {
    name: string;
  }[];
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
  types.builtins.CIRCLE,
].forEach((id) => {
  delete defaultTypeParsers[id];
});

const returnArg = (arg: unknown) => arg;

export interface AdapterConfig
  extends AdapterConfigBase,
    Omit<PoolConfig, 'types' | 'connectionString'> {
  schema?: string;
  databaseURL?: string;
}

export type AdapterOptions = AdapterConfig & {
  types?: TypeParsers;
};

export class Adapter implements AdapterBase {
  types: TypeParsers;
  pool: Pool;
  config: PoolConfig;
  schema?: string;

  constructor({ types = defaultTypeParsers, ...config }: AdapterOptions) {
    this.types = types;

    let schema = config.schema;
    if (config.databaseURL) {
      const url = new URL(config.databaseURL);

      const ssl = url.searchParams.get('ssl');

      if (ssl === 'false') {
        url.searchParams.delete('ssl');
      } else if (!config.ssl && ssl === 'true') {
        config.ssl = true;
      }

      if (!schema) {
        schema = url.searchParams.get('schema') || undefined;
      }

      config.databaseURL = url.toString();
      (config as PoolConfig).connectionString = config.databaseURL;
    }

    if (schema) this.schema = schema === 'public' ? undefined : schema;

    this.config = config;
    this.pool = new pg.Pool(config);

    if (config.connectRetry) {
      setAdapterConnectRetry(
        this,
        () => this.pool.connect(),
        config.connectRetry === true ? emptyObject : config.connectRetry,
      );
    }
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    query: QueryInput,
    types?: TypeParsers,
  ): Promise<QueryResult<T>> {
    return performQuery(this, query, types) as unknown as Promise<
      QueryResult<T>
    >;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    query: QueryInput,
    types?: TypeParsers,
  ): Promise<QueryArraysResult<R>> {
    return performQuery(this, query, types, 'array') as unknown as Promise<
      QueryArraysResult<R>
    >;
  }

  async transaction<Result>(
    begin: Sql,
    cb: (adapter: TransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.connect();
    try {
      await setSearchPath(client, this.schema);
      await performQueryOnClient(client, begin, this.types);
      let result;
      try {
        result = await cb(new TransactionAdapter(this, client, this.types));
      } catch (err) {
        await performQueryOnClient(client, { text: 'ROLLBACK' }, this.types);
        throw err;
      }
      await performQueryOnClient(client, { text: 'COMMIT' }, this.types);
      return result;
    } finally {
      client.release();
    }
  }

  close(): Promise<void> {
    const { pool } = this;
    this.pool = new pg.Pool(this.config);
    return pool.end();
  }
}

const defaultTypesConfig = {
  getTypeParser(id: number) {
    return defaultTypeParsers[id] || returnArg;
  },
};

type ConnectionSchema = { connection: { schema?: string } };

const setSearchPath = (client: PoolClient, schema?: string) => {
  if ((client as unknown as ConnectionSchema).connection.schema !== schema) {
    (client as unknown as ConnectionSchema).connection.schema = schema;
    return client.query(`SET search_path = ${schema || 'public'}`);
  }
  return;
};

const performQuery = async (
  adapter: Adapter,
  query: QueryInput,
  types?: TypeParsers,
  rowMode?: 'array',
) => {
  const client = await adapter.connect();
  try {
    await setSearchPath(client, adapter.schema);
    return await performQueryOnClient(client, query, types, rowMode);
  } finally {
    client.release();
  }
};

const performQueryOnClient = (
  client: PoolClient,
  query: QueryInput,
  types?: TypeParsers,
  rowMode?: 'array',
) => {
  const params = {
    text: typeof query === 'string' ? query : query.text,
    values: typeof query === 'string' ? undefined : query.values,
    rowMode,
    types: types
      ? {
          getTypeParser(id: number) {
            return types[id] || returnArg;
          },
        }
      : defaultTypesConfig,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.query(params as any);
};

export class TransactionAdapter implements Adapter {
  pool: Pool;
  config: PoolConfig;

  constructor(
    public adapter: Adapter,
    public client: PoolClient,
    public types: TypeParsers,
  ) {
    this.pool = adapter.pool;
    this.config = adapter.config;
  }

  connect(): Promise<PoolClient> {
    return Promise.resolve(this.client);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends QueryResultRow = any>(
    query: QueryInput,
    types?: TypeParsers,
  ): Promise<QueryResult<T>> {
    return await performQueryOnClient(this.client, query, types);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    query: QueryInput,
    types?: TypeParsers,
  ): Promise<QueryArraysResult<R>> {
    return await performQueryOnClient(this.client, query, types, 'array');
  }

  async transaction<Result>(
    _: Sql,
    cb: (adapter: TransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    return await cb(this);
  }

  close() {
    return this.adapter.close();
  }
}
