import postgres, { Error, Row, RowList } from 'postgres';
import {
  AdapterBase,
  AdapterConfigBase,
  emptyObject,
  MaybeArray,
  QueryArraysResult,
  QueryError,
  QueryResult,
  QueryResultRow,
  returnArg,
  setConnectRetryConfig,
  wrapAdapterFnWithConnectRetry,
  DbOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  createDbWithAdapter,
  DbResult,
  ColumnSchemaConfig,
} from 'pqb';

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
  schema?: string;
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
  schema?: string;
  config: PostgresJsAdapterOptions;
  errorClass = postgres.PostgresError;

  constructor(config: PostgresJsAdapterOptions) {
    this.config = { ...config, types };
    this.sql = this.configure(config);
  }

  private configure(config: PostgresJsAdapterOptions): postgres.Sql {
    this.schema = config.schema;
    if (this.schema) {
      this.config.connection = {
        ...config.connection,
        search_path: this.schema,
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

      const schema = url.searchParams.get('schema');
      if (schema) {
        this.schema = schema;
        url.searchParams.delete('schema');
        this.config.connection = {
          ...config.connection,
          search_path: schema,
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

      this.query = wrapAdapterFnWithConnectRetry(this, this.query);
      this.arrays = wrapAdapterFnWithConnectRetry(this, this.arrays);
    }

    return sql;
  }

  private getURL(): URL | undefined {
    return this.config.databaseURL
      ? new URL(this.config.databaseURL)
      : undefined;
  }

  async updateConfig(config: PostgresJsAdapterOptions): Promise<void> {
    await this.close();
    this.sql = this.configure({ ...this.config, ...config });
  }

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    schema?: string;
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

      if (params.schema !== undefined) {
        url.searchParams.set('schema', params.schema);
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

  getSchema(): string | undefined {
    return this.schema;
  }

  getHost(): string {
    const url = this.getURL();
    return url ? url.hostname : (this.config.host as string);
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryResult<T>> {
    return query(this.sql, text, values, catchingSavepoint);
  }

  arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryArraysResult<R>> {
    return arrays(this.sql, text, values, catchingSavepoint);
  }

  async transaction<Result>(
    options: string | undefined,
    cb: (adapter: AdapterBase) => Promise<Result>,
  ): Promise<Result> {
    let ok: boolean | undefined;
    let result: unknown;

    return (
      options
        ? this.sql.begin(options, (sql) =>
            cb(new PostgresJsTransactionAdapter(this, sql)).then((res) => {
              ok = true;
              return (result = res);
            }),
          )
        : this.sql.begin((sql) =>
            cb(new PostgresJsTransactionAdapter(this, sql)).then((res) => {
              ok = true;
              return (result = res);
            }),
          )
    ).catch((err) => {
      if (ok) return result;

      throw err;
    }) as never;
  }

  close(): Promise<void> {
    return this.sql.end();
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
  catchingSavepoint?: string,
  arrays?: boolean,
): Promise<QueryResult<T>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = sql.unsafe(text, values as never) as any;

  if (arrays) query = query.values();

  if (catchingSavepoint) {
    return Promise.all([
      sql.unsafe(`SAVEPOINT "${catchingSavepoint}"`),
      query,
      sql.unsafe(`RELEASE SAVEPOINT "${catchingSavepoint}"`),
    ]).then(
      (results: RawResult[]) => {
        return wrapResult(results[1]);
      },
      (err) =>
        sql.unsafe(`ROLLBACK TO SAVEPOINT "${catchingSavepoint}"`).then(() => {
          throw err;
        }),
    );
  } else {
    return query.then(wrapResult);
  }
};

const arrays = <R extends any[] = any[]>(
  sql: postgres.Sql,
  text: string,
  values?: unknown[],
  catchingSavepoint?: string,
): Promise<QueryArraysResult<R>> => {
  return query(sql, text, values, catchingSavepoint, true);
};

export class PostgresJsTransactionAdapter implements AdapterBase {
  errorClass = postgres.PostgresError;

  constructor(public adapter: PostgresJsAdapter, public sql: postgres.Sql) {}

  updateConfig(config: PostgresJsAdapterOptions): Promise<void> {
    return this.adapter.updateConfig(config);
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
    return this.adapter.schema;
  }

  getHost(): string {
    return this.adapter.getHost();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryResult<T>> {
    return query(this.sql, text, values, catchingSavepoint);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
    catchingSavepoint?: string,
  ): Promise<QueryArraysResult<R>> {
    return arrays(this.sql, text, values, catchingSavepoint);
  }

  async transaction<Result>(
    _options: string | undefined,
    cb: (adapter: PostgresJsTransactionAdapter) => Promise<Result>,
  ): Promise<Result> {
    return await cb(this);
  }

  close(): Promise<void> {
    return this.sql.end();
  }

  assignError(to: QueryError, from: Error) {
    return this.adapter.assignError(to, from);
  }
}
