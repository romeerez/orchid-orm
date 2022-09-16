import { Model } from '../model';
import {
  addQueryOn,
  BelongsToNestedInsert,
  BelongsToNestedUpdate,
  BelongsToRelation,
  NestedInsertOneItem,
  Query,
  QueryBase,
} from 'pqb';
import { RelationData, RelationThunkBase } from './relations';
import { WhereArg } from 'pqb/src/queryMethods/where';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  returns: 'one';
  options: BelongsToRelation['options'];
}

export type BelongsToInfo<
  T extends Model,
  Relation extends BelongsTo,
  FK extends string = Relation['options']['foreignKey'],
> = {
  params: Record<FK, T['columns']['shape'][FK]['type']>;
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
      const connectOrCreate = data.filter(
        (
          item,
        ): item is NestedInsertOneItem & {
          connect: WhereArg<QueryBase>;
          create: Record<string, unknown>;
        } => Boolean(item.connect && item.create),
      );

      const t = query.transacting(q);

      let connectOrCreated: unknown[];
      if (connectOrCreate.length) {
        connectOrCreated = await Promise.all(
          connectOrCreate.map((item) => t.findBy(item.connect)._takeOptional()),
        );
      } else {
        connectOrCreated = [];
      }

      let connectOrCreatedI = 0;
      const create = data.filter(
        (
          item,
        ): item is NestedInsertOneItem & {
          create: Record<string, unknown>;
        } => {
          if (item.connect) {
            return (
              !connectOrCreated[connectOrCreatedI++] && Boolean(item.create)
            );
          } else {
            return Boolean(item.create);
          }
        },
      );

      let created: unknown[];
      if (create.length) {
        created = await t
          .select(primaryKey)
          ._insert(create.map((item) => item.create));
      } else {
        created = [];
      }

      const connect = data.filter(
        (
          item,
        ): item is {
          connect: WhereArg<QueryBase>;
        } => Boolean(!item.create && item.connect),
      );

      let connected: unknown[];
      if (connect.length) {
        connected = await Promise.all(
          connect.map((item) => t.findBy(item.connect)._take()),
        );
      } else {
        connected = [];
      }

      let createdI = 0;
      let connectedI = 0;
      connectOrCreatedI = 0;
      return data.map((item) =>
        item.connect && item.create
          ? connectOrCreated[connectOrCreatedI++] || created[createdI++]
          : item.connect
          ? connected[connectedI++]
          : created[createdI++],
      );
    }) as BelongsToNestedInsert,
    nestedUpdate: ((q, update, params) => {
      let id: unknown;

      q._beforeUpdate(async (q) => {
        if (params.disconnect) {
          update[foreignKey] = null;
        } else if (params.set) {
          if (primaryKey in params.set) {
            update[foreignKey] =
              params.set[primaryKey as keyof typeof params.set];
          } else {
            const result = await query
              .transacting(q)
              ._findBy(params.set)
              .select(primaryKey)
              ._take();

            update[foreignKey] = result[primaryKey];
          }
        } else if (params.delete) {
          const selectQuery = q.transacting(q);
          selectQuery.query.type = undefined;
          selectQuery.query.select = [foreignKey];
          id = await selectQuery._valueOptional();
          update[foreignKey] = null;
        }
      });

      if (params.delete) {
        q._afterUpdate(async (q) => {
          if (id) {
            await query
              .transacting(q)
              .findBy({
                [primaryKey]: id,
              })
              .delete();
          }
        });
      }
    }) as BelongsToNestedUpdate,
    joinQuery: addQueryOn(query, query, model, primaryKey, foreignKey),
    primaryKey,
  };
};
