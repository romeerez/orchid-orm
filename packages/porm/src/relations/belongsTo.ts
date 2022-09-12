import { Model } from '../model';
import {
  addQueryOn,
  BelongsToNestedInsert,
  BelongsToRelation,
  Query,
} from 'pqb';
import { RelationData, RelationThunkBase } from './relations';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  returns: 'one';
  options: BelongsToRelation['options'];
}

export type BelongsToInfo<T extends Model, Relation extends BelongsTo> = {
  params: Record<
    Relation['options']['foreignKey'],
    T['columns']['shape'][Relation['options']['foreignKey']]['type']
  >;
  populate: never;
};

export const makeBelongsToMethod = (
  model: Query,
  relation: BelongsTo,
  query: Query,
): RelationData => {
  const { primaryKey, foreignKey } = relation.options;

  return {
    returns: 'one',
    method: (params: Record<string, unknown>) => {
      return query.findBy({ [primaryKey]: params[foreignKey] });
    },
    nestedInsert: (async (q, data) => {
      const create = data.filter((item) => item.create);

      return await query.transacting(q).insert(
        create.map((item) => item.create),
        [primaryKey],
      );
    }) as BelongsToNestedInsert,
    joinQuery: addQueryOn(query, query, model, primaryKey, foreignKey),
    primaryKey,
  };
};
