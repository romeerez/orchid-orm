import postgres, { Row, RowList, TransactionSql } from 'postgres';
import {
  AdapterConfigBase,
  MaybeArray,
  QueryArraysResult,
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
} from 'pqb/internal';
import { createDbWithAdapter } from 'pqb';

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
    const config: PostgresJsAdapterOptions = { ...params, types };

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

    return sql;
  },

  queryClient<T extends QueryResultRow = QueryResultRow>(
    client: TransactionSql,
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    arraysMode?: boolean,
  ): Promise<QueryResult<T>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = client.unsafe(text, values as never) as any;

    if (arraysMode) query = query.values();

    if (!startingSavepoint && !releasingSavepoint) {
      return query.then(wrapResult);
    }

    return Promise.all([
      startingSavepoint && client.unsafe(`SAVEPOINT "${startingSavepoint}"`),
      query,
      releasingSavepoint &&
        client.unsafe(`RELEASE SAVEPOINT "${releasingSavepoint}"`),
    ]).then(
      (results: RawResult[]) => {
        return wrapResult(results[1]);
      },
      (err) => {
        if (!releasingSavepoint) {
          throw err;
        }

        return client
          .unsafe(`ROLLBACK TO SAVEPOINT "${releasingSavepoint}"`)
          .then(() => {
            throw err;
          });
      },
    );
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

  close(client: postgres.Sql): Promise<void> {
    return client.end();
  },
};
