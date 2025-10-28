import pg, { DatabaseError, Pool, PoolClient, PoolConfig } from 'pg';
import {
  AdapterBase,
  AdapterConfigBase,
  ColumnSchemaConfig,
  emptyObject,
  QueryArraysResult,
  QueryError,
  QueryResult,
  QueryResultRow,
  returnArg,
  setConnectRetryConfig,
  wrapAdapterFnWithConnectRetry,
} from '../core';
import {
  DefaultColumnTypes,
  DefaultSchemaConfig,
  DbOptions,
  DbResult,
  createDbWithAdapter,
} from 'pqb';

export const createDb = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>({
  log,
  ...options
}: DbOptions<SchemaConfig, ColumnTypes> &
  Omit<NodePostgresAdapterOptions, 'log'>): DbResult<ColumnTypes> => {
  return createDbWithAdapter({
    ...options,
    log,
    adapter: new NodePostgresAdapter(options),
  });
};

const { types } = pg;

export interface TypeParsers {
  [K: number]: (input: string) => unknown;
}

const defaultTypeParsers: TypeParsers = {};

for (const key in types.builtins) {
  const id = types.builtins[key as keyof typeof types.builtins];
  defaultTypeParsers[id] = types.getTypeParser(id);
}

[
  types.builtins.DATE,
  types.builtins.TIMESTAMP,
  types.builtins.TIMESTAMPTZ,
  types.builtins.CIRCLE,
  types.builtins.BYTEA,
].forEach((id) => {
  delete defaultTypeParsers[id];
});

export interface AdapterConfig
  extends AdapterConfigBase,
    Omit<PoolConfig, 'types' | 'connectionString'> {
  schema?: string;
  databaseURL?: string;
}

export type NodePostgresAdapterOptions = Omit<AdapterConfig, 'log'>;

export class NodePostgresAdapter implements AdapterBase {
  pool: Pool;
  schema?: string;
  errorClass = DatabaseError;

  constructor(public config: NodePostgresAdapterOptions) {
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
      setConnectRetryConfig(
        this,
        config.connectRetry === true ? emptyObject : config.connectRetry,
      );

      this.connect = wrapAdapterFnWithConnectRetry(this, () =>
        this.pool.connect(),
      );
    }
  }

  private getURL(): URL | undefined {
    return this.config.databaseURL
      ? new URL(this.config.databaseURL)
      : undefined;
  }

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    schema?: string;
  }): NodePostgresAdapter {
    const url = this.getURL();
    if (url) {
      if ('database' in params) {
        url.pathname = `/${params.database}`;
      }

      if (params.user !== undefined) {
        url.username = params.user;
      }

      if (params.password !== undefined) {
        url.password = params.password;
      }

      if (params.schema !== undefined) {
        url.searchParams.set('schema', params.schema);
      }

      return new NodePostgresAdapter({
        ...this.config,
        databaseURL: url.toString(),
      });
    } else {
      return new NodePostgresAdapter({ ...this.config, ...params });
    }
  }

  getDatabase(): string {
    const url = this.getURL();
    return url ? url.pathname.slice(1) : (this.config.database as string);
  }

  getUser(): string {
    const url = this.getURL();
    return url ? url.username : (this.config.user as string);
  }

  getSchema(): string | undefined {
    return this.schema;
  }

  getHost(): string {
    const url = this.getURL();
    return url ? url.hostname : (this.config.host as string);
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return performQuery(this, text, values) as never;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
  ): Promise<QueryArraysResult<R>> {
    return performQuery(this, text, values, 'array') as never;
  }

  async transaction<Result>(
    options: string | undefined,
    cb: (adapter: NodePostgresTransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.connect();
    try {
      await setSearchPath(client, this.schema);
      await performQueryOnClient(
        client,
        options ? 'BEGIN ' + options : 'BEGIN',
      );
      let result;
      try {
        result = await cb(new NodePostgresTransactionAdapter(this, client));
      } catch (err) {
        await performQueryOnClient(client, 'ROLLBACK');
        throw err;
      }
      await performQueryOnClient(client, 'COMMIT');
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

  assignError(to: QueryError, dbError: Error) {
    const from = dbError as DatabaseError;
    to.message = from.message;
    (to as { length?: number }).length = from.length;
    (to as { name?: string }).name = from.name;
    to.severity = from.severity;
    to.code = from.code;
    to.detail = from.detail;
    to.hint = from.hint;
    to.position = from.position;
    to.internalPosition = from.internalPosition;
    to.internalQuery = from.internalQuery;
    to.where = from.where;
    to.schema = from.schema;
    to.table = from.table;
    to.column = from.column;
    to.dataType = from.dataType;
    to.constraint = from.constraint;
    to.file = from.file;
    to.line = from.line;
    to.routine = from.routine;
  }
}

const defaultTypesConfig = {
  getTypeParser(id: number) {
    return defaultTypeParsers[id] || returnArg;
  },
};

interface ConnectionSchema {
  connection: { schema?: string };
}

const setSearchPath = (client: PoolClient, schema?: string) => {
  if ((client as unknown as ConnectionSchema).connection.schema !== schema) {
    (client as unknown as ConnectionSchema).connection.schema = schema;
    return client.query(`SET search_path = ${schema || 'public'}`);
  }
  return;
};

const performQuery = async (
  adapter: NodePostgresAdapter,
  text: string,
  values?: unknown[],
  rowMode?: 'array',
) => {
  const client = await adapter.connect();
  try {
    await setSearchPath(client, adapter.schema);
    return await performQueryOnClient(client, text, values, rowMode);
  } finally {
    client.release();
  }
};

const performQueryOnClient = (
  client: PoolClient,
  text: string,
  values?: unknown[],
  rowMode?: 'array',
) => {
  const params = {
    text,
    values,
    rowMode,
    types: defaultTypesConfig,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.query(params as any);
};

export class NodePostgresTransactionAdapter implements AdapterBase {
  pool: Pool;
  config: PoolConfig;
  schema?: string;
  errorClass = DatabaseError;

  constructor(public adapter: NodePostgresAdapter, public client: PoolClient) {
    this.pool = adapter.pool;
    this.config = adapter.config;
    this.schema = adapter.schema;
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

  getSchema(): string | undefined {
    return this.adapter.getSchema();
  }

  getHost(): string {
    return this.adapter.getHost();
  }

  connect(): Promise<PoolClient> {
    return Promise.resolve(this.client);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return await performQueryOnClient(this.client, text, values);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
  ): Promise<QueryArraysResult<R>> {
    return await performQueryOnClient(this.client, text, values, 'array');
  }

  async transaction<Result>(
    _options: string | undefined,
    cb: (adapter: NodePostgresTransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    return await cb(this);
  }

  close() {
    return this.adapter.close();
  }

  assignError(to: QueryError, from: Error) {
    return this.adapter.assignError(to, from);
  }
}
