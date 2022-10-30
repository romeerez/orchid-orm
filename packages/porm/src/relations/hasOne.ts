import {
  addQueryOn,
  getQueryAs,
  HasOneNestedInsert,
  HasOneNestedUpdate,
  HasOneRelation,
  JoinCallback,
  Query,
  QueryBase,
  WhereArg,
  WhereResult,
} from 'pqb';
import { Model } from '../model';
import {
  RelationData,
  RelationInfo,
  RelationThunkBase,
  RelationThunks,
} from './relations';
import { getSourceRelation, getThroughRelation } from './utils';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  returns: 'one';
  options: HasOneRelation['options'];
}

export type HasOneInfo<
  T extends Model,
  Relations extends RelationThunks,
  Relation extends HasOne,
> = {
  params: Relation['options'] extends { primaryKey: string }
    ? Record<
        Relation['options']['primaryKey'],
        T['columns']['shape'][Relation['options']['primaryKey']]['type']
      >
    : Relation['options'] extends { through: string }
    ? RelationInfo<
        T,
        Relations,
        Relations[Relation['options']['through']]
      >['params']
    : never;
  populate: Relation['options'] extends { foreignKey: string }
    ? Relation['options']['foreignKey']
    : never;
};

export const makeHasOneMethod = (
  model: Query,
  relation: HasOne,
  relationName: string,
  query: Query,
): RelationData => {
  if (relation.options.required) {
    query._take();
  } else {
    query._takeOptional();
  }

  if ('through' in relation.options) {
    const { through, source } = relation.options;

    type ModelWithQueryMethod = Record<
      string,
      (params: Record<string, unknown>) => Query
    >;

    const throughRelation = getThroughRelation(model, through);
    const sourceRelation = getSourceRelation(throughRelation, source);
    const sourceQuery = sourceRelation
      .joinQuery(throughRelation.query, sourceRelation.query)
      .as(relationName);

    const whereExistsCallback = () => sourceQuery;

    return {
      returns: 'one',
      method: (params: Record<string, unknown>) => {
        const throughQuery = (model as unknown as ModelWithQueryMethod)[
          through
        ](params);

        return query.whereExists<Query, Query>(
          throughQuery,
          whereExistsCallback as unknown as JoinCallback<Query, Query>,
        );
      },
      nestedInsert: undefined,
      nestedUpdate: undefined,
      joinQuery(fromQuery, toQuery) {
        return toQuery
          .whereExists<Query, Query>(
            throughRelation.joinQuery(fromQuery, throughRelation.query),
            (() => {
              const as = getQueryAs(toQuery);
              return sourceRelation.joinQuery(
                throughRelation.query,
                sourceRelation.query.as(as),
              );
            }) as unknown as JoinCallback<Query, Query>,
          )
          .take();
      },
      primaryKey: sourceRelation.primaryKey,
    };
  }

  const { primaryKey, foreignKey } = relation.options;

  return {
    returns: 'one',
    method: (params: Record<string, unknown>) => {
      const values = { [foreignKey]: params[primaryKey] };
      return query.where(values)._defaults(values);
    },
    nestedInsert: (async (q, data) => {
      const connect = data.filter(
        (
          item,
        ): item is [
          Record<string, unknown>,
          (
            | {
                connect: WhereArg<QueryBase>;
              }
            | {
                connectOrCreate: {
                  where: WhereArg<QueryBase>;
                  create: Record<string, unknown>;
                };
              }
          ),
        ] => Boolean(item[1].connect || item[1].connectOrCreate),
      );

      const t = query.transacting(q);

      let connected: number[];
      if (connect.length) {
        connected = await Promise.all(
          connect.map(([selfData, item]) => {
            const data = { [foreignKey]: selfData[primaryKey] };
            return 'connect' in item
              ? (
                  t.where(item.connect) as WhereResult<Query> & {
                    hasSelect: false;
                  }
                )._updateOrThrow(data)
              : (
                  t.where(item.connectOrCreate.where) as WhereResult<Query> & {
                    hasSelect: false;
                  }
                )._update(data);
          }),
        );
      } else {
        connected = [];
      }

      let connectedI = 0;
      const create = data.filter(
        (
          item,
        ): item is [
          Record<string, unknown>,
          (
            | { create: Record<string, unknown> }
            | {
                connectOrCreate: {
                  where: WhereArg<QueryBase>;
                  create: Record<string, unknown>;
                };
              }
          ),
        ] => {
          if (item[1].connectOrCreate) {
            return !connected[connectedI++];
          }
          return Boolean(item[1].create);
        },
      );

      if (create.length) {
        await t.insertMany(
          create.map(([selfData, item]) => ({
            [foreignKey]: selfData[primaryKey],
            ...('create' in item ? item.create : item.connectOrCreate.create),
          })),
        );
      }
    }) as HasOneNestedInsert,
    nestedUpdate: (async (q, data, params) => {
      if ((params.set || params.create || params.upsert) && !q.query.take) {
        const key = params.set ? 'set' : params.create ? 'create' : 'upsert';
        throw new Error(`\`${key}\` option is not allowed in a batch update`);
      }

      const t = query.transacting(q);
      const ids = data.map((item) => item[primaryKey]);
      const currentRelationsQuery = t.where({
        [foreignKey]: { in: ids },
      });

      if (params.create || params.disconnect || params.set) {
        await currentRelationsQuery._update({ [foreignKey]: null });

        if (params.create) {
          await t._insert({
            ...params.create,
            [foreignKey]: data[0][primaryKey],
          });
        }
        if (params.set) {
          await t
            ._where<Query>(params.set)
            ._update({ [foreignKey]: data[0][primaryKey] });
        }
      } else if (params.update) {
        await currentRelationsQuery._update<WhereResult<Query>>(params.update);
      } else if (params.delete) {
        await currentRelationsQuery._delete();
      } else if (params.upsert) {
        const { update, create } = params.upsert;
        const updatedIds: unknown[] = await currentRelationsQuery
          ._pluck(foreignKey)
          ._update<WhereResult<Query>>(update);

        if (updatedIds.length < ids.length) {
          await t.insertMany(
            ids
              .filter((id) => !updatedIds.includes(id))
              .map((id) => ({
                ...create,
                [foreignKey]: id,
              })),
          );
        }
      }
    }) as HasOneNestedUpdate,
    joinQuery(fromQuery, toQuery) {
      return addQueryOn(
        toQuery.take(),
        fromQuery,
        toQuery,
        foreignKey,
        primaryKey,
      );
    },
    primaryKey,
  };
};
