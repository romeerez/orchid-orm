import {
  addQueryOn,
  CreateCtx,
  getQueryAs,
  HasOneRelation,
  InsertQueryData,
  isQueryReturnsAll,
  JoinCallback,
  Query,
  QueryBase,
  UpdateCtx,
  VirtualColumn,
  WhereArg,
  WhereResult,
} from 'pqb';
import { Table } from '../table';
import {
  RelationData,
  RelationInfo,
  RelationThunkBase,
  RelationThunks,
} from './relations';
import {
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  NestedInsertOneItem,
  NestedUpdateOneItem,
} from './utils';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  returns: 'one';
  options: HasOneRelation['options'];
}

export type HasOneInfo<
  T extends Table,
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
      primaryKey: sourceRelation.primaryKey,
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
    primaryKey,
    modifyRelatedQuery(relationQuery) {
      return (query) => {
        const fromQuery = query.clone();
        fromQuery.query.select = fromQuerySelect;
        (relationQuery.query as InsertQueryData).values = { from: fromQuery };
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
              connect: WhereArg<QueryBase>;
            }
          | {
              connectOrCreate: {
                where: WhereArg<QueryBase>;
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
              )._updateOrThrow(data)
            : (
                t.where(item.connectOrCreate.where) as Omit<Query, 'meta'> & {
                  meta: Omit<Query['meta'], 'hasSelect' | 'hasWhere'> & {
                    hasWhere: true;
                  };
                }
              )._update(data);
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
                where: WhereArg<QueryBase>;
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
  return (async (q, data, params) => {
    if (
      (params.set || params.create || params.upsert) &&
      isQueryReturnsAll(q)
    ) {
      const key = params.set ? 'set' : params.create ? 'create' : 'upsert';
      throw new Error(`\`${key}\` option is not allowed in a batch update`);
    }

    const t = query.clone();
    const ids = data.map((item) => item[primaryKey]);
    const currentRelationsQuery = t.where({
      [foreignKey]: { in: ids },
    });

    if (params.create || params.disconnect || params.set) {
      await currentRelationsQuery._update({ [foreignKey]: null });

      if (params.create) {
        await t._count()._create({
          ...params.create,
          [foreignKey]: data[0][primaryKey],
        });
      }
      if (params.set) {
        await t
          ._where<Query>(params.set)
          ._update({ [foreignKey]: data[0][primaryKey] });
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
