import {
  RelationData,
  RelationConfig,
  RelationThunkBase,
  RelationThunks,
  RelationToManyDataForCreate,
} from './relations';
import { DbTable, Table, TableClass } from '../baseTable';
import {
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
import { EmptyObject, MaybeArray, toArray } from 'orchid-core';
import {
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  joinHasRelation,
  joinHasThrough,
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
  NestedUpdateManyItems,
} from './common/utils';
import { HasOneOptions } from './hasOne';
import {
  RelationKeysOptions,
  RelationRefsOptions,
  RelationThroughOptions,
} from './common/options';

export type HasMany = RelationThunkBase & {
  type: 'hasMany';
  options: HasManyOptions;
};

export type HasManyOptions<
  Self extends Table = Table,
  Related extends TableClass = TableClass,
  Scope extends Query = Query,
  Through extends string = string,
  Source extends string = string,
> = HasOneOptions<Self, Related, Scope, Through, Source>;

export type HasManyInfo<
  T extends Table,
  Relations extends RelationThunks,
  Relation extends HasMany,
  K extends string,
  Populate extends string = Relation['options'] extends RelationRefsOptions
    ? Relation['options']['references'][number]
    : Relation['options'] extends RelationKeysOptions
    ? Relation['options']['foreignKey']
    : never,
  TC extends TableClass = ReturnType<Relation['fn']>,
  Q extends QueryWithTable = SetQueryTableAlias<DbTable<TC>, K>,
  NestedCreateQuery extends Query = Relation['options'] extends RelationThroughOptions
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
  requiredDataForCreate: EmptyObject;
  optionalDataForCreate: {
    [P in K]?: Relation['options'] extends RelationThroughOptions
      ? EmptyObject
      : RelationToManyDataForCreate<{
          nestedCreateQuery: NestedCreateQuery;
          table: Q;
        }>;
  };
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

  params: Relation['options'] extends RelationRefsOptions
    ? {
        [K in Relation['options']['columns'][number]]: T['columns'][K]['type'];
      }
    : Relation['options'] extends RelationKeysOptions
    ? Record<
        Relation['options']['primaryKey'],
        T['columns'][Relation['options']['primaryKey']]['type']
      >
    : Relation['options'] extends RelationThroughOptions
    ? RelationConfig<
        T,
        Relations,
        Relations[Relation['options']['through']],
        Relation['options']['through']
      >['params']
    : never;
  populate: Populate;
  chainedCreate: Relation['options'] extends RelationThroughOptions
    ? false
    : true;
  chainedDelete: true;
};

type State = {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
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
      this.state.primaryKeys,
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
      this.state.primaryKeys,
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
        return joinHasThrough(
          toQuery,
          fromQuery,
          toQuery,
          throughRelation,
          sourceRelation,
        );
      },
      reverseJoin(fromQuery, toQuery) {
        return joinHasThrough(
          fromQuery,
          fromQuery,
          toQuery,
          throughRelation,
          sourceRelation,
        );
      },
    };
  }

  const primaryKeys =
    'columns' in relation.options
      ? relation.options.columns
      : [relation.options.primaryKey];

  const foreignKeys =
    'columns' in relation.options
      ? relation.options.references
      : [relation.options.foreignKey];

  const state: State = { query, primaryKeys, foreignKeys };
  const len = primaryKeys.length;

  const reversedOn: Record<string, string> = {};
  for (let i = 0; i < len; i++) {
    reversedOn[foreignKeys[i]] = primaryKeys[i];
  }

  const fromQuerySelect = [{ selectAs: reversedOn }];

  return {
    returns: 'many',
    method: (params: Record<string, unknown>) => {
      const values: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        values[foreignKeys[i]] = params[primaryKeys[i]];
      }
      return query.where(values)._defaults(values);
    },
    virtualColumn: new HasManyVirtualColumn(relationName, state),
    joinQuery(fromQuery, toQuery) {
      return joinHasRelation(fromQuery, toQuery, primaryKeys, foreignKeys, len);
    },
    reverseJoin(fromQuery, toQuery) {
      return joinHasRelation(toQuery, fromQuery, foreignKeys, primaryKeys, len);
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
  t: Query,
  data: Record<string, unknown>[],
  params: MaybeArray<WhereArg<WhereQueryBase>> | undefined,
  primaryKeys: string[],
  foreignKeys: string[],
): WhereResult<Query> => {
  return t.where({
    IN: {
      columns: foreignKeys,
      values: data.map((item) => primaryKeys.map((key) => item[key])),
    },
    OR: params ? toArray(params) : undefined,
  });
};

const nestedInsert = ({ query, primaryKeys, foreignKeys }: State) => {
  const len = primaryKeys.length;

  return (async (_, data) => {
    const t = query.clone();

    // array to store specific items will be reused
    const items: unknown[] = [];
    for (const item of data) {
      if (item[1].connect) {
        items.push(item);
      }
    }

    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, { connect }] = items[i] as [
          Record<string, unknown>,
          { connect: NestedInsertManyConnect },
        ];

        const obj: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        items[i] = t
          .orWhere<Query>(...connect)
          ._updateOrThrow(obj as UpdateData<WhereResult<Query>>);
      }

      await Promise.all(items);
    }

    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        items.push(item);
      }
    }

    let connected: number[];
    if (items.length) {
      const queries: Query[] = [];
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, { connectOrCreate }] = items[i] as [
          Record<string, unknown>,
          { connectOrCreate: NestedInsertManyConnectOrCreate },
        ];

        for (const item of connectOrCreate) {
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < len; i++) {
            obj[foreignKeys[i]] = selfData[primaryKeys[i]];
          }

          queries.push(
            (
              t.where(item.where) as WhereResult<Query & { hasSelect: false }>
            )._update(obj as UpdateData<WhereResult<Query>>),
          );
        }
      }

      connected = (await Promise.all(queries)) as number[];
    } else {
      connected = [];
    }

    let connectedI = 0;
    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        const length = item[1].connectOrCreate.length;
        connectedI += length;
        for (let i = length; i > 0; i--) {
          if (connected[connectedI - i] === 0) {
            items.push(item);
            break;
          }
        }
      } else if (item[1].create) {
        items.push(item);
      }
    }

    connectedI = 0;
    if (items.length) {
      const records: Record<string, unknown>[] = [];

      for (const [selfData, { create, connectOrCreate }] of items as [
        Record<string, unknown>,
        NestedInsertManyItems,
      ][]) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        if (create) {
          for (const item of create) {
            records.push({
              ...item,
              ...obj,
            });
          }
        }

        if (connectOrCreate) {
          for (const item of connectOrCreate) {
            if (connected[connectedI++] === 0) {
              records.push({
                ...item.create,
                ...obj,
              });
            }
          }
        }
      }

      await t._createMany(records);
    }
  }) as HasManyNestedInsert;
};

const nestedUpdate = ({ query, primaryKeys, foreignKeys }: State) => {
  const len = primaryKeys.length;

  return (async (_, data, params) => {
    const t = query.clone();
    if (params.create) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = data[0][primaryKeys[i]];
      }

      // TODO: optimize calling count
      await t.count()._createMany(
        params.create.map((create) => ({
          ...create,
          ...obj,
        })),
      );

      delete t.q[toSQLCacheKey];
    }

    if (params.disconnect || params.set) {
      const obj: Record<string, unknown> = {};
      for (const foreignKey of foreignKeys) {
        obj[foreignKey] = null;
      }

      await getWhereForNestedUpdate(
        t,
        data,
        params.disconnect,
        primaryKeys,
        foreignKeys,
      )._update(obj as UpdateData<WhereResult<Query>>);

      if (params.set) {
        delete t.q[toSQLCacheKey];

        const obj: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = data[0][primaryKeys[i]];
        }

        await t
          .where<Query>(
            Array.isArray(params.set)
              ? {
                  OR: params.set,
                }
              : params.set,
          )
          ._update(obj as UpdateData<WhereResult<Query>>);
      }
    }

    if (params.delete || params.update) {
      delete t.q[toSQLCacheKey];

      const q = getWhereForNestedUpdate(
        t,
        data,
        params.delete || params.update?.where,
        primaryKeys,
        foreignKeys,
      );

      if (params.delete) {
        await q._delete();
      } else if (params.update) {
        await q._update<WhereResult<Query>>(params.update.data);
      }
    }
  }) as HasManyNestedUpdate;
};
