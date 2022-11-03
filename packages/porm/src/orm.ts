import { Adapter, Db, AdapterOptions, QueryLogOptions } from 'pqb';
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
    commonOptions,
  );
  qb.queryBuilder = qb;

  const result = {
    $transaction: transaction,
    $adapter: adapter,
    $queryBuilder: qb,
    $close: () => adapter.close(),
  } as PORM<ModelClasses>;

  const modelInstances: Record<string, Model> = {};

  for (const key in models) {
    if (key[0] === '$') {
      throw new Error(`Model name must not start with $`);
    }

    const model = new models[key]();
    modelInstances[key] = model;

    const dbModel = new Db(adapter, qb, model.table, model.columns.shape, {
      ...commonOptions,
      schema: model.schema,
    });

    const { methods } = models[key];
    if (methods) {
      for (const key in methods) {
        const method = methods[key] as (...args: unknown[]) => unknown;
        (dbModel as unknown as Record<string, unknown>)[key] = function (
          ...args: unknown[]
        ) {
          return method(this, ...args);
        };
      }
    }

    (result as Record<string, unknown>)[key] = dbModel;
  }

  applyRelations(qb, modelInstances, result);

  return result as PORM<T>;
};
