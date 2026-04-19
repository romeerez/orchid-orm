import pg, { DatabaseError, Pool, PoolClient, PoolConfig } from 'pg';
import {
  AdapterBase,
  AdapterConfigBase,
  ColumnSchemaConfig,
  emptyObject,
  noop,
  QueryArraysResult,
  QueryResult,
  QueryResultRow,
  RecordUnknown,
  returnArg,
  setConnectRetryConfig,
  wrapAdapterFnWithConnectRetry,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  DbOptions,
  DbResult,
  TransactionAdapterBase,
  QuerySchema,
  TransactionArgs,
  RecordStringOrNumber,
} from 'pqb/internal';
import { QueryError, createDbWithAdapter } from 'pqb';
import {
  getResetLocalsSql,
  getSetLocalsSql,
  getTransactionArgs,
  mergeLocals,
} from './adapter.utils';
import { SqlSessionState } from './adapter';
import {
  sqlSessionContextComputeSetup,
  sqlSessionContextExecute,
} from './features/sql-session-context';

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
  extends AdapterConfigBase, Omit<PoolConfig, 'types' | 'connectionString'> {
  searchPath?: string;
  databaseURL?: string;
}

export interface NodePostgresAdapterOptions extends Omit<AdapterConfig, 'log'> {
  schema?: QuerySchema;
}

export class NodePostgresAdapter implements AdapterBase {
  pool: Pool;
  searchPath?: string;
  errorClass = DatabaseError;
  locals: RecordStringOrNumber;

  constructor(public config: NodePostgresAdapterOptions) {
    this.pool = this.configure(config);
    this.locals = this.searchPath
      ? { search_path: this.searchPath }
      : emptyObject;
  }

  isInTransaction(): boolean {
    return false;
  }

  private configure(config: NodePostgresAdapterOptions): Pool {
    let searchPath = config.searchPath;
    if (config.databaseURL) {
      const url = new URL(config.databaseURL);

      const ssl = url.searchParams.get('ssl');

      if (ssl === 'false') {
        url.searchParams.delete('ssl');
      } else if (!config.ssl && ssl === 'true') {
        config.ssl = true;
      }

      if (!searchPath) {
        searchPath = url.searchParams.get('searchPath') || undefined;
      }

      config.databaseURL = url.toString();
      (config as PoolConfig).connectionString = config.databaseURL;
    }

    if (searchPath)
      this.searchPath = searchPath === 'public' ? undefined : searchPath;

    const pool = new pg.Pool(config);

    if (config.connectRetry) {
      setConnectRetryConfig(
        this,
        config.connectRetry === true ? emptyObject : config.connectRetry,
      );

      this.connect = wrapAdapterFnWithConnectRetry(this, () =>
        this.pool.connect(),
      );
    }

    return pool;
  }

  private getURL(): URL | undefined {
    return this.config.databaseURL
      ? new URL(this.config.databaseURL)
      : undefined;
  }

  async updateConfig(config: NodePostgresAdapterOptions): Promise<void> {
    await this.close();
    this.configure({ ...this.config, ...config });
  }

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    searchPath?: string;
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

      if (params.searchPath !== undefined) {
        url.searchParams.set('searchPath', params.searchPath);
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

  getSearchPath(): string | undefined {
    return this.searchPath;
  }

  getHost(): string {
    const url = this.getURL();
    return url ? url.hostname : (this.config.host as string);
  }

  getSchema(): QuerySchema | undefined {
    return this.config.schema;
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    startingSavepoint?: string,
    releasingSavepoint?: string,
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryResult<T>> {
    return queryWithSqlSession(
      this,
      undefined,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      false,
      sqlSessionState,
      true,
    ) as never;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
    startingSavepoint?: string,
    releasingSavepoint?: string,
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryArraysResult<R>> {
    return queryWithSqlSession(
      this,
      undefined,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      true,
      sqlSessionState,
      true,
    ) as never;
  }

  async transaction<Result>(...args: TransactionArgs<Result>): Promise<Result> {
    const client = await this.connect();

    const { cb, options } = getTransactionArgs(args);

    try {
      await performQueryOnClient(
        client,
        options?.options ? 'BEGIN ' + options.options : 'BEGIN',
      );

      // Apply transaction-scoped SQL session state (role and setConfig) once at transaction start
      if (options?.sqlSessionState) {
        const { role, setConfig } = options.sqlSessionState;
        if (role) {
          await performQueryOnClient(client, `SET ROLE ${role}`);
        }
        if (setConfig && Object.keys(setConfig).length > 0) {
          const setColumns = Object.entries(setConfig)
            .map(
              ([key, value]) =>
                `set_config('${key.replace(/'/g, "''")}', '${typeof value === 'string' ? value.replace(/'/g, "''") : value}', true)`,
            )
            .join(', ');
          await performQueryOnClient(client, `SELECT ${setColumns}`);
        }
      }

      const localsSql = getSetLocalsSql(options);
      if (localsSql) {
        await client.query(localsSql);
      }

      const locals = mergeLocals(this.locals, options);

      let result;
      try {
        result = await cb(
          new NodePostgresTransactionAdapter(this, client, this, locals),
        );
      } catch (err) {
        await performQueryOnClient(client, 'ROLLBACK');
        throw err;
      }
      await performQueryOnClient(client, 'COMMIT');
      return result as Result;
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
  connection: { searchPath?: string };
}

const setSearchPath = (client: PoolClient, searchPath?: string) => {
  if (
    (client as unknown as ConnectionSchema).connection.searchPath !== searchPath
  ) {
    (client as unknown as ConnectionSchema).connection.searchPath = searchPath;
    return client.query(`SET search_path = ${searchPath || 'public'}`);
  }
  return;
};

// Execute query with SQL session state setup/cleanup
// For non-transactional queries: checks out a PoolClient and releases it after (borrowConnection=true)
// For transactional queries: uses the existing transaction connection (borrowConnection=false)
const queryWithSqlSession = async <T extends QueryResultRow = QueryResultRow>(
  adapter: NodePostgresAdapter,
  client: PoolClient | undefined,
  text: string,
  values: unknown[] | undefined,
  startingSavepoint: string | undefined,
  releasingSavepoint: string | undefined,
  arraysMode: boolean,
  sessionState: SqlSessionState | undefined,
  borrowConnection = false,
): Promise<QueryResult<T>> => {
  const setup = sqlSessionContextComputeSetup(sessionState);

  if (!setup) {
    if (borrowConnection) {
      const conn = await adapter.connect();
      try {
        await setSearchPath(conn, adapter.searchPath);
        return await performQueryOnClient(
          conn,
          text,
          values,
          arraysMode ? 'array' : undefined,
          startingSavepoint,
          releasingSavepoint,
        );
      } finally {
        conn.release();
      }
    }
    return performQueryOnClient(
      client!,
      text,
      values,
      arraysMode ? 'array' : undefined,
      startingSavepoint,
      releasingSavepoint,
    );
  }

  const conn = borrowConnection ? await adapter.connect() : client!;

  const queryFn = (sql: string, vals?: unknown[]) => {
    return conn
      .query({ text: sql, values: vals, rowMode: 'array' })
      .then((res) => ({
        rows: res.rows,
        rowCount: res.rowCount ?? 0,
        fields: res.fields.map((f) => ({ name: f.name })),
      }));
  };

  const releaseFn = borrowConnection
    ? async () => {
        conn.release();
      }
    : undefined;

  const mainQuery = () =>
    performQueryOnClient(
      conn,
      text,
      values,
      arraysMode ? 'array' : undefined,
      startingSavepoint,
      releasingSavepoint,
    );

  if (borrowConnection) {
    try {
      await setSearchPath(conn, adapter.searchPath);
      return await sqlSessionContextExecute<T>(
        queryFn,
        setup,
        mainQuery,
        releaseFn,
      );
    } catch (err) {
      conn.release();
      throw err;
    }
  }

  return sqlSessionContextExecute<T>(queryFn, setup, mainQuery);
};

const performQueryOnClient = async (
  client: PoolClient,
  text: string,
  values?: unknown[],
  rowMode?: 'array',
  startingSavepoint?: string,
  releasingSavepoint?: string,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    text,
    values,
    rowMode,
    types: defaultTypesConfig,
  };

  // When using save points (it's in transaction), need to perform a single query at a time.
  // stating 1 then 2 then releasing 1 would fail.
  // Start 1, release 1, start 2, release 2, and so on.
  const { __lock } = client as unknown as { __lock?: Promise<unknown> };
  if (__lock) {
    let resolve: () => void | undefined;
    (client as unknown as RecordUnknown).__lock = new Promise<void>((res) => {
      resolve = () => {
        res();
      };
    });

    return __lock.then(() => {
      const promise =
        startingSavepoint || releasingSavepoint
          ? performQueryOnClientWithSavepoint(
              client,
              params,
              startingSavepoint,
              releasingSavepoint,
            )
          : client.query(params);
      promise.then(resolve, resolve);
      return promise;
    });
  }

  const promise =
    startingSavepoint || releasingSavepoint
      ? performQueryOnClientWithSavepoint(
          client,
          params,
          startingSavepoint,
          releasingSavepoint,
        )
      : client.query(params);

  (client as unknown as { __lock?: Promise<unknown> }).__lock =
    promise.catch(noop);

  return promise;
};

const performQueryOnClientWithSavepoint = (
  client: PoolClient,
  params: unknown,
  startingSavepoint?: string,
  releasingSavepoint?: string,
) => {
  let promise = startingSavepoint
    ? client
        .query(`SAVEPOINT "${startingSavepoint}"`)
        .then(() => client.query(params as never))
    : client.query(params as never);

  if (releasingSavepoint) {
    promise = promise.then(
      async (res) => {
        await client.query(`RELEASE SAVEPOINT "${releasingSavepoint}"`);
        return res;
      },
      async (err) => {
        await client.query(`ROLLBACK TO SAVEPOINT "${releasingSavepoint}"`);
        throw err;
      },
    );
  }

  return promise;
};

export class NodePostgresTransactionAdapter implements TransactionAdapterBase {
  pool: Pool;
  config: PoolConfig;
  searchPath?: string;
  errorClass = DatabaseError;

  constructor(
    public adapter: NodePostgresAdapter,
    public client: PoolClient,
    public parent: AdapterBase,
    public locals: RecordStringOrNumber,
  ) {
    this.pool = adapter.pool;
    this.config = adapter.config;
    this.searchPath = adapter.searchPath;
  }

  isInTransaction(): true {
    return true;
  }

  updateConfig(config: NodePostgresAdapterOptions): Promise<void> {
    return this.adapter.updateConfig(config);
  }

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    searchPath?: string;
  }): AdapterBase {
    return this.adapter.reconfigure(params);
  }

  getDatabase(): string {
    return this.adapter.getDatabase();
  }

  getUser(): string {
    return this.adapter.getUser();
  }

  getSearchPath(): string | undefined {
    return this.adapter.getSearchPath();
  }

  getHost(): string {
    return this.adapter.getHost();
  }

  getSchema(): QuerySchema | undefined {
    return this.adapter.getSchema();
  }

  connect(): Promise<PoolClient> {
    return Promise.resolve(this.client);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    startingSavepoint?: string,
    releasingSavepoint?: string,
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryResult<T>> {
    return queryWithSqlSession(
      this.adapter,
      this.client,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      false,
      sqlSessionState,
      false,
    ) as never;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
    startingSavepoint?: string,
    releasingSavepoint?: string,
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryArraysResult<R>> {
    return queryWithSqlSession(
      this.adapter,
      this.client,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      true,
      sqlSessionState,
      false,
    ) as never;
  }

  async transaction<Result>(...args: TransactionArgs<Result>): Promise<Result> {
    const { cb, options } = getTransactionArgs(args);

    // For nested transactions with SQL session state, capture outer transaction-local values
    let capturedRole: string | undefined;
    const capturedConfigs: Record<string, string | null> = {};
    const sqlSession = options?.sqlSessionState;

    if (sqlSession) {
      // Capture current role if we're going to override it
      if (sqlSession.role) {
        const roleResult = await this.query<{ role: string }>(
          'SELECT current_role as role',
        );
        capturedRole = roleResult.rows[0].role;
      }

      // Capture current config values for keys we're going to override
      if (
        sqlSession.setConfig &&
        Object.keys(sqlSession.setConfig).length > 0
      ) {
        for (const key of Object.keys(sqlSession.setConfig)) {
          const configResult = await this.query<{ val: string | null }>(
            `SELECT current_setting('${key.replace(/'/g, "''")}', true) as val`,
          );
          capturedConfigs[key] = configResult.rows[0].val;
        }
      }
    }

    const localsSql = getSetLocalsSql(options);
    if (localsSql) {
      await this.query(localsSql);
    }

    const locals = mergeLocals(this.locals, options);

    let res: Result;
    try {
      res = (await cb(
        new NodePostgresTransactionAdapter(
          this.adapter,
          this.client,
          this,
          locals,
        ),
      )) as Result;
    } finally {
      // Restore outer transaction-local values after nested transaction completes
      if (sqlSession) {
        if (capturedRole !== undefined) {
          await this.query(`SET ROLE ${capturedRole}`);
        }

        for (const [key, value] of Object.entries(capturedConfigs)) {
          // Reset to empty string if previously unset (null), otherwise restore previous value
          const restoreValue = value === null ? '' : value;
          await this.query(
            `SELECT set_config('${key.replace(/'/g, "''")}', '${restoreValue.replace(/'/g, "''")}', true)`,
          );
        }
      }

      const resetLocalsSql = getResetLocalsSql(this.locals, options);
      if (resetLocalsSql) {
        await this.query(resetLocalsSql);
      }
    }

    return res;
  }

  close() {
    return this.adapter.close();
  }

  assignError(to: QueryError, from: Error) {
    return this.adapter.assignError(to, from);
  }
}
