import {
  _queryDefaults,
  _queryDelete,
  _queryRows,
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
  hasRelationHandleUpdate,
  HasRelJoin,
  joinHasRelation,
  joinHasThrough,
  NestedInsertOneItem,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
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
  private readonly nestedUpdate: HasOneNestedUpdate;

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

  update(q: Query, set: RecordUnknown) {
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
      this.state.primaryKeys,
      this.nestedUpdate,
    );
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
        for (let i = 0; i < len; i++) {
          data[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

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

const nestedUpdate = ({ query, primaryKeys, foreignKeys }: State) => {
  const len = primaryKeys.length;

  const setNulls: RecordUnknown = {};
  for (const foreignKey of foreignKeys) {
    setNulls[foreignKey] = null;
  }

  return (async (_, data, params) => {
    const t = query.clone();
    const ids = data.map((item) =>
      primaryKeys.map((primaryKey) => item[primaryKey]),
    );

    const currentRelationsQuery = t.whereIn(
      foreignKeys as [string, ...string[]],
      ids as [unknown, ...unknown[]][],
    );

    if (params.create || params.disconnect || params.set) {
      let queryToDisconnect = currentRelationsQuery;
      // do not nullify the record that is going to be set, because the column may non-nullable.
      if (params.set) {
        queryToDisconnect = queryToDisconnect.whereNot(params.set) as never;
      }

      await _queryUpdate(queryToDisconnect, setNulls as never);

      const record = data[0];

      if (params.create) {
        const obj: RecordUnknown = { ...params.create };
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = record[primaryKeys[i]];
        }

        await t.insert(obj);
      }

      if (params.set) {
        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = record[primaryKeys[i]];
        }

        await _queryUpdate(
          _queryWhere(t as Query, [params.set as never]) as never,
          obj as never,
        );
      }
    } else if (params.update) {
      await _queryUpdate(currentRelationsQuery, params.update as never);
    } else if (params.delete) {
      const q = _queryDelete(currentRelationsQuery);
      q.q.returnType = 'value'; // do not throw
      await q;
    } else if (params.upsert) {
      const { update, create } = params.upsert;
      currentRelationsQuery.q.select = foreignKeys;
      const updatedIds = (await _queryUpdate(
        _queryRows(currentRelationsQuery),
        update as never,
      )) as unknown as unknown[][];

      if (updatedIds.length < ids.length) {
        const data = typeof create === 'function' ? create() : create;

        await t.createMany(
          ids.reduce((rows: RecordUnknown[], ids) => {
            if (
              !updatedIds.some((updated) =>
                updated.every((value, i) => value === ids[i]),
              )
            ) {
              const obj: RecordUnknown = { ...data };

              for (let i = 0; i < len; i++) {
                obj[foreignKeys[i]] = ids[i];
              }

              rows.push(obj);
            }

            return rows;
          }, []),
        );
      }
    }
  }) as HasOneNestedUpdate;
};
