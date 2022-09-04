import { BelongsTo, BelongsToParams, makeBelongsToMethod } from './belongsTo';
import { HasOne, HasOneParams, makeHasOneMethod } from './hasOne';
import { DbModel, Model, ModelClass, ModelClasses } from '../model';
import { PORM } from '../orm';
import {
  Query,
  QueryWithTable,
  Relation,
  SetQueryReturnsAll,
  SetQueryReturnsOneOrUndefined,
} from 'pqb';
import { HasMany, HasManyParams, makeHasManyMethod } from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyParams,
  makeHasAndBelongsToManyMethod,
} from './hasAndBelongsToMany';

export interface RelationThunkBase {
  type: string;
  returns: 'one' | 'many';
  fn(): ModelClass;
  options: {
    scope?(q: QueryWithTable): QueryWithTable;
  };
}

export type RelationThunk = BelongsTo | HasOne | HasMany | HasAndBelongsToMany;

export type RelationThunks = Record<string, RelationThunk>;

export type RelationData = {
  method(params: Record<string, unknown>): Query;
  joinQuery: Query;
};

export type RelationScopeOrModel<Relation extends RelationThunkBase> =
  Relation['options']['scope'] extends (q: Query) => Query
    ? ReturnType<Relation['options']['scope']>
    : DbModel<ReturnType<Relation['fn']>>;

export type RelationParams<
  T extends Model,
  Relations extends RelationThunks,
  Relation extends RelationThunk,
> = Relation extends BelongsTo
  ? BelongsToParams<T, Relation>
  : Relation extends HasOne
  ? HasOneParams<T, Relations, Relation>
  : Relation extends HasMany
  ? HasManyParams<T, Relation>
  : Relation extends HasAndBelongsToMany
  ? HasAndBelongsToManyParams<T, Relation>
  : never;

export type MapRelation<
  T extends Model,
  Relations extends RelationThunks,
  Relation extends RelationThunk,
> = (
  params: RelationParams<T, Relations, Relation>,
) => Relation['returns'] extends 'one'
  ? SetQueryReturnsOneOrUndefined<RelationScopeOrModel<Relation>>
  : SetQueryReturnsAll<RelationScopeOrModel<Relation>>;

export type MapRelations<T extends Model> = 'relations' extends keyof T
  ? T['relations'] extends RelationThunks
    ? {
        [K in keyof T['relations']]: MapRelation<
          T,
          T['relations'],
          T['relations'][K]
        >;
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
    const dbModel = result[modelName] as unknown as Record<string, unknown>;
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
          : (otherDbModel as unknown as QueryWithTable);

        const { type } = relation;
        let data;
        if (type === 'belongsTo') {
          data = makeBelongsToMethod(relation, query);
        } else if (type === 'hasOne') {
          data = makeHasOneMethod(dbModel as unknown as Query, relation, query);
        } else if (type === 'hasMany') {
          data = makeHasManyMethod(relation, query);
        } else if (type === 'hasAndBelongsToMany') {
          data = makeHasAndBelongsToManyMethod(qb, relation, query);
        }

        if (data) {
          dbModel[relationName] = data.method;

          (dbModel.relations as Record<string, Relation>)[relationName] = {
            key: relationName,
            model: query,
            joinQuery: data.joinQuery,
          };
        }
      }
    }
  }
};
