import {
  RelationData,
  RelationInfo,
  RelationThunkBase,
  RelationThunks,
} from './relations';
import { Model } from '../model';
import {
  addQueryOn,
  getQueryAs,
  HasManyRelation,
  CreateData,
  JoinCallback,
  MaybeArray,
  Query,
  QueryBase,
  toSqlCacheKey,
  WhereArg,
  WhereResult,
  InsertQueryData,
  isQueryReturnsAll,
  VirtualColumn,
  CreateCtx,
  UpdateCtx,
} from 'pqb';
import {
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  NestedInsertManyItems,
  NestedUpdateManyItems,
} from './utils';

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
  chainedCreate: Relation['options'] extends { primaryKey: string }
    ? true
    : false;
  chainedDelete: true;
};

type State = {
  query: Query;
  primaryKey: string;
  foreignKey: string;
};

export type HasManyNestedUpdate = (
  query: Query,
  data: Record<string, unknown>[],
  relationData: NestedUpdateManyItems,
) => Promise<void>;

export type HasManyNestedInsert = (
  query: Query,
  data: [
    selfData: Record<string, unknown>,
    relationData: NestedInsertManyItems,
  ][],
) => Promise<void>;

class HasManyVirtualColumn extends VirtualColumn {
  private readonly nestedInsert: HasManyNestedInsert;
  private readonly nestedUpdate: HasManyNestedUpdate;

  constructor(private key: string, private state: State) {
    super();
    this.nestedInsert = nestedInsert(state);
    this.nestedUpdate = nestedUpdate(state);
  }

  create(
    q: Query,
    ctx: CreateCtx,
    item: Record<string, unknown>,
    rowIndex: number,
  ) {
    hasRelationHandleCreate(
      q,
      ctx,
      item,
      rowIndex,
      this.key,
      this.state.primaryKey,
      this.nestedInsert,
    );
  }

  update(q: Query, ctx: UpdateCtx, set: Record<string, unknown>) {
    hasRelationHandleUpdate(
      q,
      ctx,
      set,
      this.key,
      this.state.primaryKey,
      this.nestedUpdate,
    );
  }
}

export const makeHasManyMethod = (
  model: Query,
  relation: HasMany,
  relationName: string,
  query: Query,
): RelationData => {
  if ('through' in relation.options) {
    const { through, source } = relation.options;

    type ModelWithQueryMethod = Record<
      string,
      (params: Record<string, unknown>) => Query
    >;

    const throughRelation = getThroughRelation(model, through);
    const sourceRelation = getSourceRelation(throughRelation, source);
    const sourceRelationQuery = sourceRelation.query.as(relationName);
    const sourceQuery = sourceRelation.joinQuery(
      throughRelation.query,
      sourceRelationQuery,
    );

    const whereExistsCallback = () => sourceQuery;

    return {
      returns: 'many',
      method: (params: Record<string, unknown>) => {
        const throughQuery = (model as unknown as ModelWithQueryMethod)[
          through
        ](params);

        return query.whereExists<Query, Query>(
          throughQuery,
          whereExistsCallback as unknown as JoinCallback<Query, Query>,
        );
      },
      joinQuery(fromQuery, toQuery) {
        return toQuery.whereExists<Query, Query>(
          throughRelation.joinQuery(fromQuery, throughRelation.query),
          (() => {
            const as = getQueryAs(toQuery);
            return sourceRelation.joinQuery(
              throughRelation.query,
              sourceRelation.query.as(as),
            );
          }) as unknown as JoinCallback<Query, Query>,
        );
      },
      reverseJoin(fromQuery, toQuery) {
        return fromQuery.whereExists<Query, Query>(
          throughRelation.joinQuery(fromQuery, throughRelation.query),
          (() => {
            const as = getQueryAs(toQuery);
            return sourceRelation.joinQuery(
              throughRelation.query,
              sourceRelation.query.as(as),
            );
          }) as unknown as JoinCallback<Query, Query>,
        );
      },
      primaryKey: sourceRelation.primaryKey,
    };
  }

  const { primaryKey, foreignKey } = relation.options;
  const state: State = { query, primaryKey, foreignKey };

  const fromQuerySelect = [{ selectAs: { [foreignKey]: primaryKey } }];

  return {
    returns: 'many',
    method: (params: Record<string, unknown>) => {
      const values = { [foreignKey]: params[primaryKey] };
      return query.where(values)._defaults(values);
    },
    virtualColumn: new HasManyVirtualColumn(relationName, state),
    joinQuery(fromQuery, toQuery) {
      return addQueryOn(toQuery, fromQuery, toQuery, foreignKey, primaryKey);
    },
    reverseJoin(fromQuery, toQuery) {
      return addQueryOn(fromQuery, toQuery, fromQuery, primaryKey, foreignKey);
    },
    primaryKey,
    modifyRelatedQuery(relationQuery) {
      return (query) => {
        const fromQuery = query.clone();
        fromQuery.query.select = fromQuerySelect;
        (relationQuery.query as InsertQueryData).fromQuery = fromQuery;
      };
    },
  };
};

const getWhereForNestedUpdate = (
  data: Record<string, unknown>[],
  params: MaybeArray<WhereArg<QueryBase>> | undefined,
  primaryKey: string,
  foreignKey: string,
) => {
  const where: WhereArg<Query> = {
    [foreignKey]: { in: data.map((item) => item[primaryKey]) },
  };
  if (params) {
    if (Array.isArray(params)) {
      where.OR = params;
    } else {
      Object.assign(where, params);
    }
  }
  return where;
};

const nestedInsert = ({ query, primaryKey, foreignKey }: State) => {
  return (async (q, data) => {
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
          t
            .or<Query>(...connect)
            ._updateOrThrow({ [foreignKey]: selfData[primaryKey] }),
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
            (
              t.where(item.where) as WhereResult<Query & { hasSelect: false }>
            )._update({
              [foreignKey]: selfData[primaryKey],
            }),
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
      await t._createMany(
        create.flatMap(([selfData, { create = [], connectOrCreate = [] }]) => {
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
        }) as CreateData<Query>[],
      );
    }
  }) as HasManyNestedInsert;
};

const nestedUpdate = ({ query, primaryKey, foreignKey }: State) => {
  return (async (q, data, params) => {
    if ((params.set || params.create) && isQueryReturnsAll(q)) {
      const key = params.set ? 'set' : 'create';
      throw new Error(`\`${key}\` option is not allowed in a batch update`);
    }

    const t = query.transacting(q);
    if (params.create) {
      await t._count()._createMany(
        params.create.map((create) => ({
          ...create,
          [foreignKey]: data[0][primaryKey],
        })),
      );
      delete t.query[toSqlCacheKey];
    }

    if (params.disconnect || params.set) {
      await t
        .where<Query>(
          getWhereForNestedUpdate(
            data,
            params.disconnect,
            primaryKey,
            foreignKey,
          ),
        )
        ._update({ [foreignKey]: null });

      if (params.set) {
        delete t.query[toSqlCacheKey];
        await t
          .where<Query>(
            Array.isArray(params.set)
              ? {
                  OR: params.set,
                }
              : params.set,
          )
          ._update({ [foreignKey]: data[0][primaryKey] });
      }
    }

    if (params.delete || params.update) {
      delete t.query[toSqlCacheKey];
      const q = t._where(
        getWhereForNestedUpdate(
          data,
          params.delete || params.update?.where,
          primaryKey,
          foreignKey,
        ),
      );

      if (params.delete) {
        await q._delete();
      } else if (params.update) {
        await q._update<WhereResult<Query>>(params.update.data);
      }
    }
  }) as HasManyNestedUpdate;
};
