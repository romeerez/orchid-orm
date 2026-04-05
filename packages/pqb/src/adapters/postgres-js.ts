import postgres, { Error, Row, RowList, TransactionSql } from 'postgres';
import {
  AdapterBase,
  AdapterConfigBase,
  emptyObject,
  MaybeArray,
  QueryArraysResult,
  QueryResult,
  QueryResultRow,
  returnArg,
  setConnectRetryConfig,
  wrapAdapterFnWithConnectRetry,
  DbOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  DbResult,
  ColumnSchemaConfig,
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

export interface CreatePostgresJsDbOptions<
  SchemaConfig extends ColumnSchemaConfig,
  ColumnTypes,
> extends PostgresJsAdapterOptions,
    DbOptions<SchemaConfig, ColumnTypes> {}

export const createDb = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>(
  options: CreatePostgresJsDbOptions<SchemaConfig, ColumnTypes>,
): DbResult<ColumnTypes> => {
  return createDbWithAdapter({
    ...options,
    adapter: new PostgresJsAdapter(options as never),
  });
};

export interface PostgresJsAdapterOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extends postgres.Options<any>,
    AdapterConfigBase {
  databaseURL?: string;
  searchPath?: string;
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
    this.fields = result.statement.columns;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrapResult = (result: MaybeArray<RawResult>): QueryArraysResult<any> => {
  if (result.constructor === Array) {
    return (result as RawResult[]).map(
      (res) => new PostgresJsResult(res),
    ) as never;
  } else {
    return new PostgresJsResult(result as RawResult);
  }
};

const types: Record<string, Partial<postgres.PostgresType>> = {
  bytea: {
    to: 17,
    from: 17 as never,
    serialize: (x) => '\\x' + Buffer.from(x).toString('hex'),
    // omit parse, let bytea return a string, so it remains consistent with when it's selected via JSON
  },
  dateAndTimestampAsStrings: {
    to: 25,
    from: [1082, 1114, 1184],
    parse: returnArg,
  },
  interval: {
    from: [1186],
    serialize: returnArg,
    parse(str: string) {
      const [years, , months, , days, , time] = str.split(' ');
      const [hours, minutes, seconds] = time.split(':');

      return {
        years: years ? Number(years) : 0,
        months: months ? Number(months) : 0,
        days: days ? Number(days) : 0,
        hours: hours ? Number(hours) : 0,
        minutes: minutes ? Number(minutes) : 0,
        seconds: seconds ? Number(seconds) : 0,
      };
    },
  },
  // overrides the built-in json type to not serialize it, because it incorrectly serializes
  json: {
    to: 114,
    from: [114, 3802],
    serialize: returnArg,
    parse: (x) => {
      return JSON.parse(x);
    },
  },
};

export class PostgresJsAdapter implements AdapterBase {
  sql: postgres.Sql;
  searchPath?: string;
  config: PostgresJsAdapterOptions;
  errorClass = postgres.PostgresError;
  locals: RecordStringOrNumber;
  private wrappedWithConnectRetry?: boolean;

  constructor(config: PostgresJsAdapterOptions) {
    this.config = { ...config, types };
    this.sql = this.configure(config);
    this.locals = config.searchPath
      ? {
          search_path: config.searchPath,
        }
      : emptyObject;
  }

  isInTransaction(): boolean {
    return false;
  }

  private configure(config: PostgresJsAdapterOptions): postgres.Sql {
    this.searchPath = config.searchPath;
    if (this.searchPath) {
      this.config.connection = {
        ...config.connection,
        search_path: this.searchPath,
      };
    }

    let sql;
    if (this.config.databaseURL) {
      const urlString = this.config.databaseURL;
      const url = new URL(urlString);

      const ssl = url.searchParams.get('ssl');
      if (ssl === 'false' || ssl === 'true') {
        this.config.ssl = ssl === 'true';
      }

      const searchPath = url.searchParams.get('searchPath');
      if (searchPath) {
        this.searchPath = searchPath;
        url.searchParams.delete('searchPath');
        this.config.connection = {
          ...config.connection,
          search_path: searchPath,
        };
      }

      sql = postgres(url.toString(), this.config);
    } else {
      sql = postgres(this.config);
    }

    if (config.connectRetry) {
      setConnectRetryConfig(
        this,
        config.connectRetry === true ? emptyObject : config.connectRetry,
      );

      if (!this.wrappedWithConnectRetry) {
        this.query = wrapAdapterFnWithConnectRetry(this, this.query);
        this.arrays = wrapAdapterFnWithConnectRetry(this, this.arrays);
        this.wrappedWithConnectRetry = true;
      }
    }

    return sql;
  }

  private getURL(): URL | undefined {
    return this.config.databaseURL
      ? new URL(this.config.databaseURL)
      : undefined;
  }

  private replaceSql(config: PostgresJsAdapterOptions): Promise<void> {
    const { sql } = this;
    // Swap the client before ending the old one so the adapter remains reusable
    this.sql = this.configure(config);
    return sql.end();
  }

  async updateConfig(config: PostgresJsAdapterOptions): Promise<void> {
    await this.replaceSql({ ...this.config, ...config });
  }

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    searchPath?: string;
  }): AdapterBase {
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

      return new PostgresJsAdapter({
        ...this.config,
        databaseURL: url.toString(),
      });
    } else {
      return new PostgresJsAdapter({ ...this.config, ...params });
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

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return query(this.sql, text, values);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
  ): Promise<QueryArraysResult<R>> {
    return arrays(this.sql, text, values);
  }

  async transaction<Result>(...args: TransactionArgs<Result>): Promise<Result> {
    let ok: boolean | undefined;
    let result: unknown;

    const { cb, options } = getTransactionArgs(args);

    const fn = (sql: TransactionSql) => {
      const localsSql = getSetLocalsSql(options);
      if (localsSql) {
        sql.unsafe(localsSql).execute();
      }

      const locals = mergeLocals(this.locals, options);

      return cb(
        new PostgresJsTransactionAdapter(this, sql as never, this, locals),
      ).then((res) => {
        ok = true;
        return (result = res);
      });
    };

    return (
      options?.options
        ? this.sql.begin(options.options, fn)
        : this.sql.begin(fn)
    ).catch((err) => {
      if (ok) return result;

      throw err;
    }) as never;
  }

  close(): Promise<void> {
    return this.replaceSql(this.config);
  }

  assignError(to: QueryError, dbError: Error) {
    const from = dbError as postgres.PostgresError;
    to.message = from.message;
    to.severity = from.severity;
    to.code = from.code;
    to.detail = from.detail;
    to.schema = from.schema_name;
    to.table = from.table_name;
    to.constraint = from.constraint_name;
    to.hint = from.hint;
    to.position = from.position;
    to.where = from.where;
    to.file = from.file;
    to.line = from.line;
    to.routine = from.routine;
  }
}

const query = <T extends QueryResultRow = QueryResultRow>(
  sql: postgres.Sql,
  text: string,
  values?: unknown[],
  startingSavepoint?: string,
  releasingSavepoint?: string,
  arrays?: boolean,
): Promise<QueryResult<T>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = sql.unsafe(text, values as never) as any;

  if (arrays) query = query.values();

  if (!startingSavepoint && !releasingSavepoint) {
    return query.then(wrapResult);
  }

  return Promise.all([
    startingSavepoint && sql.unsafe(`SAVEPOINT "${startingSavepoint}"`),
    query,
    releasingSavepoint &&
      sql.unsafe(`RELEASE SAVEPOINT "${releasingSavepoint}"`),
  ]).then(
    (results: RawResult[]) => {
      return wrapResult(results[1]);
    },
    (err) => {
      if (!releasingSavepoint) {
        throw err;
      }

      return sql
        .unsafe(`ROLLBACK TO SAVEPOINT "${releasingSavepoint}"`)
        .then(() => {
          throw err;
        });
    },
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arrays = <R extends any[] = any[]>(
  sql: postgres.Sql,
  text: string,
  values?: unknown[],
  startingSavepoint?: string,
  releasingSavepoint?: string,
): Promise<QueryArraysResult<R>> => {
  return query(sql, text, values, startingSavepoint, releasingSavepoint, true);
};

export class PostgresJsTransactionAdapter implements TransactionAdapterBase {
  errorClass = postgres.PostgresError;

  constructor(
    public adapter: PostgresJsAdapter,
    public sql: postgres.Sql,
    public parent: AdapterBase,
    public locals: RecordStringOrNumber,
  ) {}

  isInTransaction(): true {
    return true;
  }

  updateConfig(config: PostgresJsAdapterOptions): Promise<void> {
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
    return this.adapter.searchPath;
  }

  getHost(): string {
    return this.adapter.getHost();
  }

  getSchema(): QuerySchema | undefined {
    return this.adapter.getSchema();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    startingSavepoint?: string,
    releasingSavepoint?: string,
  ): Promise<QueryResult<T>> {
    return query(this.sql, text, values, startingSavepoint, releasingSavepoint);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
    startingSavepoint?: string,
    releasingSavepoint?: string,
  ): Promise<QueryArraysResult<R>> {
    return arrays(
      this.sql,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
    );
  }

  async transaction<Result>(...args: TransactionArgs<Result>): Promise<Result> {
    const { cb, options } = getTransactionArgs(args);
    const localsSql = getSetLocalsSql(options);
    if (localsSql) {
      this.sql.unsafe(localsSql).execute();
    }

    const locals = mergeLocals(this.locals, options);

    const res = (await cb(
      new PostgresJsTransactionAdapter(this.adapter, this.sql, this, locals),
    )) as Result;

    const resetLocalsSql = getResetLocalsSql(this.locals, options);
    if (resetLocalsSql) {
      await this.sql.unsafe(resetLocalsSql);
    }

    return res;
  }

  close(): Promise<void> {
    return this.sql.end();
  }

  assignError(to: QueryError, from: Error) {
    return this.adapter.assignError(to, from);
  }
}
