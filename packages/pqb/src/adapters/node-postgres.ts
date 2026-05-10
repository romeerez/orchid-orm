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
} from 'pqb/internal';
import { createDbWithAdapter } from 'pqb';

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
  types.builtins.BYTEA,
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

const queryClient = <T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  text: string,
  values?: unknown[],
  // only has effect in a transaction
  startingSavepoint?: string,
  releasingSavepoint?: string,
  // SQL session state (role and setConfig) from async storage
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

export const NodePostgresAdapter: DriverAdapter = {
  manualPool: true,

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

  close(pool: Pool): Promise<void> {
    return pool.end();
  },
};

const defaultTypesConfig = {
  getTypeParser(id: number) {
    return defaultTypeParsers[id] || returnArg;
  },
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
