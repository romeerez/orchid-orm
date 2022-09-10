import { BelongsTo, BelongsToInfo, makeBelongsToMethod } from './belongsTo';
import { HasOne, HasOneInfo, makeHasOneMethod } from './hasOne';
import { DbModel, Model, ModelClass, ModelClasses } from '../model';
import { PORM } from '../orm';
import {
  BaseRelation,
  Query,
  QueryWithTable,
  RelationQuery,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsOneOrUndefined,
} from 'pqb';
import { HasMany, HasManyInfo, makeHasManyMethod } from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyInfo,
  makeHasAndBelongsToManyMethod,
} from './hasAndBelongsToMany';

export interface RelationThunkBase {
  type: string;
  returns: 'one' | 'many';
  fn(): ModelClass;
  options: BaseRelation['options'];
}

export type RelationThunk = BelongsTo | HasOne | HasMany | HasAndBelongsToMany;

export type RelationThunks = Record<string, RelationThunk>;

export type RelationData = {
  returns: 'one' | 'many';
  method(params: Record<string, unknown>): Query;
  joinQuery: Query;
  primaryKey: string;
};

export type RelationScopeOrModel<Relation extends RelationThunkBase> =
  Relation['options']['scope'] extends (q: Query) => Query
    ? ReturnType<Relation['options']['scope']>
    : DbModel<ReturnType<Relation['fn']>>;

export type RelationInfo<
  T extends Model,
  Relations extends RelationThunks,
  Relation extends RelationThunk,
> = Relation extends BelongsTo
  ? BelongsToInfo<T, Relation>
  : Relation extends HasOne
  ? HasOneInfo<T, Relations, Relation>
  : Relation extends HasMany
  ? HasManyInfo<T, Relations, Relation>
  : Relation extends HasAndBelongsToMany
  ? HasAndBelongsToManyInfo<T, Relation>
  : never;

export type MapRelation<
  T extends Model,
  Relations extends RelationThunks,
  RelationName extends keyof Relations,
  Relation extends RelationThunk = Relations[RelationName],
  Info extends {
    params: Record<string, unknown>;
    populate: string;
  } = RelationInfo<T, Relations, Relation>,
> = RelationQuery<
  RelationName,
  Info['params'],
  Info['populate'],
  Relation['returns'] extends 'one'
    ? Relation['options']['required'] extends true
      ? SetQueryReturnsOne<RelationScopeOrModel<Relation>>
      : SetQueryReturnsOneOrUndefined<RelationScopeOrModel<Relation>>
    : SetQueryReturnsAll<RelationScopeOrModel<Relation>>,
  Relation['options']['required'] extends boolean
    ? Relation['options']['required']
    : false
>;

export type MapRelations<T extends Model> = 'relations' extends keyof T
  ? T['relations'] extends RelationThunks
    ? {
        [K in keyof T['relations']]: MapRelation<T, T['relations'], K>;
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

        const query = (
          relation.options.scope
            ? relation.options.scope(otherDbModel)
            : (otherDbModel as unknown as QueryWithTable)
        ).as(relationName);

        const { type } = relation;
        let data;
        if (type === 'belongsTo') {
          data = makeBelongsToMethod(dbModel, relation, query);
        } else if (type === 'hasOne') {
          data = makeHasOneMethod(dbModel, relation, query);
        } else if (type === 'hasMany') {
          data = makeHasManyMethod(dbModel, relation, query);
        } else if (type === 'hasAndBelongsToMany') {
          data = makeHasAndBelongsToManyMethod(dbModel, qb, relation, query);
        }

        if (data) {
          (dbModel as unknown as Record<string, unknown>)[relationName] =
            makeRelationQuery(data);

          (dbModel.relations as Record<string, unknown>)[relationName] = {
            type,
            key: relationName,
            model: query,
            joinQuery: data.joinQuery,
            primaryKey: data.primaryKey,
            options: relation.options,
          };
        }
      }
    }
  }
};

const makeRelationQuery = (data: RelationData): RelationQuery => {
  const query = data.returns === 'one' ? data.joinQuery.take() : data.joinQuery;

  return new Proxy(data.method, {
    get(_, prop) {
      return (query as unknown as Record<string, unknown>)[prop as string];
    },
  }) as unknown as RelationQuery;
};
