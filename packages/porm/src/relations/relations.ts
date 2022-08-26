import { BelongsTo, BelongsToMethod, makeBelongsToMethod } from './belongsTo';
import { HasOne, HasOneMethod, makeHasOneMethod } from './hasOne';
import { DbModel, Model, ModelClass, ModelClasses } from '../model';
import { PORM } from '../orm';
import { Query } from 'pqb';
import { HasMany, HasManyMethod, makeHasManyMethod } from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyMethod,
  makeHasAndBelongsToManyMethod,
} from './hasAndBelongsToMany';

export interface RelationThunkBase {
  type: string;
  fn(): ModelClass;
  options: {
    scope?(q: Query): Query;
  };
}

export type RelationThunk = BelongsTo | HasOne | HasMany | HasAndBelongsToMany;

export type RelationThunks = Record<string, RelationThunk>;

export type RelationScopeOrModel<Relation extends RelationThunkBase> =
  Relation['options']['scope'] extends (q: Query) => Query
    ? ReturnType<Relation['options']['scope']>
    : DbModel<ReturnType<Relation['fn']>>;

export type MapRelation<
  T extends Model,
  Relation extends RelationThunk,
> = Relation extends BelongsTo
  ? BelongsToMethod<T, Relation>
  : Relation extends HasOne
  ? HasOneMethod<T, Relation>
  : Relation extends HasMany
  ? HasManyMethod<T, Relation>
  : Relation extends HasAndBelongsToMany
  ? HasAndBelongsToManyMethod<T, Relation>
  : never;

export type MapRelations<T extends Model> = 'relations' extends keyof T
  ? T['relations'] extends RelationThunks
    ? {
        [K in keyof T['relations']]: MapRelation<T, T['relations'][K]>;
      }
    : // eslint-disable-next-line @typescript-eslint/ban-types
      {}
  : // eslint-disable-next-line @typescript-eslint/ban-types
    {};

export const applyRelations = (
  qb: Query,
  models: Record<string, Model>,
  result: PORM<ModelClasses>,
) => {
  const modelsEntries = Object.entries(models);

  for (const modelName in models) {
    const model = models[modelName] as Model & {
      relations?: RelationThunks;
    };
    const dbModel = result[modelName];
    if ('relations' in model && typeof model.relations === 'object') {
      for (const relationName in model.relations) {
        const relation = model.relations[relationName];
        const otherModelClass = relation.fn();
        const otherModelPair = modelsEntries.find(
          (pair) => pair[1] instanceof otherModelClass,
        );
        if (!otherModelPair)
          throw new Error(
            `Cannot find model for class ${otherModelClass.name}`,
          );
        const otherModelName = otherModelPair[0];
        const otherDbModel = result[otherModelName];
        if (!otherDbModel)
          throw new Error(`Cannot find model by name ${otherModelName}`);

        const query = relation.options.scope
          ? relation.options.scope(otherDbModel)
          : otherDbModel;

        let method;
        const { type } = relation;
        if (type === 'belongsTo') {
          method = makeBelongsToMethod(relation, query);
        } else if (type === 'hasOne') {
          method = makeHasOneMethod(relation, query);
        } else if (type === 'hasMany') {
          method = makeHasManyMethod(relation, query);
        } else if (type === 'hasAndBelongsToMany') {
          method = makeHasAndBelongsToManyMethod(qb, relation, query);
        }

        if (method) {
          (dbModel as unknown as Record<string, unknown>)[relationName] =
            method;
        }
      }
    }
  }
};
