import postgres, { Row, RowList, TransactionSql } from 'postgres';
import {
  AdapterConfigBase,
  QueryResult,
  QueryResultRow,
  returnArg,
  DbOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  DbResult,
  ColumnSchemaConfig,
  AdapterClass,
  DriverAdapter,
  QuerySchema,
  noop,
} from 'pqb/internal';
import { createDbWithAdapter } from 'pqb';
import { HackySavepointState } from './adapter';
import { parseInterval } from './driver-adapter-shared';
import { patchPostgresJsArrayParsers } from './postgres-js-array-parser-patch';

export interface CreatePostgresJsDbOptions<
  SchemaConfig extends ColumnSchemaConfig,
  ColumnTypes,
>
  extends PostgresJsAdapterOptions, DbOptions<SchemaConfig, ColumnTypes> {}

export const createDb = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>(
  options: CreatePostgresJsDbOptions<SchemaConfig, ColumnTypes>,
): DbResult<ColumnTypes> => {
  return createDbWithAdapter({
    ...options,
    adapter: new AdapterClass({
      driverAdapter: PostgresJsAdapter,
      config: options,
    }),
  });
};

export interface PostgresJsAdapterOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extends postgres.Options<any>, Omit<AdapterConfigBase, 'searchPath' | 'ssl'> {
  databaseURL?: string;
  schema?: QuerySchema;
}

type RawResult = RowList<(Row & Iterable<Row>)[]>;

class PostgresJsResult<T extends QueryResultRow> implements QueryResult<T> {
  rowCount: number;
  rows: T[];
  fields: QueryResult<T>['fields'];

  constructor(result: RawResult) {
    this.rowCount = result.count;
    this.rows = result as never;
    this.fields = result.statement?.columns;
  }
}

class PostgresJsArraysResult<
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  R extends any[],
> implements QueryResult<R> {
  rowCount: number;
  rows: R[];
  fields: QueryResult['fields'];

  constructor(result: RawResult) {
    this.rowCount = result.count;
    this.rows = result as never;
    this.fields = result.statement.columns;
  }
}

const types: Record<string, Partial<postgres.PostgresType>> = {
  bytea: {
    to: 17,
    from: 17 as never,
    serialize: (x) => '\\x' + Buffer.from(x).toString('hex'),
    parse: (x: string) => Buffer.from(x.slice(2), 'hex'),
  },
  dateAndTimestampAsStrings: {
    to: 25,
    from: [1082, 1114, 1184],
    parse: returnArg,
  },
  interval: {
    from: [1186],
    serialize: returnArg,
    parse: parseInterval,
  },
  json: {
    to: 114,
    from: [114, 3802],
    parse: (x) => {
      return JSON.parse(x);
    },
  },
};

export const PostgresJsAdapter: DriverAdapter = {
  manualPool: false,

  errorClass: postgres.PostgresError,
  errorFields: {
    message: 'message',
    severity: 'severity',
    code: 'code',
    detail: 'detail',
    schema: 'schema_name',
    table: 'table_name',
    constraint: 'constraint_name',
    hint: 'hint',
    position: 'position',
    where: 'where',
    file: 'file',
    line: 'line',
    routine: 'routine',
  },

  configure(params: PostgresJsAdapterOptions): postgres.Sql {
    const config: PostgresJsAdapterOptions = {
      ...params,
      types,
    };

    if (config.setConfig?.search_path) {
      config.connection = {
        ...config.connection,
        search_path: config.setConfig.search_path,
      };
    }

    let sql;
    if (config.databaseURL) {
      sql = postgres(config.databaseURL, config);
    } else {
      sql = postgres(config);
    }

    patchPostgresJsArrayParsers(sql);

    return sql;
  },

  async queryClient<T = QueryResultRow>(
    client: TransactionSql,
    text: string,
    values?: unknown[],
    arraysMode?: boolean,
  ): Promise<QueryResult<T>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = client.unsafe(text, values as never) as any;

    if (arraysMode) query = query.values();

    const result = await query;
    if (result.constructor === Array) {
      return (result as RawResult[]).map((res) =>
        makePostgresJsResult(res, arraysMode),
      ) as never;
    } else {
      return makePostgresJsResult(
        result as RawResult,
        arraysMode,
      ) as QueryResult<T>;
    }
  },

  borrow(client: postgres.Sql): Promise<postgres.ReservedSql> {
    return client.reserve();
  },

  release(client: postgres.ReservedSql): void {
    client.release();
  },

  begin<DriverClient, Result>(
    client: postgres.Sql,
    cb: (adapter: DriverClient) => Promise<Result>,
    options?: string,
  ): Promise<Result> {
    let ok: boolean | undefined;
    let result: unknown;

    const fn = (sql: TransactionSql): Promise<Result> =>
      cb(sql as DriverClient).then((res) => {
        ok = true;
        return (result = res);
      });

    return (options ? client.begin(options, fn) : client.begin(fn)).catch(
      (err) => {
        if (ok) return result;

        throw err;
      },
    ) as never;
  },

  async savepoint<T>(
    client: postgres.TransactionSql,
    setClient: (client: postgres.TransactionSql) => void,
    name: string,
    cb: () => Promise<T>,
  ): Promise<T> {
    let result: T | undefined;
    await client
      .savepoint(name, async (savepointClient) => {
        setClient(savepointClient);
        result = await cb();
      })
      .finally(() => {
        setClient(client);
      });
    return result as T;
  },

  async hackySavepoint<T extends QueryResultRow>(
    client: postgres.TransactionSql,
    setClient: (client: postgres.TransactionSql) => void,
    state: HackySavepointState,
    text: string,
    values?: unknown[],
    arraysMode?: boolean,
  ): Promise<QueryResult<T>> {
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

    const savepointPromise = client
      .savepoint<void>(state.name, async (savepointClient) => {
        try {
          setClient(savepointClient);

          const res = await this.queryClient<T>(
            savepointClient,
            text,
            values,
            arraysMode,
          );
          resultResolve(res as QueryResult<T>);
        } catch (err) {
          resultReject(err);
          throw err;
        }

        return promise;
      })
      .finally(() => {
        setClient(client);
      });

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

  close(client: postgres.Sql): Promise<void> {
    return client.end();
  },
};

const makePostgresJsResult = (
  result: RawResult,
  arraysMode?: boolean,
): QueryResult => {
  return arraysMode
    ? new PostgresJsArraysResult(result)
    : new PostgresJsResult(result);
};
