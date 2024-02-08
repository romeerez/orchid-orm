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
  JoinCallback,
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
  WhereResult,
} from 'pqb';
import { Table, TableClass } from '../baseTable';
import {
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
  joinHasRelation,
  joinHasThrough,
  joinQueryChainingHOF,
  NestedInsertOneItem,
  NestedInsertOneItemConnect,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  RelJoin,
} from './common/utils';
import { ColumnSchemaConfig, ColumnsShapeBase, EmptyObject } from 'orchid-core';
import {
  RelationCommonOptions,
  RelationHasOptions,
  RelationKeysOptions,
  RelationRefsOptions,
  RelationThroughOptions,
} from './common/options';
import { defaultSchemaConfig } from 'pqb';

export type HasOne = RelationThunkBase & {
  type: 'hasOne';
  options: HasOneOptions;
};

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

export interface HasOneInfo<
  T extends Table,
  Relations extends RelationThunks,
  Relation extends HasOne,
  Name extends string,
  TableQuery extends Query,
  Populate extends Record<
    string,
    true
  > = Relation['options'] extends RelationRefsOptions
    ? Record<Relation['options']['references'][number], true>
    : Relation['options'] extends RelationKeysOptions
    ? Record<Relation['options']['foreignKey'], true>
    : never,
  Q extends Query = Relation['options'] extends RelationThroughOptions
    ? {
        [K in keyof TableQuery]: K extends 'meta'
          ? TableQuery['meta'] & {
              as: Name;
              defaults: Populate;
              hasWhere: true;
            }
          : K extends 'selectable'
          ? SelectableFromShape<TableQuery['shape'], Name>
          : K extends 'join'
          ? RelJoin
          : K extends CreateMethodsNames
          ? never
          : TableQuery[K];
      }
    : {
        [K in keyof TableQuery]: K extends 'meta'
          ? TableQuery['meta'] & {
              as: Name;
              defaults: Populate;
              hasWhere: true;
            }
          : K extends 'selectable'
          ? SelectableFromShape<TableQuery['shape'], Name>
          : K extends 'join'
          ? RelJoin
          : TableQuery[K];
      },
  NestedCreateQuery extends Query = Relation['options'] extends RelationThroughOptions
    ? Q
    : AddQueryDefaults<Q, Populate>,
> extends RelationConfigBase {
  query: Q;
  methodQuery: Relation['options']['required'] extends true
    ? SetQueryReturnsOne<Q>
    : SetQueryReturnsOneOptional<Q>;
  joinQuery: RelationJoinQuery;
  one: true;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: Relation['options'] extends RelationThroughOptions
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

  params: Relation['options'] extends RelationRefsOptions
    ? {
        [Name in Relation['options']['columns'][number]]: T['columns'][Name]['type'];
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
}

type State = {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
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
      (params: Record<string, unknown>) => Query
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
      method: (params: Record<string, unknown>) => {
        const throughQuery = (table as unknown as TableWithQueryMethod)[
          through
        ](params);

        return query.whereExists<Query, Query>(
          throughQuery,
          whereExistsCallback as unknown as JoinCallback<Query, Query>,
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

  const reversedOn: Record<string, string> = {};
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
    method: (params: Record<string, unknown>) => {
      const values: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        values[foreignKeys[i]] = params[primaryKeys[i]];
      }
      return _queryDefaults(query.where(values), values);
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
        const [selfData, item] = items[i] as [
          Record<string, unknown>,
          Record<string, unknown>,
        ];

        const data: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          data[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        items[i] =
          'connect' in item
            ? _queryUpdateOrThrow(
                t.where(item.connect as NestedInsertOneItemConnect) as Omit<
                  Query,
                  'meta'
                > & {
                  meta: Omit<Query['meta'], 'hasSelect' | 'hasWhere'> & {
                    hasWhere: true;
                  };
                },
                data as UpdateData<WhereResult<Query>>,
              )
            : _queryUpdate(
                t.where(
                  (item.connectOrCreate as NestedInsertOneItemConnectOrCreate)
                    .where,
                ) as Omit<Query, 'meta'> & {
                  meta: Omit<Query['meta'], 'hasSelect' | 'hasWhere'> & {
                    hasWhere: true;
                  };
                },
                data as UpdateData<WhereResult<Query>>,
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
        const [selfData, item] = items[i] as [
          Record<string, unknown>,
          Record<string, unknown>,
        ];
        const data: Record<string, unknown> = {
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

      await t.insertMany(items as Record<string, unknown>[]);
    }
  }) as HasOneNestedInsert;
};

const nestedUpdate = ({ query, primaryKeys, foreignKeys }: State) => {
  const len = primaryKeys.length;

  const setNulls: Record<string, unknown> = {};
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
      await _queryUpdate(
        currentRelationsQuery,
        setNulls as UpdateData<WhereResult<Query>>,
      );

      const record = data[0];

      if (params.create) {
        const obj: Record<string, unknown> = { ...params.create };
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = record[primaryKeys[i]];
        }

        await t.insert(obj);
      }

      if (params.set) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = record[primaryKeys[i]];
        }

        await _queryUpdate(
          _queryWhere(t as Query, [params.set]) as WhereResult<Query>,
          obj as UpdateData<WhereResult<Query>>,
        );
      }
    } else if (params.update) {
      await _queryUpdate(
        currentRelationsQuery,
        params.update as UpdateData<WhereResult<Query>>,
      );
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
          ids.reduce((rows: Record<string, unknown>[], ids) => {
            if (
              !updatedIds.some((updated) =>
                updated.every((value, i) => value === ids[i]),
              )
            ) {
              const obj: Record<string, unknown> = { ...data };

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
