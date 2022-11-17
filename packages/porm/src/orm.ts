import { Adapter, Db, AdapterOptions, QueryLogOptions, columnTypes } from 'pqb';
import { DbModel, Model, ModelClasses } from './model';
import { applyRelations } from './relations/relations';
import { transaction } from './transaction';

export type PORM<T extends ModelClasses> = {
  [K in keyof T]: DbModel<T[K]>;
} & {
  $transaction: typeof transaction;
  $adapter: Adapter;
  $queryBuilder: Db;
  $close(): Promise<void>;
};

export const porm = <T extends ModelClasses>(
  {
    log,
    logger,
    ...options
  }: ({ adapter: Adapter } | Omit<AdapterOptions, 'log'>) & QueryLogOptions,
  models: T,
): PORM<T> => {
  const adapter = 'adapter' in options ? options.adapter : new Adapter(options);
  const commonOptions = { log, logger };
  const qb = new Db(
    adapter,
    undefined as unknown as Db,
    undefined,
    {},
    columnTypes,
    commonOptions,
  );
  qb.queryBuilder = qb as unknown as Db;

  const result = {
    $transaction: transaction,
    $adapter: adapter,
    $queryBuilder: qb,
    $close: () => adapter.close(),
  } as unknown as PORM<ModelClasses>;

  const modelInstances: Record<string, Model> = {};

  for (const key in models) {
    if (key[0] === '$') {
      throw new Error(`Model name must not start with $`);
    }

    const model = new models[key]();
    modelInstances[key] = model;

    const dbModel = new Db(
      adapter,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qb as any,
      model.table,
      model.columns.shape,
      model.columnTypes,
      {
        ...commonOptions,
        schema: model.schema,
      },
    );

    (dbModel as unknown as { definedAs: string }).definedAs = key;
    (dbModel as unknown as { db: unknown }).db = result;

    (result as Record<string, unknown>)[key] = dbModel;
  }

  applyRelations(qb, modelInstances, result);

  return result as unknown as PORM<T>;
};
