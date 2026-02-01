import {
  _queryDefaults,
  _queryDelete,
  _queryUpdate,
  _queryUpdateOrThrow,
  _queryWhere,
  CreateCtx,
  CreateData,
  CreateMethodsNames,
  isQueryReturnsAll,
  PickQueryQ,
  Query,
  SelectableFromShape,
  UpdateData,
  VirtualColumn,
  WhereArg,
  defaultSchemaConfig,
  CreateManyMethodsNames,
  ColumnSchemaConfig,
  EmptyObject,
  getPrimaryKeys,
  RecordString,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  Column,
  QueryHasWhere,
  QueryManyTake,
  QueryManyTakeOptional,
  RawSql,
  _appendQuery,
  _clone,
  _queryUpsert,
  _queryWhereIn,
  _queryInsert,
  noop,
  _queryInsertMany,
  _hookSelectColumns,
} from 'pqb';
import { ORMTableInput } from '../baseTable';
import {
  RelationData,
  RelationThunkBase,
  RelationToOneDataForCreate,
  RelationConfigParams,
  RelationConfigSelf,
} from './relations';
import {
  addAutoForeignKey,
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  HasRelJoin,
  joinHasRelation,
  joinHasThrough,
  NestedInsertOneItem,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  selectCteColumnFromManySql,
  selectCteColumnSql,
  selectCteColumnsSql,
} from './common/utils';
import { RelationRefsOptions, RelationThroughOptions } from './common/options';
import { joinQueryChainHOF } from './common/joinQueryChain';
import { prepareSubQueryForSql } from 'pqb';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  options: HasOneOptions;
}

interface RelationHasOneThroughOptions<
  Through extends string,
  Source extends string,
> extends RelationThroughOptions<Through, Source> {
  required?: boolean;
}

export type HasOneOptions<
  Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit,
  Related extends ORMTableInput = ORMTableInput,
  Through extends string = string,
  Source extends string = string,
> =
  | RelationRefsOptions<keyof Columns, Related['columns']['shape']>
  | RelationHasOneThroughOptions<Through, Source>;

export type HasOneParams<
  T extends RelationConfigSelf,
  Options,
> = Options extends RelationRefsOptions
  ? {
      [Name in Options['columns'][number]]: T['columns']['shape'][Name]['type'];
    }
  : Options extends RelationThroughOptions
  ? RelationConfigParams<T, T['relations'][Options['through']]>
  : never;

export type HasOneQueryThrough<
  Name extends string,
  TableQuery extends Query,
> = {
  [K in keyof TableQuery]: K extends '__selectable'
    ? SelectableFromShape<TableQuery['shape'], Name>
    : K extends '__as'
    ? Name
    : K extends CreateMethodsNames
    ? never
    : TableQuery[K];
} & QueryHasWhere &
  HasRelJoin;

export type HasOneQuery<
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
        : K extends CreateManyMethodsNames
        ? never
        : TableQuery[K];
    } & QueryHasWhere &
      HasRelJoin
  : HasOneQueryThrough<Name, TableQuery>;

export interface HasOneInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends HasOne,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: true;
  query: Q;
  params: HasOneParams<T, Rel['options']>;
  maybeSingle: T['relations'][Name]['options']['required'] extends true
    ? QueryManyTake<Q>
    : QueryManyTakeOptional<Q>;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: T['relations'][Name]['options'] extends RelationThroughOptions
    ? EmptyObject
    : {
        [P in Name]?: RelationToOneDataForCreate<{
          nestedCreateQuery: CreateData<Q>;
          table: Q;
        }>;
      };
  dataForCreate: never;
  // `hasOne` relation data available for update. It supports:
  // - `disconnect` to nullify a foreign key of the related record
  // - `delete` to delete the related record
  // - `update` to update the related record
  dataForUpdate:
    | { disconnect: boolean }
    | { delete: boolean }
    | { update: UpdateData<Q> };
  // Only for records that update a single record:
  // - `set` to update the foreign key of related record found by condition
  // - `upsert` to update or create the related record
  // - `create` to create a related record
  dataForUpdateOne:
    | { disconnect: boolean }
    | { set: WhereArg<Q> }
    | { delete: boolean }
    | { update: UpdateData<Q> }
    | {
        upsert: {
          update: UpdateData<Q>;
          create: CreateData<Q> | (() => CreateData<Q>);
        };
      }
    | {
        create: CreateData<Q>;
      };
}

interface State {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
}

export type HasOneNestedInsert = (
  query: Query,
  data: [selfData: RecordUnknown, relationData: NestedInsertOneItem][],
) => Promise<void>;

export type HasOneNestedUpdate = (
  query: Query,
  data: RecordUnknown[],
  relationData: NestedUpdateOneItem,
) => Promise<void>;

class HasOneVirtualColumn extends VirtualColumn<ColumnSchemaConfig> {
  private readonly nestedInsert: HasOneNestedInsert;
  private readonly setNulls: RecordUnknown;

  constructor(
    schema: ColumnSchemaConfig,
    private key: string,
    private state: State,
  ) {
    super(schema);
    this.nestedInsert = nestedInsert(state);

    this.setNulls = {};
    for (const foreignKey of state.foreignKeys) {
      this.setNulls[foreignKey] = null;
    }
  }

  create(
    self: Query,
    ctx: CreateCtx,
    items: RecordUnknown[],
    rowIndexes: number[],
    count: number,
  ) {
    if (count <= self.qb.internal.nestedCreateBatchMax) {
      interface NestedCreateItem {
        indexes: number[];
        items: RecordUnknown[];
        values: RecordUnknown[];
      }

      interface NestedCreateItems {
        create?: NestedCreateItem;
        connect?: NestedCreateItem;
        connectOrCreate?: NestedCreateItem;
      }

      const { query: rel, primaryKeys, foreignKeys } = this.state;

      let nestedCreateItems: NestedCreateItems | undefined;

      items.forEach((item, i) => {
        const value = item[this.key] as NestedInsertOneItem;
        const kind = value.create
          ? 'create'
          : value.connect
          ? 'connect'
          : 'connectOrCreate';

        if (kind) {
          const nestedCreateItem = ((nestedCreateItems ??= {})[kind] ??= {
            indexes: [],
            items: [],
            values: [],
          });
          nestedCreateItem.indexes.push(rowIndexes[i]);
          nestedCreateItem.values.push(value[kind] as RecordUnknown);

          const data = value.create ? { ...value.create } : {};

          for (const key of foreignKeys) {
            data[key] = new RawSql('');
          }

          nestedCreateItem.items.push(data);
        }
      });

      if (!nestedCreateItems) {
        return;
      }

      let createAs: string | undefined;
      let connectAs: string | undefined;
      let connectOrCreateAs: string | undefined;
      _hookSelectColumns(self, primaryKeys, (aliasedPrimaryKeys) => {
        foreignKeys.forEach((key, keyI) => {
          const primaryKey = aliasedPrimaryKeys[keyI];

          if (create && createAs) {
            for (let i = 0; i < create.items.length; i++) {
              (create.items[i][key] as RawSql)._sql =
                selectCteColumnFromManySql(
                  createAs,
                  primaryKey,
                  create.indexes[i],
                  count,
                );
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
        const query = _queryInsertMany(_clone(rel), create.items as never);

        _appendQuery(self, query, (as) => (createAs = as));
      }

      if (connect) {
        connect.values.forEach((value, i) => {
          const query = _queryUpdateOrThrow(
            rel.where(value as never) as never,
            connect.items[i] as never,
          ) as Query;

          query.q.ensureCount = 1;

          _appendQuery(self, query, (as) => (connectAs = as));
        });
      }

      if (connectOrCreate) {
        connectOrCreate.values.forEach((value, i) => {
          const query = _queryUpsert(rel.where(value.where as never) as never, {
            update: connectOrCreate.items[i],
            create: {
              ...(value.create as RecordUnknown),
              ...connectOrCreate.items[i],
            },
          });

          _appendQuery(self, query, (as) => (connectOrCreateAs = as));
        });
      }
    } else {
      hasRelationHandleCreate(
        self,
        ctx,
        items,
        rowIndexes,
        this.key,
        this.state.primaryKeys,
        this.nestedInsert,
      );
    }
  }

  update(self: Query, set: RecordUnknown) {
    const params = set[this.key] as NestedUpdateOneItem;
    if (
      (params.set || params.create || params.upsert) &&
      isQueryReturnsAll(self)
    ) {
      const key = params.set ? 'set' : params.create ? 'create' : 'upsert';
      throw new Error(`\`${key}\` option is not allowed in a batch update`);
    }

    const { primaryKeys, foreignKeys, query: relQuery } = this.state;
    if (
      params.create ||
      params.update ||
      params.upsert ||
      params.disconnect ||
      params.set ||
      params.delete
    ) {
      let appendedAs: string | undefined;
      _hookSelectColumns(self, primaryKeys, (aliasedPrimaryKeys) => {
        selectIdsSql._sql = selectCteColumnsSql(
          appendedAs as string,
          aliasedPrimaryKeys,
        );

        if (params.create || params.set || params.upsert) {
          foreignKeys.forEach((foreignKey, i) => {
            (setIds[foreignKey] as RawSql)._sql = selectCteColumnSql(
              appendedAs as string,
              aliasedPrimaryKeys[i],
            );
          });
        }
      });

      const selectIdsSql = new RawSql('');

      const existingRelQuery = _queryWhereIn(
        _clone(relQuery),
        true,
        foreignKeys,
        selectIdsSql,
      );

      let setIds = undefined as unknown as RecordUnknown;
      if (params.create || params.set || params.upsert) {
        setIds = {};
        foreignKeys.forEach((foreignKey) => {
          setIds[foreignKey] = new RawSql('');
        });
      }

      const nullifyOrDeleteQuery = params.update
        ? _queryUpdate(existingRelQuery, params.update)
        : params.upsert
        ? _queryUpsert(existingRelQuery, {
            update: params.upsert.update,
            create: {
              ...(typeof params.upsert.create === 'function'
                ? params.upsert.create()
                : params.upsert.create),
              ...setIds,
            },
          })
        : params.delete
        ? _queryDelete(existingRelQuery)
        : _queryUpdate(existingRelQuery, this.setNulls);

      nullifyOrDeleteQuery.q.returnType = 'void';

      _appendQuery(self, nullifyOrDeleteQuery, (as) => (appendedAs = as));

      if (params.create) {
        const createQuery = _queryInsert(_clone(relQuery), {
          ...params.create,
          ...setIds,
        });

        _appendQuery(self, createQuery, noop);
      } else if (params.set) {
        const setQuery = _queryUpdate(
          _queryWhere(_clone(relQuery), [params.set as never]),
          setIds,
        );
        setQuery.q.returnType = 'void';

        _appendQuery(self, setQuery, noop);
      }
    }
  }
}

export const makeHasOneMethod = (
  tableConfig: ORMTableInput,
  table: Query,
  relation: HasOne,
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
    ) as Query;

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
      returns: 'one',
      queryRelated: (params: RecordUnknown) => {
        const throughQuery = table.queryRelated(through, params) as Query;

        return query.whereExists(throughQuery, whereExistsCallback);
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
    _queryDefaults(query, on);
  }

  addAutoForeignKey(
    tableConfig,
    query,
    table,
    primaryKeys,
    foreignKeys,
    relation.options,
  );

  const state: State = { query, primaryKeys, foreignKeys, on };
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
    returns: 'one',
    queryRelated: (params: RecordUnknown) => {
      const values: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        values[foreignKeys[i]] = params[primaryKeys[i]];
      }

      return _queryDefaults(query.where(values as never), { ...on, ...values });
    },
    virtualColumn: new HasOneVirtualColumn(
      defaultSchemaConfig,
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

const nestedInsert = ({ query, primaryKeys, foreignKeys }: State) => {
  return (async (_, data) => {
    const t = query.clone();

    // array to store specific items will be reused
    const items: unknown[] = [];
    for (const item of data) {
      if (item[1].connect || item[1].connectOrCreate) {
        items.push(item);
      }
    }

    let connected: number[];
    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, item] = items[i] as [RecordUnknown, RecordUnknown];

        const data: RecordUnknown = {};
        primaryKeys.forEach((primaryKey, i) => {
          data[foreignKeys[i]] = selfData[primaryKey];
        });

        items[i] =
          'connect' in item
            ? _queryUpdateOrThrow(
                t.where(item.connect as WhereArg<Query>) as never,
                data as never,
              )
            : _queryUpdate(
                t.where(
                  (item.connectOrCreate as RecordUnknown)
                    .where as WhereArg<Query>,
                ) as never,
                data as never,
              );
      }

      connected = (await Promise.all(items)) as number[];
    } else {
      connected = [];
    }

    let connectedI = 0;
    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        if (!connected[connectedI++]) {
          items.push(item);
        }
      } else if (item[1].create) {
        items.push(item);
      }
    }

    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, item] = items[i] as [RecordUnknown, RecordUnknown];
        const data: RecordUnknown = {
          ...('create' in item
            ? (item.create as NestedInsertOneItemCreate)
            : (item.connectOrCreate as NestedInsertOneItemConnectOrCreate)
                .create),
        };

        for (let i = 0; i < primaryKeys.length; i++) {
          data[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        items[i] = data;
      }

      await t.insertMany(items as RecordUnknown[]);
    }
  }) as HasOneNestedInsert;
};
