import {
  addQueryOn,
  CreateCtx,
  CreateData,
  getQueryAs,
  InsertQueryData,
  isQueryReturnsAll,
  JoinCallback,
  Query,
  QueryWithTable,
  SetQueryTableAlias,
  UpdateCtx,
  UpdateData,
  VirtualColumn,
  WhereArg,
  WhereQueryBase,
  WhereResult,
} from 'pqb';
import { DbTable, Table, TableClass } from '../baseTable';
import {
  RelationCommonOptions,
  RelationData,
  RelationConfig,
  RelationThunkBase,
  RelationThunks,
  RelationToOneDataForCreate,
} from './relations';
import {
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  NestedInsertOneItem,
  NestedUpdateOneItem,
} from './utils';
import { EmptyObject } from 'orchid-core';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  returns: 'one';
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

export type HasOneInfo<
  T extends Table,
  Relations extends RelationThunks,
  Relation extends HasOne,
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
  one: true;
  required: Relation['options']['required'] extends true ? true : false;
  omitForeignKeyInCreate: never;
  dataForCreate: Relation['options'] extends { through: string }
    ? EmptyObject
    : RelationToOneDataForCreate<{
        nestedCreateQuery: NestedCreateQuery;
        table: Q;
      }>;
  // `hasOne` relation data available for update. It supports:
  // - `disconnect` to nullify a foreign key of the related record
  // - `delete` to delete the related record
  // - `update` to update the related record
  dataForUpdate:
    | { disconnect: boolean }
    | { delete: boolean }
    | { update: UpdateData<Q> };
  // Only for records that updates a single record:
  // - `set` to update the foreign key of related record found by condition
  // - `upsert` to update or create the related record
  // - `create` to create a related record
  dataForUpdateOne:
    | { set: WhereArg<Q> }
    | {
        upsert: {
          update: UpdateData<Q>;
          create:
            | CreateData<NestedCreateQuery>
            | (() => CreateData<NestedCreateQuery>);
        };
      }
    | {
        create: CreateData<NestedCreateQuery>;
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

export type HasOneNestedInsert = (
  query: Query,
  data: [
    selfData: Record<string, unknown>,
    relationData: NestedInsertOneItem,
  ][],
) => Promise<void>;

export type HasOneNestedUpdate = (
  query: Query,
  data: Record<string, unknown>[],
  relationData: NestedUpdateOneItem,
) => Promise<void>;

class HasOneVirtualColumn extends VirtualColumn {
  private readonly nestedInsert: HasOneNestedInsert;
  private readonly nestedUpdate: HasOneNestedUpdate;

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
    const params = set[this.key] as NestedUpdateOneItem;
    if (
      (params.set || params.create || params.upsert) &&
      isQueryReturnsAll(q)
    ) {
      const key = params.set ? 'set' : params.create ? 'create' : 'upsert';
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

export const makeHasOneMethod = (
  table: Query,
  relation: HasOne,
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
    const sourceQuery = sourceRelation
      .joinQuery(throughRelation.query, sourceRelation.query)
      .as(relationName);

    const whereExistsCallback = () => sourceQuery;

    return {
      returns: 'one',
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
    returns: 'one',
    method: (params: Record<string, unknown>) => {
      const values = { [foreignKey]: params[primaryKey] };
      return query.where(values)._defaults(values);
    },
    virtualColumn: new HasOneVirtualColumn(relationName, state),
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

const nestedInsert = ({ query, primaryKey, foreignKey }: State) => {
  return (async (_, data) => {
    const connect = data.filter(
      (
        item,
      ): item is [
        Record<string, unknown>,
        (
          | {
              connect: WhereArg<WhereQueryBase>;
            }
          | {
              connectOrCreate: {
                where: WhereArg<WhereQueryBase>;
                create: Record<string, unknown>;
              };
            }
        ),
      ] => Boolean(item[1].connect || item[1].connectOrCreate),
    );

    const t = query.clone();

    let connected: number[];
    if (connect.length) {
      connected = await Promise.all(
        connect.map(([selfData, item]) => {
          const data = { [foreignKey]: selfData[primaryKey] };
          return 'connect' in item
            ? (
                t.where(item.connect) as Omit<Query, 'meta'> & {
                  meta: Omit<Query['meta'], 'hasSelect' | 'hasWhere'> & {
                    hasWhere: true;
                  };
                }
              )._updateOrThrow(data as UpdateData<WhereResult<Query>>)
            : (
                t.where(item.connectOrCreate.where) as Omit<Query, 'meta'> & {
                  meta: Omit<Query['meta'], 'hasSelect' | 'hasWhere'> & {
                    hasWhere: true;
                  };
                }
              )._update(data as UpdateData<WhereResult<Query>>);
        }),
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
        (
          | { create: Record<string, unknown> }
          | {
              connectOrCreate: {
                where: WhereArg<WhereQueryBase>;
                create: Record<string, unknown>;
              };
            }
        ),
      ] => {
        if (item[1].connectOrCreate) {
          return !connected[connectedI++];
        }
        return Boolean(item[1].create);
      },
    );

    if (create.length) {
      await t._count()._createMany(
        create.map(([selfData, item]) => ({
          [foreignKey]: selfData[primaryKey],
          ...('create' in item ? item.create : item.connectOrCreate.create),
        })),
      );
    }
  }) as HasOneNestedInsert;
};

const nestedUpdate = ({ query, primaryKey, foreignKey }: State) => {
  return (async (_, data, params) => {
    const t = query.clone();
    const ids = data.map((item) => item[primaryKey]);
    const currentRelationsQuery = t.where({
      [foreignKey]: { in: ids },
    });

    if (params.create || params.disconnect || params.set) {
      await currentRelationsQuery._update({ [foreignKey]: null } as UpdateData<
        WhereResult<Query>
      >);

      if (params.create) {
        await t._count()._create({
          ...params.create,
          [foreignKey]: data[0][primaryKey],
        });
      }
      if (params.set) {
        await t
          ._where<Query>(params.set)
          ._update({ [foreignKey]: data[0][primaryKey] } as UpdateData<
            WhereResult<Query>
          >);
      }
    } else if (params.update) {
      await currentRelationsQuery._update<WhereResult<Query>>(params.update);
    } else if (params.delete) {
      await currentRelationsQuery._delete();
    } else if (params.upsert) {
      const { update, create } = params.upsert;
      const updatedIds: unknown[] = await currentRelationsQuery
        ._pluck(foreignKey)
        ._update<WhereResult<Query & { meta: { hasSelect: true } }>>(update);

      if (updatedIds.length < ids.length) {
        const data = typeof create === 'function' ? create() : create;

        await t.createMany(
          ids
            .filter((id) => !updatedIds.includes(id))
            .map((id) => ({
              ...data,
              [foreignKey]: id,
            })),
        );
      }
    }
  }) as HasOneNestedUpdate;
};
