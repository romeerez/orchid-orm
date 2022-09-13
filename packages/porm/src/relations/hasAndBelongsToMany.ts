import { RelationData, RelationThunkBase } from './relations';
import { Model } from '../model';
import {
  getQueryAs,
  HasAndBelongsToManyRelation,
  HasManyNestedInsert,
  InsertData,
  Query,
  QueryBase,
} from 'pqb';
import { WhereArg } from 'pqb/src/queryMethods/where';

export interface HasAndBelongsToMany extends RelationThunkBase {
  type: 'hasAndBelongsToMany';
  returns: 'many';
  options: HasAndBelongsToManyRelation['options'];
}

export type HasAndBelongsToManyInfo<
  T extends Model,
  Relation extends HasAndBelongsToMany,
> = {
  params: Record<
    Relation['options']['primaryKey'],
    T['columns']['shape'][Relation['options']['primaryKey']]['type']
  >;
  populate: never;
};

export const makeHasAndBelongsToManyMethod = (
  model: Query,
  qb: Query,
  relation: HasAndBelongsToMany,
  query: Query,
): RelationData => {
  const {
    primaryKey,
    foreignKey,
    associationPrimaryKey,
    associationForeignKey,
    joinTable,
  } = relation.options;

  const primaryKeyFull = `${getQueryAs(model)}.${primaryKey}`;
  const foreignKeyFull = `${joinTable}.${foreignKey}`;
  const associationForeignKeyFull = `${joinTable}.${associationForeignKey}`;
  const associationPrimaryKeyFull = `${getQueryAs(
    query,
  )}.${associationPrimaryKey}`;

  const subQuery = qb.clone();
  subQuery.table = joinTable;

  return {
    returns: 'many',
    method(params: Record<string, unknown>) {
      return query.whereExists(subQuery, (q) =>
        q.on(associationForeignKeyFull, associationPrimaryKeyFull).where({
          [foreignKeyFull]: params[primaryKey],
        }),
      );
    },
    nestedInsert: (async (q, data) => {
      const allKeys = data as unknown as [
        selfData: Record<string, unknown>,
        relationKeys: Record<string, unknown>[],
      ][];

      const create = data.filter(([, item]) => item.create);
      const connect = data.filter(([, item]) => item.connect) as [
        selfData: Record<string, unknown>,
        relationData: {
          connect: WhereArg<QueryBase>[];
        },
      ][];

      const t = query.transacting(q);

      let created: Record<string, unknown>[];
      if (create.length) {
        created = await t.insert(
          create.flatMap(([, { create }]) => create) as InsertData<Query>[],
          [associationPrimaryKey],
        );
      } else {
        created = [];
      }

      let connected: Record<string, unknown>[];
      if (connect.length) {
        connected = (await Promise.all(
          connect.flatMap(([, { connect }]) =>
            connect.map((item) =>
              t.select(associationPrimaryKey).findBy(item).takeOrThrow(),
            ),
          ),
        )) as Record<string, unknown[]>[];
      } else {
        connected = [];
      }

      let createI = 0;
      let connectI = 0;
      data.forEach(([, data], index) => {
        if (data.create) {
          const len = data.create.length;
          allKeys[index][1] = created.slice(createI, createI + len);
          createI += len;
        } else if (data.connect) {
          const len = data.connect.length;
          allKeys[index][1] = connected.slice(connectI, connectI + len);
          connectI += len;
        }
      });

      await subQuery.transacting(q).insert(
        allKeys.flatMap(([selfData, relationKeys]) => {
          const selfKey = selfData[primaryKey];
          return relationKeys.map((relationData) => ({
            [foreignKey]: selfKey,
            [associationForeignKey]: relationData[associationPrimaryKey],
          }));
        }),
      );
    }) as HasManyNestedInsert,
    joinQuery: query.whereExists(subQuery, (q) =>
      q
        .on(associationForeignKeyFull, associationPrimaryKeyFull)
        .on(foreignKeyFull, primaryKeyFull),
    ),
    primaryKey,
  };
};
