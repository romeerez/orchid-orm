import { PostgresModelConstructor, PostgresModelConstructors } from './model';
import {
  MapRelationMethods,
  ModelOrQuery,
  Relations,
} from './relations/relations';
import { BelongsTo } from './relations/belongsTo';
import { Query } from '../queryBuilder/query';
import { PostgresAdapter } from '../queryBuilder/adapter';

type PostgresORM<T extends PostgresModelConstructors> = {
  [K in keyof T]: MapRelationMethods<InstanceType<T[K]>>;
} & {
  adapter: PostgresAdapter;
  destroy(): Promise<void>;
};

export const PostgresOrm =
  (adapter: PostgresAdapter) =>
  <T extends PostgresModelConstructors>(models: T): PostgresORM<T> => {
    const result = {
      adapter,
      destroy: () => adapter.destroy(),
    } as PostgresORM<T>;

    for (const key in models) {
      if (key === 'adapter' || key === 'destroy') {
        throw new Error(`Please choose another key for model ${key}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result[key] = new models[key](adapter) as any;
    }

    for (const key in models) {
      const model = result[key] as unknown as MapRelationMethods<Query>;
      model.relations = {} as Relations<Query>;

      for (const prop in model) {
        const item = model[prop as keyof typeof model];
        if (item instanceof BelongsTo) {
          const modelOrQuery = item.fn() as ModelOrQuery;
          const query =
            typeof modelOrQuery === 'function'
              ? modelToQuery(
                  result as PostgresORM<PostgresModelConstructors>,
                  modelOrQuery,
                )
              : (modelOrQuery as Query);

          if (item instanceof BelongsTo) {
            item.applyToModel(model as unknown as Query, query, prop);
          }
        }
      }
    }

    return result;
  };

const modelToQuery = (
  result: PostgresORM<PostgresModelConstructors>,
  model: PostgresModelConstructor,
): Query => {
  for (const key in result) {
    if (result[key] instanceof model) {
      return result[key] as unknown as Query;
    }
  }
  throw new Error(`Cannot find model for ${model.name}`);
};
