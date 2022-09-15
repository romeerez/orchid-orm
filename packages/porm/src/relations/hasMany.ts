import {
  RelationData,
  RelationInfo,
  RelationThunkBase,
  RelationThunks,
} from './relations';
import { Model } from '../model';
import {
  addQueryOn,
  HasManyNestedInsert,
  HasManyNestedUpdate,
  HasManyRelation,
  InsertData,
  Query,
  QueryBase,
  Relation,
} from 'pqb';
import { WhereArg } from 'pqb/src/queryMethods/where';

export interface HasMany extends RelationThunkBase {
  type: 'hasMany';
  returns: 'many';
  options: HasManyRelation['options'];
}

export type HasManyInfo<
  T extends Model,
  Relations extends RelationThunks,
  Relation extends HasMany,
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

export const makeHasManyMethod = (
  model: Query,
  relation: HasMany,
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
      returns: 'many',
      method: (params: Record<string, unknown>) => {
        const throughQuery = (model as unknown as ModelWithQueryMethod)[
          through
        ](params);

        return (query.whereExists as (arg: Query, cb: () => Query) => Query)(
          throughQuery,
          whereExistsCallback,
        );
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
    returns: 'many',
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
          { connect: WhereArg<QueryBase>[] },
        ] => Boolean(item[1].connect),
      );

      const t = query.transacting(q);

      if (connect.length) {
        await Promise.all(
          connect.flatMap(([selfData, { connect }]) =>
            connect.map((item) =>
              t
                .where<Query>(item)
                .updateOrThrow({ [foreignKey]: selfData[primaryKey] }),
            ),
          ),
        );
      }

      const connectOrCreate = data.filter(
        (
          item,
        ): item is [
          Record<string, unknown>,
          {
            connectOrCreate: {
              where: WhereArg<QueryBase>;
              create: Record<string, unknown>;
            }[];
          },
        ] => Boolean(item[1].connectOrCreate),
      );

      let connected: number[];
      if (connectOrCreate.length) {
        connected = await Promise.all(
          connectOrCreate.flatMap(([selfData, { connectOrCreate }]) =>
            connectOrCreate.map((item) =>
              t
                .where<Query>(item.where)
                .update({ [foreignKey]: selfData[primaryKey] }),
            ),
          ),
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
          {
            create?: Record<string, unknown>[];
            connectOrCreate?: {
              where: WhereArg<QueryBase>;
              create: Record<string, unknown>;
            }[];
          },
        ] => {
          if (item[1].connectOrCreate) {
            const length = item[1].connectOrCreate.length;
            connectedI += length;
            for (let i = length; i > 0; i--) {
              if (connected[connectedI - i] === 0) return true;
            }
          }
          return Boolean(item[1].create);
        },
      );

      connectedI = 0;
      if (create.length) {
        await t.insert(
          create.flatMap(
            ([selfData, { create = [], connectOrCreate = [] }]) => {
              return [
                ...create.map((item) => ({
                  [foreignKey]: selfData[primaryKey],
                  ...item,
                })),
                ...connectOrCreate
                  .filter(() => connected[connectedI++] === 0)
                  .map((item) => ({
                    [foreignKey]: selfData[primaryKey],
                    ...item.create,
                  })),
              ];
            },
          ) as InsertData<Query>[],
        );
      }
    }) as HasManyNestedInsert,
    nestedUpdate: (async (q, data, params) => {
      const t = query.transacting(q);
      if (params.disconnect) {
        await t
          .where<Query>({
            [foreignKey]: { in: data.map((item) => item[primaryKey]) },
            OR: params.disconnect,
          })
          .updateOrThrow({ [foreignKey]: null });
      }
    }) as HasManyNestedUpdate,
    joinQuery: addQueryOn(query, query, model, foreignKey, primaryKey),
    primaryKey,
  };
};
