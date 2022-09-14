import { RelationData, RelationThunkBase } from './relations';
import { Model } from '../model';
import {
  getQueryAs,
  HasAndBelongsToManyRelation,
  HasManyNestedInsert,
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
      const connect = data.filter(
        (
          item,
        ): item is [
          selfData: Record<string, unknown>,
          relationData: {
            connect: WhereArg<QueryBase>[];
          },
        ] => Boolean(item[1].connect),
      );

      const t = query.transacting(q);

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

      let connectOrCreated: (Record<string, unknown> | undefined)[];
      if (connectOrCreate.length) {
        connectOrCreated = await Promise.all(
          connectOrCreate.flatMap(([, { connectOrCreate }]) =>
            connectOrCreate.map((item) =>
              t.select(associationPrimaryKey).findBy(item.where).take(),
            ),
          ),
        );
      } else {
        connectOrCreated = [];
      }

      let connectOrCreateI = 0;
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
            connectOrCreateI += length;
            for (let i = length; i > 0; i--) {
              if (!connectOrCreated[connectOrCreateI - i]) return true;
            }
          }
          return Boolean(item[1].create);
        },
      );

      connectOrCreateI = 0;
      let created: Record<string, unknown>[];
      if (create.length) {
        created = await t.insert(
          create.flatMap(([, { create = [], connectOrCreate = [] }]) => [
            ...create,
            ...connectOrCreate
              .filter(() => !connectOrCreated[connectOrCreateI++])
              .map((item) => item.create),
          ]),
          [associationPrimaryKey],
        );
      } else {
        created = [];
      }

      const allKeys = data as unknown as [
        selfData: Record<string, unknown>,
        relationKeys: Record<string, unknown>[],
      ][];

      let createI = 0;
      let connectI = 0;
      connectOrCreateI = 0;
      data.forEach(([, data], index) => {
        if (data.create || data.connectOrCreate) {
          if (data.create) {
            const len = data.create.length;
            allKeys[index][1] = created.slice(createI, createI + len);
            createI += len;
          }
          if (data.connectOrCreate) {
            const arr: Record<string, unknown>[] = [];
            allKeys[index][1] = arr;

            const len = data.connectOrCreate.length;
            for (let i = 0; i < len; i++) {
              const item = connectOrCreated[connectOrCreateI++];
              if (item) {
                arr.push(item);
              } else {
                arr.push(created[createI++]);
              }
            }
          }
        }

        if (data.connect) {
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
