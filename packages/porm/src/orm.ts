import { Db, PostgresAdapter, Transaction } from 'pqb';
import { DbModel, Model, ModelClasses } from './model';
import { applyRelations } from './relations/relations';

export type PORM<T extends ModelClasses> = {
  [K in keyof T]: DbModel<T[K]>;
} & {
  transaction: Transaction['transaction'];
  adapter: PostgresAdapter;
  destroy(): Promise<void>;
};

export const porm = (adapter: PostgresAdapter) => {
  const qb = new Db(adapter, undefined as unknown as Db);
  qb.queryBuilder = qb;

  return <T extends ModelClasses>(models: T): PORM<T> => {
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
          schema: model.schema,
        },
      );
    }

    applyRelations(qb, modelInstances, result);

    return result as PORM<T>;
  };
};
