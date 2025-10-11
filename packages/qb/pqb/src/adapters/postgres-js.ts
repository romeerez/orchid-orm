import {
  AdapterBase,
  AdapterConfigBase,
  ColumnSchemaConfig,
  emptyObject,
  MaybeArray,
  QueryArraysResult,
  QueryError,
  QueryResult,
  QueryResultRow,
  returnArg,
  setConnectRetryConfig,
  wrapAdapterFnWithConnectRetry,
} from 'orchid-core';
import postgres, { Error, Row, RowList } from 'postgres';
import {
  DbOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  createDbWithAdapter,
  DbResult,
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

    this.schema = config.schema;
    if (this.schema) {
      this.config.connection = {
        ...config.connection,
        search_path: this.schema,
      };
    }

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

      this.sql = postgres(url.toString(), this.config);
    } else {
      this.sql = postgres(this.config);
    }

    if (config.connectRetry) {
      setConnectRetryConfig(
        this,
        config.connectRetry === true ? emptyObject : config.connectRetry,
      );

      this.query = wrapAdapterFnWithConnectRetry(this, this.query);
      this.arrays = wrapAdapterFnWithConnectRetry(this, this.arrays);
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
  ): Promise<QueryResult<T>> {
    return query(this.sql, text, values);
  }

  arrays<R extends any[] = any[]>(
    text: string,
    values?: unknown[],
  ): Promise<QueryArraysResult<R>> {
    return arrays(this.sql, text, values);
  }

  async transaction<Result>(
    options: string | undefined,
    cb: (adapter: AdapterBase) => Promise<Result>,
  ): Promise<Result> {
    return (
      options
        ? this.sql.begin(options, (sql) =>
            cb(new PostgresJsTransactionAdapter(this, sql)),
          )
        : this.sql.begin((sql) =>
            cb(new PostgresJsTransactionAdapter(this, sql)),
          )
    ) as never;
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
): Promise<QueryResult<T>> => {
  return sql.unsafe(text, values as never).then(wrapResult);
};

const arrays = <R extends any[] = any[]>(
  sql: postgres.Sql,
  text: string,
  values?: unknown[],
): Promise<QueryArraysResult<R>> => {
  return sql
    .unsafe(text, values as never)
    .values()
    .then(wrapResult);
};

export class PostgresJsTransactionAdapter implements AdapterBase {
  errorClass = postgres.PostgresError;

  constructor(public adapter: PostgresJsAdapter, public sql: postgres.Sql) {}

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
