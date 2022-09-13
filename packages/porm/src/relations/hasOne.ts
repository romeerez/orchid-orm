import {
  addQueryOn,
  HasOneNestedInsert,
  HasOneRelation,
  Query,
  Relation,
} from 'pqb';
import { Model } from '../model';
import {
  RelationData,
  RelationInfo,
  RelationThunkBase,
  RelationThunks,
} from './relations';

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
      const create = data.filter(([, item]) => item.create);
      const connect = data.filter(([, item]) => item.connect);

      const t = query.transacting(q);

      if (create.length) {
        await t.insert(
          create.map(([selfData, { create }]) => ({
            [foreignKey]: selfData[primaryKey],
            ...create,
          })),
        );
      }

      if (connect.length) {
        await Promise.all(
          connect.map(([selfData, { connect }]) =>
            t.update({ [foreignKey]: selfData[primaryKey] }).where(connect),
          ),
        );
      }
    }) as HasOneNestedInsert,
    joinQuery: addQueryOn(query, query, model, foreignKey, primaryKey),
    primaryKey,
  };
};
