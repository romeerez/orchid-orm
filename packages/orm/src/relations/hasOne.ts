import {
  _queryDefaults,
  _queryDelete,
  _queryRows,
  _queryUpdate,
  _queryUpdateOrThrow,
  _queryWhere,
  AddQueryDefaults,
  CreateBelongsToData,
  CreateCtx,
  CreateData,
  CreateMethodsNames,
  InsertQueryData,
  isQueryReturnsAll,
  PickQueryQ,
  Query,
  RelationConfigBase,
  RelationJoinQuery,
  SelectableFromShape,
  QueryTake,
  QueryTakeOptional,
  UpdateCtx,
  UpdateData,
  VirtualColumn,
  WhereArg,
  getPrimaryKeys,
} from 'pqb';
import { ORMTableInput, TableClass } from '../baseTable';
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
  joinHasRelation,
  joinHasThrough,
  NestedInsertOneItem,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  RelJoin,
} from './common/utils';
import {
  ColumnSchemaConfig,
  ColumnsShapeBase,
  EmptyObject,
  RecordString,
  RecordUnknown,
} from 'orchid-core';
import { RelationRefsOptions, RelationThroughOptions } from './common/options';
import { defaultSchemaConfig } from 'pqb';
import { joinQueryChainHOF } from './common/joinQueryChain';

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
  Columns extends ColumnsShapeBase = ColumnsShapeBase,
  Related extends TableClass = TableClass,
  Through extends string = string,
  Source extends string = string,
> =
  | RelationRefsOptions<
      keyof Columns,
      InstanceType<Related>['columns']['shape']
    >
  | RelationHasOneThroughOptions<Through, Source>;

export type HasOneParams<
  T extends RelationConfigSelf,
  Relation extends RelationThunkBase,
> = Relation['options'] extends RelationRefsOptions
  ? {
      [Name in Relation['options']['columns'][number]]: T['columns']['shape'][Name]['type'];
    }
  : Relation['options'] extends RelationThroughOptions
  ? RelationConfigParams<T, T['relations'][Relation['options']['through']]>
  : never;

export type HasOnePopulate<
  T extends RelationConfigSelf,
  Name extends string,
> = T['relations'][Name]['options'] extends RelationRefsOptions
  ? Record<T['relations'][Name]['options']['references'][number], true>
  : never;

export type HasOneQuery<
  T extends RelationConfigSelf,
  Name extends string,
  TableQuery extends Query,
> = T['relations'][Name]['options'] extends RelationThroughOptions
  ? {
      [K in keyof TableQuery]: K extends 'meta'
        ? Omit<TableQuery['meta'], 'selectable'> & {
            as: Name;
            defaults: HasOnePopulate<T, Name>;
            hasWhere: true;
            selectable: SelectableFromShape<TableQuery['shape'], Name>;
          }
        : K extends 'join'
        ? RelJoin
        : K extends CreateMethodsNames
        ? never
        : TableQuery[K];
    }
  : {
      [K in keyof TableQuery]: K extends 'meta'
        ? Omit<TableQuery['meta'], 'selectable'> & {
            as: Name;
            defaults: HasOnePopulate<T, Name>;
            hasWhere: true;
            selectable: SelectableFromShape<TableQuery['shape'], Name>;
          }
        : K extends 'join'
        ? RelJoin
        : TableQuery[K];
    };

export interface HasOneInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends HasOne,
  Q extends Query,
  CD = T['relations'][Name]['options'] extends RelationThroughOptions
    ? CreateData<Q, CreateBelongsToData<Q>>
    : CreateData<
        AddQueryDefaults<Q, HasOnePopulate<T, Name>>,
        CreateBelongsToData<Q>
      >,
> extends RelationConfigBase {
  returnsOne: true;
  query: Q;
  params: HasOneParams<T, Rel>;
  maybeSingle: T['relations'][Name]['options']['required'] extends true
    ? QueryTake<Q>
    : QueryTakeOptional<Q>;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: T['relations'][Name]['options'] extends RelationThroughOptions
    ? EmptyObject
    : {
        [P in Name]?: RelationToOneDataForCreate<{
          nestedCreateQuery: CD;
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
          create: CD | (() => CD);
        };
      }
    | {
        create: CD;
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

  update(q: Query, _: UpdateCtx, set: RecordUnknown) {
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
        const q = (relationQuery as unknown as PickQueryQ).q as InsertQueryData;
        q.kind = 'from';
        q.values = { from: baseQuery };
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
      await _queryUpdate(currentRelationsQuery, setNulls as never);

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
