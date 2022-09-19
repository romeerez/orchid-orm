import { Adapter, DbOptions, Db, Transaction } from 'pqb';
import { DbModel, Model, ModelClasses } from './model';
import { applyRelations } from './relations/relations';

export type PORM<T extends ModelClasses> = {
  [K in keyof T]: DbModel<T[K]>;
} & {
  transaction: Transaction['transaction'];
  adapter: Adapter;
  destroy(): Promise<void>;
};

export const porm = <T extends ModelClasses>(
  { log, logger, ...options }: DbOptions,
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
    transaction: Transaction.prototype.transaction,
    adapter,
    destroy: () => adapter.destroy(),
  } as PORM<ModelClasses>;

  const modelInstances: Record<string, Model> = {};

  for (const key in models) {
    if (key === 'adapter' || key === 'destroy') {
      throw new Error(`Please choose another key for model ${key}`);
    }

    const model = new models[key]();
    modelInstances[key] = model;

    (result as Record<string, unknown>)[key] = new Db(
      adapter,
      qb,
      model.table,
      model.columns.shape,
      {
        ...commonOptions,
        schema: model.schema,
      },
    );
  }

  applyRelations(qb, modelInstances, result);

  return result as PORM<T>;
};
