import {
  RelationCommonOptions,
  RelationData,
  RelationConfig,
  RelationThunkBase,
  RelationThunks,
  RelationToManyDataForCreate,
} from './relations';
import { DbTable, Table, TableClass } from '../baseTable';
import {
  addQueryOn,
  getQueryAs,
  CreateData,
  JoinCallback,
  Query,
  toSQLCacheKey,
  WhereArg,
  WhereResult,
  InsertQueryData,
  isQueryReturnsAll,
  VirtualColumn,
  CreateCtx,
  UpdateCtx,
  WhereQueryBase,
  SetQueryTableAlias,
  UpdateData,
  QueryWithTable,
} from 'pqb';
import { EmptyObject, MaybeArray } from 'orchid-core';
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
  options:
    | RelationCommonOptions &
        (
          | {
              primaryKey: string;
              foreignKey: string;
            }
          | {
              through: string;
              source: string;
            }
        );
}

export type HasManyInfo<
  T extends Table,
  Relations extends RelationThunks,
  Relation extends HasMany,
  K extends string,
  Populate extends string = Relation['options'] extends { foreignKey: string }
    ? Relation['options']['foreignKey']
    : never,
  TC extends TableClass = ReturnType<Relation['fn']>,
  Q extends QueryWithTable = SetQueryTableAlias<DbTable<TC>, K>,
  NestedCreateQuery extends Query = [Populate] extends [never]
    ? Q
    : Q & {
        meta: { defaults: Record<Populate, true> };
      },
> = {
  table: Q;
  query: Q;
  joinQuery(fromQuery: Query, toQuery: Query): Query;
  one: false;
  required: Relation['options']['required'] extends true ? true : false;
  omitForeignKeyInCreate: never;
  dataForCreate: Relation['options'] extends { through: string }
    ? EmptyObject
    : RelationToManyDataForCreate<{
        nestedCreateQuery: NestedCreateQuery;
        table: Q;
      }>;
  // `hasMany` relation data available for update. It supports:
  // - `disconnect` to nullify foreign keys of the related records
  // - `delete` to delete related record found by conditions
  // - `update` to update related records found by conditions with a provided data
  dataForUpdate: {
    disconnect?: MaybeArray<WhereArg<Q>>;
    delete?: MaybeArray<WhereArg<Q>>;
    update?: {
      where: MaybeArray<WhereArg<Q>>;
      data: UpdateData<Q>;
    };
  };
  // Only for records that updates a single record:
  // - `set` to update foreign keys of related records found by conditions
  // - `create` to create related records
  dataForUpdateOne: {
    set?: MaybeArray<WhereArg<Q>>;
    create?: CreateData<NestedCreateQuery>[];
  };

  params: Relation['options'] extends { primaryKey: string }
    ? Record<
        Relation['options']['primaryKey'],
        T['columns']['shape'][Relation['options']['primaryKey']]['type']
      >
    : Relation['options'] extends { through: string }
    ? RelationConfig<
        T,
        Relations,
        Relations[Relation['options']['through']]
      >['params']
    : never;
  populate: Populate;
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

  update(q: Query, _: UpdateCtx, set: Record<string, unknown>) {
    const params = set[this.key] as NestedUpdateManyItems;
    if ((params.set || params.create) && isQueryReturnsAll(q)) {
      const key = params.set ? 'set' : 'create';
      throw new Error(`\`${key}\` option is not allowed in a batch update`);
    }

    hasRelationHandleUpdate(
      q,
      set,
      this.key,
      this.state.primaryKey,
      this.nestedUpdate,
    );
  }
}

export const makeHasManyMethod = (
  table: Query,
  relation: HasMany,
  relationName: string,
  query: Query,
): RelationData => {
  if ('through' in relation.options) {
    const { through, source } = relation.options;

    type TableWithQueryMethod = Record<
      string,
      (params: Record<string, unknown>) => Query
    >;

    const throughRelation = getThroughRelation(table, through);
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
        const throughQuery = (table as unknown as TableWithQueryMethod)[
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
    modifyRelatedQuery(relationQuery) {
      return (query) => {
        const fromQuery = query.clone();
        fromQuery.q.select = fromQuerySelect;
        const q = relationQuery.q as InsertQueryData;
        q.kind = 'from';
        q.values = { from: fromQuery };
      };
    },
  };
};

const getWhereForNestedUpdate = (
  data: Record<string, unknown>[],
  params: MaybeArray<WhereArg<WhereQueryBase>> | undefined,
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
  return (async (_, data) => {
    const connect = data.filter(
      (
        item,
      ): item is [
        Record<string, unknown>,
        { connect: WhereArg<WhereQueryBase>[] },
      ] => Boolean(item[1].connect),
    );

    const t = query.clone();

    if (connect.length) {
      await Promise.all(
        connect.flatMap(([selfData, { connect }]) =>
          t.or<Query>(...connect)._updateOrThrow({
            [foreignKey]: selfData[primaryKey],
          } as UpdateData<WhereResult<Query>>),
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
            where: WhereArg<WhereQueryBase>;
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
            } as UpdateData<WhereResult<Query>>),
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
            where: WhereArg<WhereQueryBase>;
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
  return (async (_, data, params) => {
    const t = query.clone();
    if (params.create) {
      await t._count()._createMany(
        params.create.map((create) => ({
          ...create,
          [foreignKey]: data[0][primaryKey],
        })),
      );
      delete t.q[toSQLCacheKey];
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
        ._update({ [foreignKey]: null } as UpdateData<WhereResult<Query>>);

      if (params.set) {
        delete t.q[toSQLCacheKey];
        await t
          .where<Query>(
            Array.isArray(params.set)
              ? {
                  OR: params.set,
                }
              : params.set,
          )
          ._update({ [foreignKey]: data[0][primaryKey] } as UpdateData<
            WhereResult<Query>
          >);
      }
    }

    if (params.delete || params.update) {
      delete t.q[toSQLCacheKey];
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
