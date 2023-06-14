import {
  Adapter,
  AdapterOptions,
  anyShape,
  columnTypes,
  Db,
  DbTableOptions,
  FromArgs,
  FromResult,
  NoPrimaryKeyOption,
  Query,
  QueryData,
  QueryLogOptions,
} from 'pqb';
import { DbTable, Table, TableClasses } from './baseTable';
import { applyRelations } from './relations/relations';
import { transaction } from './transaction';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TransactionState } from 'orchid-core';

export type OrchidORM<T extends TableClasses = TableClasses> = {
  [K in keyof T]: DbTable<T[K]>;
} & {
  $transaction: typeof transaction;
  $adapter: Adapter;
  $queryBuilder: Db;
  $from<Args extends FromArgs<Query>>(...args: Args): FromResult<Query, Args>;
  $close(): Promise<void>;
};

export const orchidORM = <T extends TableClasses>(
  {
    log,
    logger,
    autoPreparedStatements,
    noPrimaryKey = 'error',
    ...options
  }: ({ db: Query } | { adapter: Adapter } | Omit<AdapterOptions, 'log'>) &
    QueryLogOptions & {
      autoPreparedStatements?: boolean;
      noPrimaryKey?: NoPrimaryKeyOption;
    },
  tables: T,
): OrchidORM<T> => {
  const commonOptions = {
    log,
    logger,
    autoPreparedStatements,
    noPrimaryKey,
  };

  let adapter: Adapter;
  let transactionStorage;
  let qb: Query;
  if ('db' in options) {
    adapter = options.db.query.adapter;
    transactionStorage = options.db.internal.transactionStorage;
    qb = options.db.queryBuilder;
  } else {
    adapter = 'adapter' in options ? options.adapter : new Adapter(options);

    transactionStorage = new AsyncLocalStorage<TransactionState>();

    qb = new Db(
      adapter,
      undefined as unknown as Db,
      undefined,
      anyShape,
      columnTypes,
      transactionStorage,
      commonOptions,
    );
    qb.queryBuilder = qb as unknown as Db;
  }

  const result = {
    $transaction: transaction,
    $adapter: adapter,
    $queryBuilder: qb,
    $from: (...args: FromArgs<Query>) => qb.from(...args),
    $close: () => adapter.close(),
  } as unknown as OrchidORM;

  const tableInstances: Record<string, Table> = {};

  for (const key in tables) {
    if (key[0] === '$') {
      throw new Error(`Table class name must not start with $`);
    }

    const table = new tables[key]();
    tableInstances[key] = table;

    const options: DbTableOptions = {
      ...commonOptions,
      schema: table.schema,
    };

    if (table.noPrimaryKey) options.noPrimaryKey = 'ignore';

    const dbTable = new Db(
      adapter,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qb as any,
      table.table,
      table.columns.shape,
      table.columnTypes,
      transactionStorage,
      options,
    );

    (dbTable as unknown as { definedAs: string }).definedAs = key;
    (dbTable as unknown as { db: unknown }).db = result;
    (dbTable as unknown as { filePath: string }).filePath = table.filePath;
    (dbTable as unknown as { name: string }).name = table.constructor.name;

    (result as Record<string, unknown>)[key] = dbTable;
  }

  applyRelations(qb, tableInstances, result);

  for (const key in tables) {
    const table = tableInstances[key] as unknown as {
      init?(orm: unknown): void;
      query: QueryData;
    };

    if (table.init) {
      table.init(result);
      // assign before and after hooks from table.query to the table base query
      Object.assign(result[key].baseQuery.query, table.query);
    }
  }

  return result as unknown as OrchidORM<T>;
};
