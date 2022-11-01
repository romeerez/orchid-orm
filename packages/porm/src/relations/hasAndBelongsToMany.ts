import { RelationData, RelationThunkBase } from './relations';
import { Model } from '../model';
import {
  getQueryAs,
  HasAndBelongsToManyRelation,
  HasManyNestedInsert,
  HasManyNestedUpdate,
  MaybeArray,
  Query,
  QueryBase,
  toSqlCacheKey,
  WhereArg,
  WhereResult,
} from 'pqb';

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

type State = {
  relatedTableQuery: Query;
  joinTableQuery: Query;
  primaryKey: string;
  foreignKey: string;
  associationPrimaryKey: string;
  associationForeignKey: string;
};

export const makeHasAndBelongsToManyMethod = (
  model: Query,
  qb: Query,
  relation: HasAndBelongsToMany,
  query: Query,
): RelationData => {
  const {
    primaryKey: pk,
    foreignKey: fk,
    associationPrimaryKey: apk,
    associationForeignKey: afk,
    joinTable,
  } = relation.options;

  const foreignKeyFull = `${joinTable}.${fk}`;
  const associationForeignKeyFull = `${joinTable}.${afk}`;
  const associationPrimaryKeyFull = `${getQueryAs(query)}.${apk}`;

  const __model = Object.create(qb.__model);
  __model.__model = __model;
  __model.table = joinTable;
  __model.shape = {
    [fk]: model.shape[pk],
    [afk]: query.shape[apk],
  };
  const subQuery = Object.create(__model);
  subQuery.query = { ...subQuery.query };

  const state: State = {
    relatedTableQuery: query,
    joinTableQuery: subQuery,
    primaryKey: pk,
    foreignKey: fk,
    associationPrimaryKey: apk,
    associationForeignKey: afk,
  };

  return {
    returns: 'many',
    method(params: Record<string, unknown>) {
      return query.whereExists(subQuery, (q) =>
        q.on(associationForeignKeyFull, associationPrimaryKeyFull).where({
          [foreignKeyFull]: params[pk],
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
            connect.map((item) => t.select(apk)._findBy(item)._take()),
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
              t.select(apk)._findBy(item.where)._takeOptional(),
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
        created = (await t
          .select(apk)
          ._insertMany(
            create.flatMap(([, { create = [], connectOrCreate = [] }]) => [
              ...create,
              ...connectOrCreate
                .filter(() => !connectOrCreated[connectOrCreateI++])
                .map((item) => item.create),
            ]),
          )) as Record<string, unknown>[];
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

      await subQuery.transacting(q)._insertMany(
        allKeys.flatMap(([selfData, relationKeys]) => {
          const selfKey = selfData[pk];
          return relationKeys.map((relationData) => ({
            [fk]: selfKey,
            [afk]: relationData[apk],
          }));
        }),
      );
    }) as HasManyNestedInsert,
    nestedUpdate: (async (q, data, params) => {
      if (params.create) {
        const ids = await query
          .transacting(q)
          .pluck(apk)
          .insertMany(params.create);

        await subQuery.transacting(q).insertMany(
          data.flatMap((item) =>
            ids.map((id) => ({
              [fk]: item[pk],
              [afk]: id,
            })),
          ),
        );
      }

      if (params.update) {
        await (
          query
            .transacting(q)
            .whereExists(subQuery, (q) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (q as any)
                ._on(associationForeignKeyFull, associationPrimaryKeyFull)
                ._where({
                  IN: {
                    columns: [foreignKeyFull],
                    values: [data.map((item) => item[pk])],
                  },
                }),
            )
            .where(
              Array.isArray(params.update.where)
                ? { OR: params.update.where }
                : params.update.where,
            ) as WhereResult<Query>
        ).update<WhereResult<Query>>(params.update.data);
      }

      if (params.disconnect) {
        await queryJoinTable(state, q, data, params.disconnect)._delete();
      }

      if (params.delete) {
        const j = queryJoinTable(state, q, data, params.delete);

        const ids = await j._pluck(afk)._delete();

        await queryRelatedTable(query, q, { [apk]: { in: ids } })._delete();
      }

      if (params.set) {
        const j = queryJoinTable(state, q, data);
        await j._delete();
        delete j.query[toSqlCacheKey];

        const ids = await queryRelatedTable(query, q, params.set)._pluck(apk);

        await insertToJoinTable(state, j, data, ids);
      }
    }) as HasManyNestedUpdate,
    joinQuery(fromQuery, toQuery) {
      return toQuery.whereExists(subQuery, (q) =>
        q
          ._on(associationForeignKeyFull, `${getQueryAs(toQuery)}.${pk}`)
          ._on(foreignKeyFull, `${getQueryAs(fromQuery)}.${pk}`),
      );
    },
    primaryKey: pk,
  };
};

const queryJoinTable = (
  state: State,
  q: Query,
  data: Record<string, unknown>[],
  conditions?: MaybeArray<WhereArg<Query>>,
) => {
  const t = state.joinTableQuery.transacting(q);
  const where: WhereArg<Query> = {
    [state.foreignKey]: { in: data.map((item) => item[state.primaryKey]) },
  };

  if (conditions) {
    where[state.associationForeignKey] = {
      in: state.relatedTableQuery
        .where<Query>(
          Array.isArray(conditions) ? { OR: conditions } : conditions,
        )
        ._select(state.associationPrimaryKey),
    };
  }

  return t._where(where);
};

const queryRelatedTable = (
  query: Query,
  q: Query,
  conditions: MaybeArray<WhereArg<Query>>,
) => {
  return query
    .transacting(q)
    ._where<Query>(Array.isArray(conditions) ? { OR: conditions } : conditions);
};

const insertToJoinTable = (
  state: State,
  joinTableTransaction: Query,
  data: Record<string, unknown>[],
  ids: unknown[],
) => {
  return joinTableTransaction._insertMany(
    data.flatMap((item) =>
      ids.map((id) => ({
        [state.foreignKey]: item[state.primaryKey],
        [state.associationForeignKey]: id,
      })),
    ),
  );
};
