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
      const connect = data.filter((item) => item.connect);

      const t = query.transacting(q);

      let created: unknown[];
      if (create.length) {
        created = await t.insert(
          create.map((item) => item.create),
          [primaryKey],
        );
      } else {
        created = [];
      }

      let connected: unknown[];
      if (connect.length) {
        connected = await Promise.all(
          connect.map((item) => t.findBy(item.connect).takeOrThrow()),
        );
      } else {
        connected = [];
      }

      let createdI = 0;
      let connectedI = 0;
      return data.map((item) =>
        item.create ? created[createdI++] : connected[connectedI++],
      );
    }) as BelongsToNestedInsert,
    joinQuery: addQueryOn(query, query, model, primaryKey, foreignKey),
    primaryKey,
  };
};
