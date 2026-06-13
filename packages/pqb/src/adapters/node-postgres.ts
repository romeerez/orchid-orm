import pg, { DatabaseError, Pool, PoolClient, PoolConfig } from 'pg';
import {
  AdapterConfigBase,
  ColumnSchemaConfig,
  noop,
  QueryResult,
  QueryResultRow,
  RecordUnknown,
  returnArg,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  DbOptions,
  DbResult,
  QuerySchema,
  AdapterClass,
  DriverAdapter,
  defaultSchemaConfig,
  quoteIdentifier,
  AdapterSchemaConfigOptions,
} from 'pqb/internal';
import { createDbWithAdapter } from 'pqb';
import { HackySavepointState } from './adapter';

const schemaConfig: AdapterSchemaConfigOptions = {
  jsonEncodedByDriver: false,
};

export const nodePostgresSchemaConfig = Object.assign(
  () => defaultSchemaConfig(schemaConfig),
  schemaConfig,
);

export const createDb = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>({
  log,
  ...options
}: DbOptions<SchemaConfig, ColumnTypes> &
  Omit<NodePostgresAdapterOptions, 'log'>): DbResult<ColumnTypes> => {
  return createDbWithAdapter({
    schemaConfig: nodePostgresSchemaConfig as unknown as () => SchemaConfig,
    ...options,
    log,
    adapter: new AdapterClass({
      driverAdapter: NodePostgresAdapter,
      config: options,
    }),
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
].forEach((id) => {
  delete defaultTypeParsers[id];
});

export interface AdapterConfig
  extends
    Omit<AdapterConfigBase, 'searchPath' | 'ssl'>,
    Omit<PoolConfig, 'types' | 'connectionString'> {
  databaseURL?: string;
}

export interface NodePostgresAdapterOptions extends Omit<AdapterConfig, 'log'> {
  schema?: QuerySchema;
}

const queryClient = <T = QueryResultRow>(
  client: PoolClient,
  text: string,
  values?: unknown[],
  arraysMode?: boolean,
): Promise<QueryResult<T>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    text,
    values,
    rowMode: arraysMode ? 'array' : undefined,
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
      const promise = client.query(params) as Promise<QueryResult>;
      promise.then(resolve, resolve);
      return promise.then((result) =>
        arraysMode ? normalizeArraysResult(result) : result,
      ) as Promise<QueryResult<T>>;
    });
  }

  const promise = client.query(params) as Promise<QueryResult>;

  (client as unknown as { __lock?: Promise<unknown> }).__lock =
    promise.catch(noop);

  return promise.then((result) =>
    arraysMode ? normalizeArraysResult(result) : result,
  ) as Promise<QueryResult<T>>;
};

export const NodePostgresAdapter: DriverAdapter = {
  manualPool: true,
  schemaConfig,
  errorClass: DatabaseError,
  errorFields: {
    message: 'message',
    length: 'length',
    name: 'name',
    severity: 'severity',
    code: 'code',
    detail: 'detail',
    hint: 'hint',
    position: 'position',
    internalPosition: 'internalPosition',
    internalQuery: 'internalQuery',
    where: 'where',
    schema: 'schema',
    table: 'table',
    column: 'column',
    dataType: 'dataType',
    constraint: 'constraint',
    file: 'file',
    line: 'line',
    routine: 'routine',
  },

  configure(config: NodePostgresAdapterOptions): pg.Pool {
    if (config.databaseURL) {
      (config as PoolConfig).connectionString = config.databaseURL;
    }

    if (config.setConfig?.search_path) {
      config = {
        ...config,
        options: `${config.options ? `${config.options} ` : ''}-c search_path="${config.setConfig.search_path}"`,
      };
    }

    return new pg.Pool(config);
  },

  queryClient,

  borrow(pool: Pool): Promise<PoolClient> {
    return pool.connect();
  },

  release(client: PoolClient): void {
    client.release();
  },

  async begin<DriverClient, Result>(
    pool: Pool,
    cb: (adapter: DriverClient) => Promise<Result>,
    options?: string,
  ): Promise<Result> {
    const client = await pool.connect();

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
      client.release();
    }
  },

  async savepoint<T>(
    client: PoolClient,
    // node-postgres doesn't need to switch the client in a savepoint
    _setClient: (client: PoolClient) => void,
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
    client: PoolClient,
    // node-postgres doesn't need to switch the client in a savepoint
    _setClient: (client: PoolClient) => void,
    state: HackySavepointState,
    text: string,
    values?: unknown[],
    arraysMode?: boolean,
  ): Promise<QueryResult<T>> {
    const safeName = state.name.replaceAll('"', '""');

    let resolve: () => void;
    let reject: (err: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    let resultResolve: (res: QueryResult<T>) => void;
    let resultReject: (err: unknown) => void;
    const resultPromise = new Promise<QueryResult<T>>((res, rej) => {
      resultResolve = res;
      resultReject = rej;
    });

    const savepointPromise = (async () => {
      try {
        await queryClient(client, `SAVEPOINT ${safeName}`);

        try {
          const res = await queryClient<T>(client, text, values, arraysMode);
          resultResolve!(res as QueryResult<T>);
        } catch (err) {
          resultReject!(err);
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
        resolve();
        await savepointPromise;
      },
      async rollback(err) {
        reject(err);
        await savepointPromise.catch(noop);
      },
    };

    return resultPromise;
  },

  close(pool: Pool): Promise<void> {
    return pool.end();
  },
};

const defaultTypesConfig = {
  getTypeParser(id: number) {
    return defaultTypeParsers[id] || returnArg;
  },
};

const normalizeArraysResult = <
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  R extends any[] = any[],
>(
  result: QueryResult,
): QueryResult<R> => {
  return result as unknown as QueryResult<R>;
};
