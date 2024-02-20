import {
  _queryDefaults,
  _queryDelete,
  _queryRows,
  _queryUpdate,
  _queryUpdateOrThrow,
  _queryWhere,
  AddQueryDefaults,
  CreateCtx,
  CreateData,
  CreateMethodsNames,
  InsertQueryData,
  isQueryReturnsAll,
  Query,
  RelationConfigBase,
  RelationJoinQuery,
  SelectableFromShape,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
  UpdateCtx,
  UpdateData,
  VirtualColumn,
  WhereArg,
} from 'pqb';
import { TableClass } from '../baseTable';
import {
  RelationData,
  RelationThunkBase,
  RelationToOneDataForCreate,
  RelationConfigParams,
  RelationConfigSelf,
} from './relations';
import {
  getSourceRelation,
  getThroughRelation,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  joinHasRelation,
  joinHasThrough,
  joinQueryChainingHOF,
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
  RecordKeyTrue,
  RecordString,
  RecordUnknown,
} from 'orchid-core';
import {
  RelationCommonOptions,
  RelationHasOptions,
  RelationKeysOptions,
  RelationRefsOptions,
  RelationThroughOptions,
} from './common/options';
import { defaultSchemaConfig } from 'pqb';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  options: HasOneOptions;
}

export type HasOneOptions<
  Columns extends ColumnsShapeBase = ColumnsShapeBase,
  Related extends TableClass = TableClass,
  Scope extends Query = Query,
  Through extends string = string,
  Source extends string = string,
> = RelationCommonOptions<Related, Scope> &
  (
    | RelationHasOptions<keyof Columns, keyof InstanceType<Related>['columns']>
    | RelationThroughOptions<Through, Source>
  );

export type HasOneParams<
  T extends RelationConfigSelf,
  Relation extends RelationThunkBase,
> = Relation['options'] extends RelationRefsOptions
  ? {
      [Name in Relation['options']['columns'][number]]: T['columns'][Name]['type'];
    }
  : Relation['options'] extends RelationKeysOptions
  ? Record<
      Relation['options']['primaryKey'],
      T['columns'][Relation['options']['primaryKey']]['type']
    >
  : Relation['options'] extends RelationThroughOptions
  ? RelationConfigParams<T, T['relations'][Relation['options']['through']]>
  : never;

export interface HasOneInfo<
  T extends RelationConfigSelf,
  Name extends keyof T['relations'] & string,
  TableQuery extends Query,
  Populate extends RecordKeyTrue = T['relations'][Name]['options'] extends RelationRefsOptions
    ? Record<T['relations'][Name]['options']['references'][number], true>
    : T['relations'][Name]['options'] extends RelationKeysOptions
    ? Record<T['relations'][Name]['options']['foreignKey'], true>
    : never,
  Q extends Query = T['relations'][Name]['options'] extends RelationThroughOptions
    ? {
        [K in keyof TableQuery]: K extends 'meta'
          ? Omit<TableQuery['meta'], 'selectable'> & {
              as: Name;
              defaults: Populate;
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
              defaults: Populate;
              hasWhere: true;
              selectable: SelectableFromShape<TableQuery['shape'], Name>;
            }
          : K extends 'join'
          ? RelJoin
          : TableQuery[K];
      },
  NestedCreateQuery extends Query = T['relations'][Name]['options'] extends RelationThroughOptions
    ? Q
    : AddQueryDefaults<Q, Populate>,
> extends RelationConfigBase {
  query: Q;
  methodQuery: T['relations'][Name]['options']['required'] extends true
    ? SetQueryReturnsOne<Q>
    : SetQueryReturnsOneOptional<Q>;
  joinQuery: RelationJoinQuery;
  one: true;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: T['relations'][Name]['options'] extends RelationThroughOptions
    ? EmptyObject
    : {
        [P in Name]?: RelationToOneDataForCreate<{
          nestedCreateQuery: NestedCreateQuery;
          table: Q;
        }>;
      };
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

  params: HasOneParams<T, T['relations'][Name]>;
}

interface State {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
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
  table: Query,
  relation: HasOne,
  relationName: string,
  query: Query,
): RelationData => {
  if ('through' in relation.options) {
    const { through, source } = relation.options;

    type TableWithQueryMethod = Record<
      string,
      (params: RecordUnknown) => Query
    >;

    const throughRelation = getThroughRelation(table, through);
    const sourceRelation = getSourceRelation(throughRelation, source);
    const sourceQuery = sourceRelation
      .joinQuery(sourceRelation.query, throughRelation.query)
      .as(relationName);

    const whereExistsCallback = () => sourceQuery;

    const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
      return joinHasThrough(
        baseQuery,
        baseQuery,
        joiningQuery,
        throughRelation,
        sourceRelation,
      );
    };

    return {
      returns: 'one',
      method: (params: RecordUnknown) => {
        const throughQuery = (table as unknown as TableWithQueryMethod)[
          through
        ](params);

        return query.whereExists<Query, Query>(
          throughQuery,
          whereExistsCallback as never,
        );
      },
      joinQuery: joinQueryChainingHOF(reverseJoin, (joiningQuery, baseQuery) =>
        joinHasThrough(
          joiningQuery,
          baseQuery,
          joiningQuery,
          throughRelation,
          sourceRelation,
        ),
      ),
      reverseJoin,
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

  const reversedOn: RecordString = {};
  for (let i = 0; i < len; i++) {
    reversedOn[foreignKeys[i]] = primaryKeys[i];
  }

  const fromQuerySelect = [{ selectAs: reversedOn }];

  const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
    return joinHasRelation(
      joiningQuery,
      baseQuery,
      foreignKeys,
      primaryKeys,
      len,
    );
  };

  return {
    returns: 'one',
    method: (params: RecordUnknown) => {
      const values: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        values[foreignKeys[i]] = params[primaryKeys[i]];
      }
      return _queryDefaults(query.where(values as never), values);
    },
    virtualColumn: new HasOneVirtualColumn(
      defaultSchemaConfig,
      relationName,
      state,
    ),
    joinQuery: joinQueryChainingHOF(reverseJoin, (joiningQuery, baseQuery) =>
      joinHasRelation(baseQuery, joiningQuery, primaryKeys, foreignKeys, len),
    ),
    reverseJoin,
    modifyRelatedQuery(relationQuery) {
      return (query) => {
        const baseQuery = query.clone();
        baseQuery.q.select = fromQuerySelect;
        const q = relationQuery.q as InsertQueryData;
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
                  (item.connectOrCreate as NestedInsertOneItemConnectOrCreate)
                    .where,
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
          _queryWhere(t as Query, [params.set]) as never,
          obj as never,
        );
      }
    } else if (params.update) {
      await _queryUpdate(currentRelationsQuery, params.update as never);
    } else if (params.delete) {
      await _queryDelete(currentRelationsQuery);
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
