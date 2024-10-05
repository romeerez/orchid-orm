import {
  RelationData,
  RelationThunkBase,
  RelationConfigSelf,
} from './relations';
import {
  CreateData,
  Query,
  toSQLCacheKey,
  WhereArg,
  WhereResult,
  InsertQueryData,
  isQueryReturnsAll,
  VirtualColumn,
  CreateCtx,
  UpdateCtx,
  UpdateData,
  AddQueryDefaults,
  RelationJoinQuery,
  _queryDefaults,
  _queryUpdateOrThrow,
  _queryUpdate,
  _queryCreateMany,
  _queryDelete,
  PickQueryMetaRelations,
  RelationConfigBase,
  PickQueryQ,
} from 'pqb';
import {
  ColumnSchemaConfig,
  EmptyObject,
  MaybeArray,
  objectHasValues,
  RecordString,
  RecordUnknown,
  toArray,
} from 'orchid-core';
import {
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  joinHasRelation,
  joinHasThrough,
  joinQueryChainingHOF,
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
  NestedUpdateManyItems,
} from './common/utils';
import { RelationThroughOptions } from './common/options';
import { defaultSchemaConfig } from 'pqb';
import { HasOneOptions, HasOneParams, HasOnePopulate } from './hasOne';

export interface HasMany extends RelationThunkBase {
  type: 'hasMany';
  options: HasOneOptions;
}

export interface HasManyInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends HasMany,
  Q extends Query,
> extends RelationConfigBase {
  query: Q;
  params: HasOneParams<T, Rel>;
  maybeSingle: Q;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: {
    [P in Name]?: T['relations'][Name]['options'] extends RelationThroughOptions
      ? EmptyObject
      : {
          // create related records
          create?: CreateData<
            T['relations'][Name]['options'] extends RelationThroughOptions
              ? Q
              : AddQueryDefaults<Q, HasOnePopulate<T, Name>>
          >[];
          // find existing records by `where` conditions and update their foreign keys with the new id
          connect?: WhereArg<Q>[];
          // try finding records by `where` conditions, and create them if not found
          connectOrCreate?: {
            where: WhereArg<Q>;
            create: CreateData<
              T['relations'][Name]['options'] extends RelationThroughOptions
                ? Q
                : AddQueryDefaults<Q, HasOnePopulate<T, Name>>
            >;
          }[];
        };
  };
  dataForCreate: never;
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
    disconnect?: MaybeArray<WhereArg<Q>>;
    delete?: MaybeArray<WhereArg<Q>>;
    update?: {
      where: MaybeArray<WhereArg<Q>>;
      data: UpdateData<Q>;
    };
    set?: MaybeArray<WhereArg<Q>>;
    create?: CreateData<
      T['relations'][Name]['options'] extends RelationThroughOptions
        ? Q
        : AddQueryDefaults<Q, HasOnePopulate<T, Name>>
    >[];
  };
}

interface State {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
}

export type HasManyNestedUpdate = (
  query: Query,
  data: RecordUnknown[],
  relationData: NestedUpdateManyItems,
) => Promise<void>;

export type HasManyNestedInsert = (
  query: Query,
  data: [selfData: RecordUnknown, relationData: NestedInsertManyItems][],
) => Promise<void>;

class HasManyVirtualColumn extends VirtualColumn<ColumnSchemaConfig> {
  private readonly nestedInsert: HasManyNestedInsert;
  private readonly nestedUpdate: HasManyNestedUpdate;

  constructor(
    schema: ColumnSchemaConfig,
    private key: string,
    private state: State,
  ) {
    super(schema);
    this.nestedInsert = nestedInsert(state);
    this.nestedUpdate = nestedUpdate(state);
  }

  create(q: Query, ctx: CreateCtx, item: RecordUnknown, rowIndex: number) {
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

  update(q: Query, _: UpdateCtx, set: RecordUnknown) {
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

    const throughRelation = getThroughRelation(table, through);
    const sourceRelation = getSourceRelation(throughRelation, source);
    const sourceRelationQuery = (sourceRelation.query as Query).as(
      relationName,
    );
    const sourceQuery = sourceRelation.joinQuery(
      sourceRelationQuery,
      throughRelation.query,
    );

    const whereExistsCallback = () => sourceQuery;

    const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
      return joinHasThrough(
        baseQuery as Query,
        baseQuery as Query,
        joiningQuery as Query,
        throughRelation,
        sourceRelation,
      );
    };

    return {
      returns: 'many',
      queryRelated: (params: RecordUnknown) => {
        const throughQuery = table.queryRelated(through, params) as Query;

        return query.whereExists(
          throughQuery,
          whereExistsCallback as never,
        ) as never;
      },
      joinQuery: joinQueryChainingHOF(reverseJoin, (joiningQuery, baseQuery) =>
        joinHasThrough(
          joiningQuery as Query,
          baseQuery as Query,
          joiningQuery as Query,
          throughRelation,
          sourceRelation,
        ),
      ),
      reverseJoin,
    };
  }

  const primaryKeys = relation.options.columns as string[];
  const foreignKeys = relation.options.references as string[];

  const state: State = { query, primaryKeys, foreignKeys };
  const len = primaryKeys.length;

  const reversedOn: RecordString = {};
  for (let i = 0; i < len; i++) {
    reversedOn[foreignKeys[i]] = primaryKeys[i];
  }

  const fromQuerySelect = [{ selectAs: reversedOn }];

  const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
    return joinHasRelation(
      joiningQuery as Query,
      baseQuery as Query,
      foreignKeys,
      primaryKeys,
      len,
    );
  };

  return {
    returns: 'many',
    queryRelated: (params: RecordUnknown) => {
      const values: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        values[foreignKeys[i]] = params[primaryKeys[i]];
      }
      return _queryDefaults(query.where(values as never), values);
    },
    virtualColumn: new HasManyVirtualColumn(
      defaultSchemaConfig,
      relationName,
      state,
    ),
    joinQuery: joinQueryChainingHOF(reverseJoin, (joiningQuery, baseQuery) =>
      joinHasRelation(
        baseQuery as Query,
        joiningQuery as Query,
        primaryKeys,
        foreignKeys,
        len,
      ),
    ),
    reverseJoin,
    modifyRelatedQuery(relationQuery) {
      return (query) => {
        const baseQuery = (query as Query).clone();
        baseQuery.q.select = fromQuerySelect;
        const q = (relationQuery as unknown as PickQueryQ).q as InsertQueryData;
        q.kind = 'from';
        q.values = { from: baseQuery };
      };
    },
  };
};

const getWhereForNestedUpdate = (
  t: Query,
  data: RecordUnknown[],
  params: MaybeArray<WhereArg<PickQueryMetaRelations>> | undefined,
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
          RecordUnknown,
          { connect: NestedInsertManyConnect },
        ];

        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        items[i] = _queryUpdateOrThrow(
          t.orWhere<Query>(...(connect as never[])),
          obj as never,
        );
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
          RecordUnknown,
          { connectOrCreate: NestedInsertManyConnectOrCreate },
        ];

        for (const item of connectOrCreate) {
          const obj: RecordUnknown = {};
          for (let i = 0; i < len; i++) {
            obj[foreignKeys[i]] = selfData[primaryKeys[i]];
          }

          queries.push(
            _queryUpdate(
              t.where(item.where as WhereArg<Query>) as never,
              obj as never,
            ),
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
      const records: RecordUnknown[] = [];

      for (const [selfData, { create, connectOrCreate }] of items as [
        RecordUnknown,
        NestedInsertManyItems,
      ][]) {
        const obj: RecordUnknown = {};
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

      await _queryCreateMany(t, records);
    }
  }) as HasManyNestedInsert;
};

const nestedUpdate = ({ query, primaryKeys, foreignKeys }: State) => {
  const len = primaryKeys.length;

  return (async (_, data, params) => {
    const t = query.clone();
    if (params.create) {
      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = data[0][primaryKeys[i]];
      }

      await t.insertMany(
        params.create.map((create) => ({
          ...create,
          ...obj,
        })),
      );

      delete t.q[toSQLCacheKey];
    }

    if (params.disconnect || params.set) {
      const obj: RecordUnknown = {};
      for (const foreignKey of foreignKeys) {
        obj[foreignKey] = null;
      }

      await _queryUpdate(
        getWhereForNestedUpdate(
          t,
          data,
          params.disconnect,
          primaryKeys,
          foreignKeys,
        ),
        obj as never,
      );

      if (
        params.set &&
        (Array.isArray(params.set)
          ? params.set.length
          : objectHasValues(params.set))
      ) {
        delete t.q[toSQLCacheKey];

        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = data[0][primaryKeys[i]];
        }

        await _queryUpdate(
          t.where<Query>(
            (Array.isArray(params.set)
              ? {
                  OR: params.set,
                }
              : params.set) as never,
          ),
          obj as never,
        );
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
        await _queryDelete(q);
      } else if (params.update) {
        await _queryUpdate(q, params.update.data as never);
      }
    }
  }) as HasManyNestedUpdate;
};
