import { BelongsTo, BelongsToInfo, makeBelongsToMethod } from './belongsTo';
import { HasOne, HasOneInfo, makeHasOneMethod } from './hasOne';
import { DbModel, Model, ModelClass, ModelClasses } from '../model';
import { OrchidORM } from '../orm';
import {
  Query,
  QueryWithTable,
  RelationQuery,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
  BaseRelation,
  defaultsKey,
  relationQueryKey,
  EmptyObject,
} from 'pqb';
import { HasMany, HasManyInfo, makeHasManyMethod } from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyInfo,
  makeHasAndBelongsToManyMethod,
} from './hasAndBelongsToMany';
import { getSourceRelation, getThroughRelation } from './utils';

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
  nestedInsert: BaseRelation['nestedInsert'];
  nestedUpdate: BaseRelation['nestedUpdate'];
  joinQuery(fromQuery: Query, toQuery: Query): Query;
  reverseJoin(fromQuery: Query, toQuery: Query): Query;
  primaryKey: string;
  modifyRelatedQuery?(relatedQuery: Query): (query: Query) => void;
};

export type Relation<
  T extends Model,
  Relations extends RelationThunks,
  K extends keyof Relations,
  M extends Query = DbModel<ReturnType<Relations[K]['fn']>>,
  Info extends RelationInfo = RelationInfo<T, Relations, Relations[K]>,
> = {
  type: Relations[K]['type'];
  returns: Relations[K]['returns'];
  key: K;
  model: M;
  query: M;
  joinQuery(fromQuery: Query, toQuery: Query): Query;
  defaults: Info['populate'];
  nestedCreateQuery: [Info['populate']] extends [never]
    ? M
    : M & {
        [defaultsKey]: Record<Info['populate'], true>;
      };
  nestedInsert: BaseRelation['nestedInsert'];
  nestedUpdate: BaseRelation['nestedUpdate'];
  primaryKey: string;
  options: Relations[K]['options'];
};

export type RelationScopeOrModel<Relation extends RelationThunkBase> =
  Relation['options']['scope'] extends (q: Query) => Query
    ? ReturnType<Relation['options']['scope']>
    : DbModel<ReturnType<Relation['fn']>>;

export type RelationInfo<
  T extends Model = Model,
  Relations extends RelationThunks = RelationThunks,
  Relation extends RelationThunk = RelationThunk,
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
  RelatedQuery extends Query = RelationScopeOrModel<Relation>,
  Info extends {
    params: Record<string, unknown>;
    populate: string;
    chainedCreate: boolean;
    chainedDelete: boolean;
  } = RelationInfo<T, Relations, Relation>,
> = RelationQuery<
  RelationName,
  Info['params'],
  Info['populate'],
  Relation['returns'] extends 'one'
    ? Relation['options']['required'] extends true
      ? SetQueryReturnsOne<RelatedQuery>
      : SetQueryReturnsOneOptional<RelatedQuery>
    : SetQueryReturnsAll<RelatedQuery>,
  Relation['options']['required'] extends boolean
    ? Relation['options']['required']
    : false,
  Info['chainedCreate'],
  Info['chainedDelete']
>;

export type MapRelations<T extends Model> = 'relations' extends keyof T
  ? T['relations'] extends RelationThunks
    ? {
        [K in keyof T['relations']]: MapRelation<T, T['relations'], K>;
      }
    : EmptyObject
  : EmptyObject;

type ApplyRelationData = {
  relationName: string;
  relation: RelationThunk;
  dbModel: DbModel<ModelClass>;
  otherDbModel: DbModel<ModelClass>;
};

type DelayedRelations = Map<Query, Record<string, ApplyRelationData[]>>;

export const applyRelations = (
  qb: Query,
  models: Record<string, Model>,
  result: OrchidORM<ModelClasses>,
) => {
  const modelsEntries = Object.entries(models);

  const delayedRelations: DelayedRelations = new Map();

  for (const modelName in models) {
    const model = models[modelName] as Model & {
      relations?: RelationThunks;
    };
    if (!('relations' in model) || typeof model.relations !== 'object')
      continue;

    const dbModel = result[modelName];
    for (const relationName in model.relations) {
      const relation = model.relations[relationName];
      const otherModelClass = relation.fn();
      const otherModel = modelsEntries.find(
        (pair) => pair[1] instanceof otherModelClass,
      );
      if (!otherModel) {
        throw new Error(`Cannot find model for class ${otherModelClass.name}`);
      }
      const otherModelName = otherModel[0];
      const otherDbModel = result[otherModelName];
      if (!otherDbModel)
        throw new Error(`Cannot find model by name ${otherModelName}`);

      const data: ApplyRelationData = {
        relationName,
        relation,
        dbModel,
        otherDbModel,
      };

      const options = relation.options as { through?: string; source?: string };
      if (
        typeof options.through === 'string' &&
        typeof options.source === 'string'
      ) {
        const throughRelation = getThroughRelation(dbModel, options.through);
        if (!throughRelation) {
          delayRelation(delayedRelations, dbModel, options.through, data);
          continue;
        }

        const sourceRelation = getSourceRelation(
          throughRelation,
          options.source,
        );
        if (!sourceRelation) {
          delayRelation(
            delayedRelations,
            throughRelation.model,
            options.source,
            data,
          );
          continue;
        }
      }

      applyRelation(qb, data, delayedRelations);
    }
  }
};

const delayRelation = (
  delayedRelations: DelayedRelations,
  model: Query,
  relationName: string,
  data: ApplyRelationData,
) => {
  let modelRelations = delayedRelations.get(model);
  if (!modelRelations) {
    modelRelations = {};
    delayedRelations.set(model, modelRelations);
  }
  if (modelRelations[relationName]) {
    modelRelations[relationName].push(data);
  } else {
    modelRelations[relationName] = [data];
  }
};

const applyRelation = (
  qb: Query,
  { relationName, relation, dbModel, otherDbModel }: ApplyRelationData,
  delayedRelations: DelayedRelations,
) => {
  const query = (
    relation.options.scope
      ? relation.options.scope(otherDbModel)
      : (otherDbModel as unknown as QueryWithTable)
  ).as(relationName);

  const definedAs = (query as unknown as { definedAs?: string }).definedAs;
  if (!definedAs) {
    throw new Error(
      `Model for table ${query.table} is not attached to db instance`,
    );
  }

  const { type } = relation;
  let data;
  if (type === 'belongsTo') {
    data = makeBelongsToMethod(relation, query);
  } else if (type === 'hasOne') {
    data = makeHasOneMethod(dbModel, relation, relationName, query);
  } else if (type === 'hasMany') {
    data = makeHasManyMethod(dbModel, relation, relationName, query);
  } else if (type === 'hasAndBelongsToMany') {
    data = makeHasAndBelongsToManyMethod(dbModel, qb, relation, query);
  } else {
    throw new Error(`Unknown relation type ${type}`);
  }

  if (data.returns === 'one') {
    query._take();
  }

  makeRelationQuery(dbModel, definedAs, relationName, data);

  (dbModel.relations as Record<string, unknown>)[relationName] = {
    type,
    key: relationName,
    model: otherDbModel,
    query,
    nestedInsert: data.nestedInsert,
    nestedUpdate: data.nestedUpdate,
    joinQuery: data.joinQuery,
    primaryKey: data.primaryKey,
    options: relation.options,
  };

  const modelRelations = delayedRelations.get(dbModel);
  if (!modelRelations) return;

  modelRelations[relationName]?.forEach((data) => {
    applyRelation(qb, data, delayedRelations);
  });
};

const makeRelationQuery = (
  model: Query,
  definedAs: string,
  relationName: string,
  data: RelationData,
) => {
  Object.defineProperty(model, relationName, {
    get() {
      const toModel = this.db[definedAs].as(relationName) as Query;

      if (data.returns === 'one') {
        toModel._take();
      }

      const query = this.isSubQuery
        ? toModel
        : toModel._whereExists(data.reverseJoin(this, toModel), (q) => q);

      query.query[relationQueryKey] = {
        relationName,
        sourceQuery: this,
        relationQuery: toModel,
        joinQuery: data.joinQuery,
      };

      const setQuery = data.modifyRelatedQuery?.(query);
      setQuery?.(this);

      return new Proxy(data.method, {
        get(_, prop) {
          return (query as unknown as Record<string, unknown>)[prop as string];
        },
      }) as unknown as RelationQuery;
    },
  });
};
