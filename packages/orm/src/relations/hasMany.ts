import {
  RelationData,
  RelationThunkBase,
  RelationConfigSelf,
} from './relations';
import { OrchidOrmInternalError, Query } from 'pqb';
import {
  CreateData,
  WhereArg,
  VirtualColumn,
  CreateCtx,
  CreateSelf,
  UpdateData,
  UpdateSelf,
  _queryDefaults,
  _queryUpdateOrThrow,
  _queryUpdate,
  _queryCreateMany,
  _queryDelete,
  PickQueryQ,
  _queryWhere,
  SelectableFromShape,
  ColumnSchemaConfig,
  getPrimaryKeys,
  MaybeArray,
  objectHasValues,
  RecordString,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  toArray,
  prepareSubQueryForSql,
  PickQuerySelectableRelations,
  QueryHasWhere,
  RawSql,
  _hookSelectColumns,
  _queryInsertMany,
  _clone,
  _appendQuery,
  _queryUpsert,
  internalSchemaConfig,
} from 'pqb/internal';
import {
  addAutoForeignKey,
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  joinHasRelation,
  joinHasThrough,
  makeNestedUpdateRelationIds,
  makeNestedUpdateUpsertData,
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
  NestedInsertOneItemConnectOrCreate,
  NestedUpdateManyItems,
  selectCteColumnFromManySql,
  throwIfQueryReturnsAllForNestedUpdate,
} from './common/utils';
import { RelationRefsOptions, RelationThroughOptions } from './common/options';
import { HasOneOptions, HasOneParams, HasOneQueryThrough } from './hasOne';
import { ORMTableInput } from '../orm-table/base-table';
import { joinQueryChainHOF } from './common/joinQueryChain';

export interface HasMany extends RelationThunkBase {
  type: 'hasMany';
  options: HasOneOptions;
}

export type HasManyQuery<
  T extends RelationConfigSelf,
  Name extends string,
  TableQuery extends Query,
> = T['relations'][Name]['options'] extends RelationRefsOptions
  ? {
      [K in keyof TableQuery]: K extends '__defaults'
        ? {
            [K in
              | keyof TableQuery['__defaults']
              | T['relations'][Name]['options']['references'][number]]: true;
          }
        : K extends '__selectable'
          ? SelectableFromShape<TableQuery['shape'], Name>
          : K extends '__as'
            ? Name
            : TableQuery[K];
    } & QueryHasWhere
  : HasOneQueryThrough<Name, TableQuery>;

export interface HasManyInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends HasMany,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: false;
  query: Q;
  params: HasOneParams<T, Rel['options']>;
  omitForeignKeyInCreate: never;
  dataForCreate: {
    [K in Name]?: Q extends Query.Pick.IsNotReadOnly
      ? T['relations'][Name]['options'] extends RelationThroughOptions
        ? never
        : {
            // create related records
            create?: CreateData<Q>[];
            // find existing records by `where` conditions and update their foreign keys with the new id
            connect?: WhereArg<Q>[];
            // try finding records by `where` conditions, and create them if not found
            connectOrCreate?: {
              where: WhereArg<Q>;
              create: CreateData<Q>;
            }[];
          }
      : never;
  };
  // `hasMany` relation data available for update. It supports:
  // - `disconnect` nullifies foreign keys of the related records
  // - `delete` deletes related record found by conditions
  // - `update` updates related records found by conditions with a provided data
  dataForUpdate: Q extends Query.Pick.IsNotReadOnly
    ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
          where: MaybeArray<WhereArg<Q>>;
          data: UpdateData<Q>;
        };
      }
    : never;
  // Only for records that update a single record:
  // - `set` updates foreign keys of related records found by conditions, nullifies previously connected
  // - `add` updates foreign keys of related records found by conditions, doesn't nullify previously connected
  // - `create` creates related records
  dataForUpdateOne: Q extends Query.Pick.IsNotReadOnly
    ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
          where: MaybeArray<WhereArg<Q>>;
          data: UpdateData<Q>;
        };
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
        create?: CreateData<Q>[];
        upsert?: {
          findBy: Q['internal']['uniqueColumns'];
          update: UpdateData<Q>;
          create?: CreateData<Q> | (() => CreateData<Q>);
        };
      }
    : never;
}

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
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
  private readonly setNulls: RecordUnknown;

  constructor(
    schema: ColumnSchemaConfig,
    private key: string,
    private state: State,
  ) {
    super(schema);
    this.nestedInsert = nestedInsert(state);
    this.nestedUpdate = nestedUpdate(state);

    this.setNulls = {};
    for (const foreignKey of state.foreignKeys) {
      this.setNulls[foreignKey] = null;
    }
  }

  create(
    self: CreateSelf,
    ctx: CreateCtx,
    items: RecordUnknown[],
    rowIndexes: number[],
    count: number,
  ) {
    const querySelf = self as unknown as Query;
    if (count <= querySelf.qb.internal.nestedCreateBatchMax) {
      interface NestedCreateItem {
        indexes: number[];
        items: RecordUnknown[];
        values: unknown[][];
      }

      interface NestedCreateItems {
        create?: {
          indexes: number[];
          items: RecordUnknown[][];
        };
        connect?: NestedCreateItem;
        connectOrCreate?: NestedCreateItem;
      }

      const { query: rel, primaryKeys, foreignKeys } = this.state;

      let nestedCreateItems: NestedCreateItems | undefined;

      items.forEach((item, i) => {
        const value = item[this.key] as NestedInsertManyItems;

        if (value.create?.length) {
          const nestedCreateItem = ((nestedCreateItems ??= {}).create ??= {
            indexes: [],
            items: [],
          });
          nestedCreateItem.indexes.push(rowIndexes[i]);

          const data = value.create.map((obj) => {
            const data = { ...obj };
            for (const key of foreignKeys) {
              data[key] = new RawSql('');
            }
            return data;
          });

          nestedCreateItem.items.push(data);
        } else {
          const kind = value.connect?.length
            ? 'connect'
            : value.connectOrCreate?.length
              ? 'connectOrCreate'
              : undefined;

          if (kind) {
            const nestedCreateItem = ((nestedCreateItems ??= {})[kind] ??= {
              indexes: [],
              items: [],
              values: [],
            });
            nestedCreateItem.indexes.push(rowIndexes[i]);
            nestedCreateItem.values.push(value[kind] as unknown[]);

            const data: RecordUnknown = {};
            for (const key of foreignKeys) {
              data[key] = new RawSql('');
            }
            nestedCreateItem.items.push(data);
          }
        }
      });

      if (!nestedCreateItems) {
        return;
      }

      let createAs: string | undefined;
      let connectAs: string | undefined;
      let connectOrCreateAs: string | undefined;
      _hookSelectColumns(querySelf, primaryKeys, (aliasedPrimaryKeys) => {
        foreignKeys.forEach((key, keyI) => {
          const primaryKey = aliasedPrimaryKeys[keyI];

          if (create && createAs) {
            for (let i = 0; i < create.items.length; i++) {
              const sql = selectCteColumnFromManySql(
                createAs,
                primaryKey,
                create.indexes[i],
                count,
              );

              for (const item of create.items[i]) {
                (item[key] as RawSql)._sql = sql;
              }
            }
          }

          if (connect && connectAs) {
            for (let i = 0; i < connect.items.length; i++) {
              (connect.items[i][key] as RawSql)._sql =
                selectCteColumnFromManySql(
                  connectAs,
                  primaryKey,
                  connect.indexes[i],
                  count,
                );
            }
          }

          if (connectOrCreate && connectOrCreateAs) {
            for (let i = 0; i < connectOrCreate.items.length; i++) {
              (connectOrCreate.items[i][key] as RawSql)._sql =
                selectCteColumnFromManySql(
                  connectOrCreateAs,
                  primaryKey,
                  connectOrCreate.indexes[i],
                  count,
                );
            }
          }
        });
      });

      const { create, connect, connectOrCreate } = nestedCreateItems;

      if (create) {
        const query = _queryInsertMany(
          _clone(rel) as unknown as CreateSelf,
          create.items.flat() as never,
        ) as unknown as Query;

        _appendQuery(querySelf, query, (as) => (createAs = as));
      }

      if (connect) {
        connect.values.forEach((value, i) => {
          const query = _queryUpdateOrThrow(
            rel.whereOneOf(...(value as never[])) as never,
            connect.items[i] as never,
          ) as Query;

          query.q.ensureCount = value.length;

          _appendQuery(querySelf, query, (as) => (connectAs = as));
        });
      }

      if (connectOrCreate) {
        connectOrCreate.values.forEach((array, i) => {
          const foreignKeyValues = connectOrCreate.items[i];
          for (const value of array as NestedInsertOneItemConnectOrCreate[]) {
            const query = _queryUpsert(rel.where(value.where) as never, {
              update: foreignKeyValues,
              create: {
                ...value.create,
                ...foreignKeyValues,
              },
            });

            _appendQuery(querySelf, query, (as) => (connectOrCreateAs = as));
          }
        });
      }
    } else {
      hasRelationHandleCreate(
        querySelf,
        ctx,
        items,
        rowIndexes,
        this.key,
        this.state.primaryKeys,
        this.nestedInsert,
      );
    }
  }

  update(self: UpdateSelf, set: RecordUnknown) {
    const querySelf = self as unknown as Query;
    const params = set[this.key] as NestedUpdateManyItems;
    throwIfQueryReturnsAllForNestedUpdate(querySelf, params);

    hasRelationHandleUpdate(
      querySelf,
      set,
      this.key,
      this.state.primaryKeys,
      this.nestedUpdate,
    );

    if (params.upsert) {
      const { primaryKeys, foreignKeys, query: relQuery } = this.state;

      const ids = makeNestedUpdateRelationIds(
        querySelf,
        relQuery,
        primaryKeys,
        foreignKeys,
      );

      const appendedQuery = _queryUpsert(
        ids.existingRelQuery,
        makeNestedUpdateUpsertData(params.upsert, ids.setIds),
      ) as unknown as Query;

      appendedQuery.q.returnType = 'void';

      _appendQuery(querySelf, appendedQuery, ids.setAppendedAs);
    }
  }
}

export const makeHasManyMethod = (
  tableConfig: ORMTableInput,
  table: Query,
  relation: HasMany,
  relationName: string,
  query: Query,
): RelationData => {
  const relPKeys = getPrimaryKeys(query);

  if ('through' in relation.options) {
    const { through, source } = relation.options;

    const throughRelation = getThroughRelation(table, through);
    const sourceRelation = getSourceRelation(throughRelation, source);
    const sourceRelationQuery = (sourceRelation.query as Query).as(
      relationName,
    );
    const sourceQuery = sourceRelation.joinQuery(
      sourceRelationQuery,
      throughRelation.query as never,
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
      joinQuery: joinQueryChainHOF(
        relPKeys,
        reverseJoin,
        (joiningQuery, baseQuery) =>
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
  const { on } = relation.options;

  if (on) {
    _queryWhere(query, [on]);
    _queryDefaults(query as unknown as CreateSelf, on);
  }

  addAutoForeignKey(
    tableConfig,
    query,
    table,
    primaryKeys,
    foreignKeys,
    relation.options,
  );

  const state: State = {
    query: query as Query.NotReadOnlyQuery,
    primaryKeys,
    foreignKeys,
    on,
  };
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

      return _queryDefaults(
        query.where(values as never) as unknown as CreateSelf,
        {
          ...on,
          ...values,
        },
      ) as unknown as Query;
    },
    virtualColumn: new HasManyVirtualColumn(
      internalSchemaConfig,
      relationName,
      state,
    ),
    joinQuery: joinQueryChainHOF(
      relPKeys,
      reverseJoin,
      (joiningQuery, baseQuery) =>
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
        const q = (relationQuery as unknown as PickQueryQ).q;
        q.insertFrom = prepareSubQueryForSql(q as never, baseQuery);
        q.values = [];
      };
    },
  };
};

const getWhereForNestedUpdate = (
  t: Query,
  data: RecordUnknown[],
  params: MaybeArray<WhereArg<PickQuerySelectableRelations>> | undefined,
  primaryKeys: string[],
  foreignKeys: string[],
): Query => {
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
          t.where<Query>({ OR: connect as never[] }) as unknown as UpdateSelf,
          obj as never,
        ) as unknown as Query;
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
              t.where(item.where as WhereArg<Query>) as unknown as UpdateSelf,
              obj as never,
            ) as unknown as Query,
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

const nestedUpdate = ({ query: relQuery, primaryKeys, foreignKeys }: State) => {
  const len = primaryKeys.length;

  return (async (_, data, params) => {
    const t = relQuery.clone();

    if (params.create) {
      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = data[0][primaryKeys[i]];
      }

      await (t as Query.NotReadOnlyQuery).insertMany(
        params.create.map((create) => ({
          ...create,
          ...obj,
        })),
      );
    }

    if (params.add) {
      if (data.length > 1) {
        throw new OrchidOrmInternalError(
          relQuery,
          '`connect` is not available when updating multiple records, it is only applicable for a single record update',
        );
      }

      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = data[0][primaryKeys[i]];
      }

      const relatedWheres = toArray(params.add);

      const count = (await _queryUpdate(
        t.where({ OR: relatedWheres }) as unknown as UpdateSelf,
        obj as never,
      )) as unknown as number;

      if (count < relatedWheres.length) {
        throw new OrchidOrmInternalError(
          relQuery,
          `Expected to find at least ${relatedWheres.length} record(s) based on \`add\` conditions, but found ${count}`,
        );
      }
    }

    if (params.disconnect || params.set) {
      const obj: RecordUnknown = {};
      for (const foreignKey of foreignKeys) {
        obj[foreignKey] = null;
      }

      const setConditions =
        params.set &&
        (Array.isArray(params.set)
          ? params.set.length
          : objectHasValues(params.set)) &&
        (Array.isArray(params.set)
          ? {
              OR: params.set,
            }
          : params.set);

      let queryToDisconnect = getWhereForNestedUpdate(
        t,
        data,
        params.disconnect,
        primaryKeys,
        foreignKeys,
      );

      // do not nullify those records that are going to be set, because the column may non-nullable.
      if (setConditions) {
        queryToDisconnect = queryToDisconnect.whereNot(setConditions) as never;
      }

      await _queryUpdate(
        queryToDisconnect as unknown as UpdateSelf,
        obj as never,
      );

      if (setConditions) {
        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = data[0][primaryKeys[i]];
        }

        await _queryUpdate(
          t.where<Query>(setConditions as never) as unknown as UpdateSelf,
          obj as never,
        );
      }
    }

    if (params.delete || params.update) {
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
        await _queryUpdate(
          q as unknown as UpdateSelf,
          params.update.data as never,
        );
      }
    }
  }) as HasManyNestedUpdate;
};
