import {
  RelationData,
  RelationThunkBase,
  RelationToManyDataForCreate,
  RelationConfigParams,
  RelationConfigSelf,
} from './relations';
import { TableClass } from '../baseTable';
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
  WhereQueryBase,
  UpdateData,
  AddQueryDefaults,
  RelationJoinQuery,
  _queryDefaults,
  _queryUpdateOrThrow,
  _queryUpdate,
  _queryCreateMany,
  _queryDelete,
  CreateMethodsNames,
  SelectableFromShape,
} from 'pqb';
import {
  ColumnSchemaConfig,
  ColumnsShapeBase,
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
  RelJoin,
} from './common/utils';
import { HasOneOptions } from './hasOne';
import {
  RelationKeysOptions,
  RelationRefsOptions,
  RelationThroughOptions,
} from './common/options';
import { defaultSchemaConfig } from 'pqb';

export interface HasMany extends RelationThunkBase {
  type: 'hasMany';
  options: HasManyOptions;
}

export type HasManyOptions<
  Columns extends ColumnsShapeBase = ColumnsShapeBase,
  Related extends TableClass = TableClass,
  Scope extends Query = Query,
  Through extends string = string,
  Source extends string = string,
> = HasOneOptions<Columns, Related, Scope, Through, Source>;

export type HasManyParams<
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

export interface HasManyInfo<
  T extends RelationConfigSelf,
  Name extends keyof T['relations'] & string,
  TableQuery extends Query,
  Populate extends PropertyKey = T['relations'][Name]['options'] extends RelationRefsOptions
    ? T['relations'][Name]['options']['references'][number]
    : T['relations'][Name]['options'] extends RelationKeysOptions
    ? T['relations'][Name]['options']['foreignKey']
    : never,
  Q extends Query = T['relations'][Name]['options'] extends RelationThroughOptions
    ? {
        [K in keyof TableQuery]: K extends 'meta'
          ? Omit<TableQuery['meta'], 'selectable'> & {
              as: Name;
              defaults: Record<Populate, true>;
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
              defaults: Record<Populate, true>;
              hasWhere: true;
              selectable: SelectableFromShape<TableQuery['shape'], Name>;
            }
          : K extends 'join'
          ? RelJoin
          : TableQuery[K];
      },
> {
  query: Q;
  methodQuery: Q;
  joinQuery: RelationJoinQuery;
  one: false;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: {
    [P in Name]?: T['relations'][Name]['options'] extends RelationThroughOptions
      ? EmptyObject
      : RelationToManyDataForCreate<{
          nestedCreateQuery: T['relations'][Name]['options'] extends RelationThroughOptions
            ? Q
            : AddQueryDefaults<Q, Record<Populate, true>>;
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
    create?: CreateData<
      T['relations'][Name]['options'] extends RelationThroughOptions
        ? Q
        : AddQueryDefaults<Q, Record<Populate, true>>
    >[];
  };

  params: HasManyParams<T, T['relations'][Name]>;
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

    type TableWithQueryMethod = Record<
      string,
      (params: RecordUnknown) => Query
    >;

    const throughRelation = getThroughRelation(table, through);
    const sourceRelation = getSourceRelation(throughRelation, source);
    const sourceRelationQuery = sourceRelation.query.as(relationName);
    const sourceQuery = sourceRelation.joinQuery(
      sourceRelationQuery,
      throughRelation.query,
    );

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
      returns: 'many',
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
    returns: 'many',
    method: (params: RecordUnknown) => {
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

const getWhereForNestedUpdate = (
  t: Query,
  data: RecordUnknown[],
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
            _queryUpdate(t.where(item.where) as never, obj as never),
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
