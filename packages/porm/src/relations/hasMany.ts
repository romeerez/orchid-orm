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
      const create = data.filter(
        (
          item,
        ): item is [
          Record<string, unknown>,
          { create: Record<string, unknown>[] },
        ] => Boolean(item[1].create),
      );
      const connect = data.filter(
        (
          item,
        ): item is [
          Record<string, unknown>,
          { connect: WhereArg<QueryBase>[] },
        ] => Boolean(item[1].connect),
      );

      const t = query.transacting(q);

      if (create.length) {
        await t.insert(
          create.flatMap(([selfData, { create }]) =>
            create.map((item) => ({
              [foreignKey]: selfData[primaryKey],
              ...item,
            })),
          ) as InsertData<Query>[],
        );
      }

      if (connect.length) {
        await Promise.all(
          connect.flatMap(([selfData, { connect }]) =>
            connect.map((item) =>
              t.update({ [foreignKey]: selfData[primaryKey] }).where(item),
            ),
          ),
        );
      }
    }) as HasManyNestedInsert,
    joinQuery: addQueryOn(query, query, model, foreignKey, primaryKey),
    primaryKey,
  };
};
