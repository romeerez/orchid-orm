import {
  AdapterBase,
  AdapterConfigBase,
  ColumnSchemaConfig,
  createDbWithAdapter,
  DbOptions,
  DbResult,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  emptyObject,
  QueryArraysResult,
  QueryError,
  QueryErrorName,
  QueryResult,
  QueryResultRow,
  RecordUnknown,
  setConnectRetryConfig,
  TransactionAdapterBase,
  wrapAdapterFnWithConnectRetry,
} from 'pqb';

interface BunGlobal {
  SQL: BunSqlConstructor;
}

function getBunGlobal(): BunGlobal {
  const { Bun } = globalThis as { Bun?: BunGlobal };
  if (Bun) {
    return Bun;
  }
  throw new Error(
    'Bun SQL adapter requires Bun runtime. Use this adapter in Bun.',
  );
}

export interface BunSqlClient {
  unsafe(text: string, values?: unknown[]): BunSqlQueryResult;
  begin<Result>(cb: (sql: BunSqlClient) => Promise<Result>): Promise<Result>;
  begin<Result>(
    options: string,
    cb: (sql: BunSqlClient) => Promise<Result>,
  ): Promise<Result>;
  reserve?(): Promise<BunSqlReservedClient>;
  connect?(): Promise<unknown>;
  close(options?: { timeout?: number }): Promise<void>;
  end?(): Promise<void>;
  options: RecordUnknown;
}

interface BunSqlReservedClient extends BunSqlClient {
  release?(): void | Promise<void>;
}

interface BunSqlQueryResult extends Promise<unknown[]> {
  values(): Promise<unknown[][]>;
  count?: number | null;
  command?: string;
}

interface Lockable {
  __lock?: Promise<unknown>;
}

type BunSqlConnectionOptions = Record<string, string | number | boolean>;

type BunSQLError = Error;

type BunSQLErrorConstructor = new (message: string) => BunSQLError;

interface BunPostgresErrorOptions {
  code: string;
  errno?: string;
  detail?: string;
  hint?: string;
  severity?: string;
  position?: string;
  internalPosition?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}

type BunPostgresError = BunSQLError & Readonly<BunPostgresErrorOptions>;

type BunPostgresErrorConstructor = new (
  message: string,
  options: BunPostgresErrorOptions,
) => BunPostgresError;

interface BunSqlConstructor {
  new (): BunSqlClient;
  new (options: BunSqlConstructorOptions): BunSqlClient;
  new (connectionString: string | URL): BunSqlClient;
  new (
    connectionString: string | URL,
    options: BunSqlConstructorSecondOptions,
  ): BunSqlClient;
  SQLError: BunSQLErrorConstructor;
  PostgresError: BunPostgresErrorConstructor;
}

export interface BunSqlAdapterOptions extends AdapterConfigBase {
  databaseURL?: string;
  searchPath?: string;
  sql?: BunSqlClient;
  adapter?: 'postgres';
  url?: string | URL;
  host?: string;
  hostname?: string;
  port?: number | string;
  user?: string;
  username?: string;
  password?: string;
  database?: string;
  tls?: unknown;
  ssl?: unknown;
  max?: number;
  idleTimeout?: number;
  connection?: BunSqlConnectionOptions;
}

type BunSqlConstructorOptions = Omit<
  BunSqlAdapterOptions,
  'connectRetry' | 'databaseURL' | 'searchPath' | 'sql'
>;

type BunSqlConstructorSecondOptions = Omit<BunSqlConstructorOptions, 'url'>;

export interface CreateBunSqlDbOptions<
  SchemaConfig extends ColumnSchemaConfig,
  ColumnTypes,
> extends BunSqlAdapterOptions,
    DbOptions<SchemaConfig, ColumnTypes> {}

export const createDb = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>(
  options: CreateBunSqlDbOptions<SchemaConfig, ColumnTypes>,
): DbResult<ColumnTypes> => {
  return createDbWithAdapter({
    ...options,
    adapter: new BunSqlAdapter(options),
  });
};

const bunConnectionErrorCode = 'ECONNREFUSED';

const normalizeConnectionError = (err: unknown) => {
  if (!err || typeof err !== 'object') return err;

  const record = err as RecordUnknown;
  const message =
    typeof record.message === 'string'
      ? record.message
      : String(record.message ?? '');

  if (
    record.code === bunConnectionErrorCode ||
    (typeof record.code === 'string' &&
      record.code.startsWith('ERR_POSTGRES_CONNECTION_')) ||
    /FailedToOpenSocket|failed to connect|connection closed/i.test(message)
  ) {
    record.code = bunConnectionErrorCode;
  }

  return err;
};

const runUnsafe = async (
  sql: BunSqlClient,
  text: string,
  values?: unknown[],
  arrays?: true,
): Promise<QueryResult | QueryArraysResult> => {
  const query = values?.length ? sql.unsafe(text, values) : sql.unsafe(text);
  const rows = arrays ? await query.values() : await query;
  const firstRow = rows[0];
  // Leave fields empty for arrays/empty results until Bun SQL provides metadata for them.
  // See https://github.com/oven-sh/bun/issues/18866
  const fields =
    firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow)
      ? Object.keys(firstRow).map((name) => ({ name }))
      : [];

  return {
    rowCount: typeof query.count === 'number' ? query.count : rows.length,
    rows,
    fields,
  };
};

const runSavepointQuery = async (
  sql: BunSqlClient,
  text: string,
  values: unknown[] | undefined,
  arrays: true | undefined,
  catchingSavepoint: string,
): Promise<QueryResult | QueryArraysResult> => {
  await runUnsafe(sql, `SAVEPOINT "${catchingSavepoint}"`);

  try {
    const result = await runUnsafe(sql, text, values, arrays);
    await runUnsafe(sql, `RELEASE SAVEPOINT "${catchingSavepoint}"`);
    return result;
  } catch (err) {
    await runUnsafe(sql, `ROLLBACK TO SAVEPOINT "${catchingSavepoint}"`);
    throw err;
  }
};

const runWithLock = <Result>(
  lockable: Lockable,
  cb: () => Promise<Result>,
): Promise<Result> => {
  const lock = lockable.__lock;

  if (lock) {
    let release!: () => void;
    lockable.__lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    return lock.then(() => {
      const promise = cb();
      promise.then(release, release);
      return promise;
    });
  }

  const promise = cb();

  lockable.__lock = promise.catch(() => {});

  return promise;
};

const executeQuery = (
  sql: BunSqlClient,
  text: string,
  values: unknown[] | undefined,
  arrays: true | undefined,
  catchingSavepoint: string | undefined,
  lock?: Lockable,
): Promise<QueryResult | QueryArraysResult> => {
  const perform = () =>
    catchingSavepoint
      ? runSavepointQuery(sql, text, values, arrays, catchingSavepoint)
      : runUnsafe(sql, text, values, arrays);

  return lock ? runWithLock(lock, perform) : perform();
};

const getFromConfig = (
  config: BunSqlAdapterOptions,
  ...keys: (keyof BunSqlAdapterOptions)[]
): string | undefined => {
  for (const key of keys) {
    const value = config[key];
    if (value !== undefined) {
      return String(value);
    }
  }

  return undefined;
};

const getURLFromConfig = (config: BunSqlAdapterOptions): URL | undefined => {
  const urlValue =
    typeof config.databaseURL === 'string'
      ? config.databaseURL
      : typeof config.url === 'string'
      ? config.url
      : undefined;

  return urlValue ? new URL(urlValue) : undefined;
};

const toBunSqlConstructorOptions = (
  config: BunSqlAdapterOptions,
): BunSqlConstructorOptions => {
  const options = { ...config };
  delete options.connectRetry;
  delete options.databaseURL;
  delete options.searchPath;
  delete options.sql;
  return options;
};

export class BunSqlAdapter implements AdapterBase {
  errorClass = getBunGlobal().SQL.PostgresError;
  sql: BunSqlClient;

  constructor(public config: BunSqlAdapterOptions) {
    this.sql = this.configure(config);
  }

  isInTransaction(): boolean {
    return false;
  }

  private configure(config: BunSqlAdapterOptions): BunSqlClient {
    this.config = { ...config };
    let searchPath = this.config.searchPath;

    if (config.databaseURL) {
      const url = new URL(config.databaseURL);

      const ssl = url.searchParams.get('ssl');
      if (ssl && this.config.tls === undefined) {
        this.config.tls = ssl === 'true';
      }

      if (!searchPath) {
        searchPath = url.searchParams.get('searchPath') || undefined;
      }

      url.searchParams.delete('ssl');
      url.searchParams.delete('searchPath');

      this.config.databaseURL = url.toString();
      this.config.url = this.config.databaseURL;
    }

    this.config.searchPath = searchPath === 'public' ? undefined : searchPath;

    const sql = config.sql ?? this.createClient();

    if (config.connectRetry) {
      setConnectRetryConfig(
        this,
        config.connectRetry === true ? emptyObject : config.connectRetry,
      );

      this.connect = wrapAdapterFnWithConnectRetry(this, this.connect);
      this.query = wrapAdapterFnWithConnectRetry(this, this.query);
      this.arrays = wrapAdapterFnWithConnectRetry(this, this.arrays);
    }

    return sql;
  }

  private createClient(): BunSqlClient {
    const { databaseURL } = this.config;
    const bunOptions = toBunSqlConstructorOptions(this.config);

    const options: BunSqlConstructorOptions = {
      ...bunOptions,
      adapter: 'postgres',
    };

    if (this.config.searchPath) {
      options.connection = {
        ...options.connection,
        search_path: this.config.searchPath,
      };
    }

    if (typeof databaseURL === 'string') {
      options.url = databaseURL;
    }

    const Bun = getBunGlobal();
    return new Bun.SQL(options);
  }

  private getURL(): URL | undefined {
    return getURLFromConfig(this.config);
  }

  connect = async (): Promise<unknown> => {
    try {
      if (typeof this.sql.connect === 'function') {
        return await this.sql.connect();
      }

      return await this.sql.unsafe('SELECT 1');
    } catch (err) {
      throw normalizeConnectionError(err);
    }
  };

  async updateConfig(config: BunSqlAdapterOptions): Promise<void> {
    await this.close();
    const nextConfig = { ...this.config, ...config };

    // Allow `searchPath` from a new databaseURL to take effect unless it is
    // explicitly provided in update config.
    if (config.databaseURL !== undefined && config.searchPath === undefined) {
      delete nextConfig.searchPath;
    }

    this.sql = this.configure(nextConfig);
  }

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    searchPath?: string;
  }): AdapterBase {
    const config = { ...this.config };

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

      config.databaseURL = url.toString();
      config.url = config.databaseURL;
    } else {
      if (params.database !== undefined) {
        config.database = params.database;
      }

      if (params.user !== undefined) {
        config.user = params.user;
        config.username = params.user;
      }

      if (params.password !== undefined) {
        config.password = params.password;
      }
    }

    if (params.searchPath !== undefined) {
      config.searchPath = params.searchPath;
    }

    return new BunSqlAdapter(config);
  }

  getDatabase(): string {
    const url = this.getURL();

    return url
      ? url.pathname.slice(1)
      : getFromConfig(this.config, 'database') || '';
  }

  getUser(): string {
    const url = this.getURL();

    return url
      ? url.username
      : getFromConfig(this.config, 'username', 'user') || '';
  }

  getSearchPath(): string | undefined {
    return this.config.searchPath;
  }

  getHost(): string {
    const url = this.getURL();

    return url
      ? url.hostname
      : getFromConfig(this.config, 'hostname', 'host') || '';
  }

  query = async <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryResult<T>> => {
    try {
      return (await executeQuery(
        this.sql,
        text,
        values,
        undefined,
        catchingSavepoint,
      )) as QueryResult<T>;
    } catch (err) {
      throw normalizeConnectionError(err);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays = async <R extends any[] = any[]>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryArraysResult<R>> => {
    try {
      return (await executeQuery(
        this.sql,
        text,
        values,
        true,
        catchingSavepoint,
      )) as QueryArraysResult<R>;
    } catch (err) {
      throw normalizeConnectionError(err);
    }
  };

  async transaction<Result>(
    options: string | undefined,
    cb: (adapter: BunSqlTransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    let ok: true | undefined;
    let result: Result | undefined;

    const run = async (sql: BunSqlClient): Promise<Result> => {
      const adapter = new BunSqlTransactionAdapter(this, sql);

      result = await cb(adapter);
      ok = true;
      return result;
    };

    try {
      return options
        ? await this.sql.begin(options, run)
        : await this.sql.begin(run);
    } catch (err) {
      if (ok) {
        return result as Result;
      }

      throw normalizeConnectionError(err);
    }
  }

  close(): Promise<void> {
    return this.sql.close({ timeout: 0 });
  }

  assignError(to: QueryError, dbError: Error) {
    const error = dbError as BunPostgresError;

    to.message = error.message;
    to.name = error.name as QueryErrorName;

    to.code = error.errno;
    to.detail = error.detail;
    to.severity = error.severity;
    to.hint = error.hint;
    to.position = error.position;
    to.internalPosition = error.internalPosition;
    to.internalQuery = error.internalQuery;
    to.where = error.where;

    to.schema = error.schema;
    to.table = error.table;
    to.column = error.column;
    to.dataType = error.dataType;
    to.constraint = error.constraint;

    to.file = error.file;
    to.line = error.line;
    to.routine = error.routine;
  }
}

export class BunSqlTransactionAdapter implements TransactionAdapterBase {
  errorClass = getBunGlobal().SQL.PostgresError;
  constructor(public adapter: BunSqlAdapter, public sql: BunSqlClient) {}

  isInTransaction(): true {
    return true;
  }

  updateConfig(config: BunSqlAdapterOptions): Promise<void> {
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

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryResult<T>> {
    try {
      return (await executeQuery(
        this.sql,
        text,
        values,
        undefined,
        catchingSavepoint,
        this.sql as Lockable,
      )) as QueryResult<T>;
    } catch (err) {
      throw normalizeConnectionError(err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryArraysResult<R>> {
    try {
      return (await executeQuery(
        this.sql,
        text,
        values,
        true,
        catchingSavepoint,
        this.sql as Lockable,
      )) as QueryArraysResult<R>;
    } catch (err) {
      throw normalizeConnectionError(err);
    }
  }

  async transaction<Result>(
    _options: string | undefined,
    cb: (adapter: BunSqlTransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    return cb(this);
  }

  // Transaction lifecycle is managed by begin(); nothing to close here.
  async close(): Promise<void> {}

  assignError(to: QueryError, from: Error) {
    this.adapter.assignError(to, from);
  }
}
