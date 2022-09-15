import {
  addQueryOn,
  HasOneNestedInsert,
  HasOneNestedUpdate,
  HasOneRelation,
  NestedInsertOneItem,
  Query,
  QueryBase,
  Relation,
} from 'pqb';
import { Model } from '../model';
import {
  RelationData,
  RelationInfo,
  RelationThunkBase,
  RelationThunks,
} from './relations';
import { WhereArg } from 'pqb/src/queryMethods/where';

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
  query: Query,
): RelationData => {
  if ('through' in relation.options) {
    const { through, source } = relation.options;

    type ModelWithQueryMethod = Record<
      string,
      (params: Record<string, unknown>) => Query
    >;

    const throughRelation = (model.relations as Record<string, Relation>)[
      through
    ];

    const sourceRelation = (
      throughRelation.model.relations as Record<string, Relation>
    )[source];

    const whereExistsCallback = () => sourceRelation.joinQuery;

    return {
      returns: 'one',
      method: (params: Record<string, unknown>) => {
        const throughQuery = (model as unknown as ModelWithQueryMethod)[
          through
        ](params);

        return (query.whereExists as (arg: Query, cb: () => Query) => Query)(
          throughQuery,
          whereExistsCallback,
        )._take();
      },
      nestedInsert: undefined,
      nestedUpdate: undefined,
      joinQuery: (query.whereExists as (arg: Query, cb: () => Query) => Query)(
        throughRelation.joinQuery,
        whereExistsCallback,
      ),
      primaryKey: sourceRelation.primaryKey,
    };
  }

  const { primaryKey, foreignKey } = relation.options;

  return {
    returns: 'one',
    method: (params: Record<string, unknown>) => {
      const values = { [foreignKey]: params[primaryKey] };
      return query.findBy(values)._defaults(values);
    },
    nestedInsert: (async (q, data) => {
      const connect = data.filter(
        (
          item,
        ): item is [
          Record<string, unknown>,
          NestedInsertOneItem & { connect: WhereArg<QueryBase> },
        ] => Boolean(item[1].connect),
      );

      const t = query.transacting(q);

      let connected: number[];
      if (connect.length) {
        connected = await Promise.all(
          connect.map(([selfData, item]) => {
            const data = { [foreignKey]: selfData[primaryKey] };
            return item.create
              ? (t.where(item.connect) as Query & { hasSelect: false })._update(
                  data,
                )
              : (
                  t.where(item.connect) as Query & { hasSelect: false }
                )._updateOrThrow(data);
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
          NestedInsertOneItem & { create: Record<string, unknown> },
        ] => {
          if (item[1].connect) {
            return !connected[connectedI++] && Boolean(item[1].create);
          }
          return Boolean(item[1].create);
        },
      );

      if (create.length) {
        await t.insert(
          create.map(([selfData, { create }]) => ({
            [foreignKey]: selfData[primaryKey],
            ...create,
          })),
        );
      }
    }) as HasOneNestedInsert,
    nestedUpdate: (async (q, data, params) => {
      const t = query.transacting(q);
      if ('disconnect' in params || 'set' in params) {
        await t
          .where({
            [foreignKey]: { in: data.map((item) => item[primaryKey]) },
          })
          ._update({ [foreignKey]: null });

        if ('set' in params) {
          await t
            .where<Query>(params.set)
            ._update({ [foreignKey]: data[0][primaryKey] });
        }
      }
    }) as HasOneNestedUpdate,
    joinQuery: addQueryOn(query, query, model, foreignKey, primaryKey),
    primaryKey,
  };
};
