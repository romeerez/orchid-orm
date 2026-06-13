import {
  AdapterClass,
  AdapterConfigBase,
  ColumnSchemaConfig,
  DbOptions,
  DbResult,
  DefaultColumnTypes,
  defaultSchemaConfig,
  DefaultSchemaConfig,
  DriverAdapter,
  noop,
  QueryResult,
  QueryResultRow,
  QuerySchema,
  quoteIdentifier,
  RecordUnknown,
  AdapterSchemaConfigOptions,
} from 'pqb/internal';
import { createDbWithAdapter } from 'pqb';
import { HackySavepointState } from './adapter';
import { parseInterval } from './driver-adapter-shared';

const schemaConfig: AdapterSchemaConfigOptions = {
  arrayEncode: (input) => {
    return getBun().sql.array(input);
  },
  intervalParse: parseInterval,
  jsonEncodedByDriver: true,
  dateParsedByDriver: true,
};

export const bunSchemaConfig = Object.assign(
  () => defaultSchemaConfig(schemaConfig),
  schemaConfig,
);

export interface CreateBunDbOptions<
  SchemaConfig extends ColumnSchemaConfig,
  ColumnTypes,
>
  extends BunAdapterOptions, DbOptions<SchemaConfig, ColumnTypes> {}

export const createDb = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>({
  log,
  ...options
}: CreateBunDbOptions<SchemaConfig, ColumnTypes>): DbResult<ColumnTypes> => {
  return createDbWithAdapter({
    schemaConfig: bunSchemaConfig as unknown as () => SchemaConfig,
    ...options,
    log,
    adapter: new AdapterClass({
      driverAdapter: BunAdapter,
      config: options,
    }),
  });
};

export interface BunOptions {
  hostname?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string | (() => string | Promise<string>);
  max?: number;
  idleTimeout?: number;
  maxLifetime?: number;
  connectionTimeout?: number;
  prepare?: boolean;
  tls?: unknown;
}

export interface BunAdapterOptions extends AdapterConfigBase, BunOptions {
  schema?: QuerySchema;
  searchPath?: string;
  ssl?: unknown;
}

interface Bun {
  SQL: BunSqlConstructor;
  sql: {
    array(input: unknown): unknown;
  };
}

interface BunSqlConstructor {
  new (options?: BunSqlOptions | string): BunSql;
  PostgresError: ErrorClass;
}

interface BunSqlOptions extends BunOptions {
  url?: string;
  ssl?: unknown;
}

interface BunSql {
  unsafe<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): BunSqlQuery<Row>;
  reserve(): Promise<BunReservedSql>;
  close(options?: { timeout?: number }): Promise<void>;
}

interface BunReservedSql extends BunSql {
  release(): void;
}

interface BunSqlQuery<
  Row extends QueryResultRow = QueryResultRow,
> extends PromiseLike<BunSqlResult<Row>> {
  values(): Promise<BunSqlResult<unknown[]>>;
}

interface BunSqlResult<Row = unknown> extends Array<Row> {
  count?: number;
  affectedRows?: number;
}

// oxlint-disable-next-line typescript/no-explicit-any
type ErrorClass = new (...args: any[]) => Error;

const getBun = (): Bun => {
  const Bun = (globalThis as unknown as { Bun?: Bun }).Bun;
  if (!Bun?.SQL) {
    throw new Error('Bun.SQL is only available when running in Bun');
  }

  return Bun;
};

const getBunPostgresError = (): ErrorClass => {
  return (
    (globalThis as unknown as { Bun?: { SQL: BunSqlConstructor } }).Bun?.SQL
      .PostgresError ?? (Error as ErrorClass)
  );
};

const queryClient = <T = QueryResultRow>(
  client: BunSql,
  text: string,
  values?: unknown[],
  arraysMode?: boolean,
): Promise<QueryResult<T>> => {
  const runQuery = () => {
    const query = client.unsafe(text, values);
    const resultPromise: PromiseLike<BunSqlResult> = arraysMode
      ? query.values()
      : query;

    return Promise.resolve(resultPromise).then((result) => {
      return normalizeResult(result, arraysMode) as QueryResult<T>;
    });
  };

  // Keep a single transactional connection ordered when savepoints are active.
  const { __lock } = client as unknown as { __lock?: Promise<unknown> };
  if (__lock) {
    let resolve: (() => void) | undefined;
    (client as unknown as RecordUnknown).__lock = new Promise<void>((res) => {
      resolve = res;
    });

    return __lock.then(() => {
      const promise = runQuery();
      promise.then(resolve, resolve);
      return promise;
    });
  }

  const promise = runQuery();

  (client as unknown as { __lock?: Promise<unknown> }).__lock =
    promise.catch(noop);

  return promise;
};

const borrowBunClient = (pool: BunSql): Promise<BunReservedSql> => {
  return pool.reserve();
};

const releaseBunClient = (client: BunReservedSql): void => {
  client.release();
};

export const BunAdapter: DriverAdapter = {
  noFieldsForArrays: true,
  manualPool: true,
  schemaConfig,
  errorClass: getBunPostgresError(),
  errorFields: {
    message: 'message',
    severity: 'severity',
    code: 'errno',
    detail: 'detail',
    schema: 'schema',
    table: 'table',
    column: 'column',
    dataType: 'dataType',
    constraint: 'constraint',
    hint: 'hint',
    position: 'position',
    internalPosition: 'internalPosition',
    internalQuery: 'internalQuery',
    where: 'where',
    file: 'file',
    line: 'line',
    routine: 'routine',
  },

  configure(config: BunAdapterOptions): BunSql {
    return new (getBun().SQL)(makeOptions(config));
  },

  queryClient,

  borrow(pool: BunSql): Promise<BunReservedSql> {
    return borrowBunClient(pool);
  },

  release(client: BunReservedSql): void {
    releaseBunClient(client);
  },

  async begin<DriverClient, Result>(
    pool: BunSql,
    cb: (adapter: DriverClient) => Promise<Result>,
    options?: string,
  ): Promise<Result> {
    const client = await borrowBunClient(pool);

    try {
      await queryClient(client, options ? 'BEGIN ' + options : 'BEGIN');

      let result;
      try {
        result = await cb(client as DriverClient);
      } catch (err) {
        await queryClient(client, 'ROLLBACK');
        throw err;
      }

      await queryClient(client, 'COMMIT');
      return result as Result;
    } finally {
      releaseBunClient(client);
    }
  },

  async savepoint<T>(
    client: BunSql,
    // Bun doesn't need to switch the client in a savepoint.
    _setClient: (client: BunSql) => void,
    name: string,
    cb: () => Promise<T>,
  ): Promise<T> {
    const safeName = quoteIdentifier(name);
    try {
      await queryClient(client, `SAVEPOINT ${safeName}`);
      const res = await cb();
      await queryClient(client, `RELEASE SAVEPOINT ${safeName}`);
      return res;
    } catch (err) {
      await queryClient(client, `ROLLBACK TO SAVEPOINT ${safeName}`);
      throw err;
    }
  },

  async hackySavepoint<T extends QueryResultRow>(
    client: BunSql,
    // Bun doesn't need to switch the client in a savepoint.
    _setClient: (client: BunSql) => void,
    state: HackySavepointState,
    text: string,
    values?: unknown[],
    arraysMode?: boolean,
  ): Promise<QueryResult<T>> {
    const safeName = quoteIdentifier(state.name);

    let resolve: (() => void) | undefined;
    let reject: ((err: unknown) => void) | undefined;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    let resultResolve: ((res: QueryResult<T>) => void) | undefined;
    let resultReject: ((err: unknown) => void) | undefined;
    const resultPromise = new Promise<QueryResult<T>>((res, rej) => {
      resultResolve = res;
      resultReject = rej;
    });

    const savepointPromise = (async () => {
      try {
        await queryClient(client, `SAVEPOINT ${safeName}`);

        try {
          const res = await queryClient<T>(client, text, values, arraysMode);
          resultResolve?.(res as QueryResult<T>);
        } catch (err) {
          resultReject?.(err);
          throw err;
        }

        const result = await promise;
        await queryClient(client, `RELEASE SAVEPOINT ${safeName}`);
        return result;
      } catch (err) {
        await queryClient(client, `ROLLBACK TO SAVEPOINT ${safeName}`);
        throw err;
      }
    })();

    state.activeSavepoint = {
      async release() {
        resolve?.();
        await savepointPromise;
      },
      async rollback(err) {
        reject?.(err);
        await savepointPromise.catch(noop);
      },
    };

    return resultPromise;
  },

  close(pool: BunSql): Promise<void> {
    return pool.close();
  },
};

const makeOptions = (config: BunAdapterOptions): BunSqlOptions => {
  const {
    databaseURL,
    host,
    user,
    password,
    port,
    database,
    max,
    idleTimeout,
    maxLifetime,
    connectionTimeout,
    prepare,
    tls,
    ssl,
    setConfig,
    searchPath,
  } = config;

  return {
    url:
      databaseURL && makeUrl(databaseURL, setConfig?.search_path ?? searchPath),
    hostname: host,
    username: user,
    password,
    port,
    database,
    max,
    idleTimeout,
    maxLifetime,
    connectionTimeout,
    prepare,
    tls,
    ssl,
  };
};

const makeUrl = (databaseURL: string, searchPath?: string): string => {
  if (!searchPath) return databaseURL;

  const url = new URL(databaseURL);
  url.searchParams.set('options', `-c search_path=${searchPath}`);
  return url.toString();
};

const normalizeResult = <T>(
  result: BunSqlResult<T>,
  arraysMode?: boolean,
): QueryResult<T> | QueryResult<T>[] => {
  if (!arraysMode && isMultiResult(result)) {
    return result.map((item) => new BunQueryResult(item, arraysMode));
  }

  return new BunQueryResult(result, arraysMode);
};

class BunQueryResult<T> implements QueryResult<T> {
  public rowCount: number;
  public rows: T[];
  private _fields?: QueryResult<T>['fields'];

  constructor(
    private result: BunSqlResult<T>,
    private isArray?: boolean,
  ) {
    this.rowCount = result.count ?? result.affectedRows ?? result.length;

    // creating new Array because BunSqlResult is not a real array - can't do spread on it
    this.rows = Array.from(result) as T[];
  }

  get fields(): QueryResult<T>['fields'] {
    if (this.isArray) {
      throw new Error('Bun does not support fields on array result');
    }

    return (this._fields ??= getFields(this.result));
  }
}

const isMultiResult = <T>(
  result: BunSqlResult<T>,
): result is BunSqlResult<T>[] & BunSqlResult<T> => {
  return Array.isArray(result[0]);
};

const getFields = <T>(rows: T[]): { name: string }[] => {
  const first = rows[0];
  if (!first || Array.isArray(first) || typeof first !== 'object') return [];

  return Object.keys(first).map((name) => ({ name }));
};
