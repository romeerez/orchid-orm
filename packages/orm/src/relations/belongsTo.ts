import { ORMTableInput, TableClass } from '../baseTable';
import {
  _queryCreate,
  _queryCreateMany,
  _queryDefaults,
  _queryDelete,
  _queryFindBy,
  _queryHookAfterUpdate,
  _queryHookBeforeUpdate,
  _queryRows,
  _queryUpdate,
  _queryWhere,
  CreateBelongsToData,
  CreateCtx,
  CreateData,
  CreateMethodsNames,
  DeleteMethodsNames,
  getQueryAs,
  InsertQueryData,
  isQueryReturnsAll,
  pushQueryOnForOuter,
  pushQueryValueImmutable,
  Query,
  QueryResult,
  RelationConfigBase,
  RelationJoinQuery,
  SelectableFromShape,
  SelectQueryData,
  setQueryObjectValueImmutable,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
  UpdateArg,
  UpdateCtx,
  UpdateCtxCollect,
  UpdateData,
  VirtualColumn,
  WhereArg,
} from 'pqb';
import {
  RelationConfigSelf,
  RelationData,
  RelationThunkBase,
  RelationToOneDataForCreateSameQuery,
} from './relations';
import {
  addAutoForeignKey,
  joinQueryChainingHOF,
  NestedInsertOneItem,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  RelJoin,
  selectIfNotSelected,
} from './common/utils';
import {
  ColumnSchemaConfig,
  ColumnsShapeBase,
  emptyArray,
  EmptyObject,
  RecordUnknown,
} from 'orchid-core';
import { RelationRefsOptions } from './common/options';
import { defaultSchemaConfig } from 'pqb';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  options: BelongsToOptions;
}

export type BelongsToOptions<
  Columns extends ColumnsShapeBase = ColumnsShapeBase,
  Related extends TableClass = TableClass,
> = RelationRefsOptions<
  keyof Columns,
  InstanceType<Related>['columns']['shape']
>;

export type BelongsToFKey<Relation extends RelationThunkBase> =
  Relation['options'] extends RelationRefsOptions
    ? Relation['options']['columns'][number]
    : never;

export type BelongsToParams<
  T extends RelationConfigSelf,
  Relation extends BelongsTo,
> = {
  [Name in BelongsToFKey<Relation>]: T['columns']['shape'][Name]['type'];
};

export type BelongsToQuery<T extends Query, Name extends string> = {
  [P in keyof T]: P extends 'meta'
    ? // Omit is optimal
      Omit<T['meta'], 'selectable'> & {
        as: Name;
        hasWhere: true;
        selectable: SelectableFromShape<T['shape'], Name>;
      }
    : P extends 'join'
    ? RelJoin
    : P extends CreateMethodsNames | DeleteMethodsNames
    ? never
    : T[P];
};

export interface BelongsToInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends BelongsTo,
  FK extends string,
  Required,
  Q extends Query,
> extends RelationConfigBase {
  query: Q;
  params: BelongsToParams<T, Rel>;
  maybeSingle: Required extends true
    ? SetQueryReturnsOne<Q>
    : SetQueryReturnsOneOptional<Q>;
  omitForeignKeyInCreate: FK;
  dataForCreate: {
    columns: FK;
    nested: Required extends true
      ? {
          [Key in Name]: RelationToOneDataForCreateSameQuery<Q>;
        }
      : {
          [Key in Name]?: RelationToOneDataForCreateSameQuery<Q>;
        };
  };
  optionalDataForCreate: EmptyObject;
  // `belongsTo` relation data available for update. It supports:
  // - `disconnect` to nullify a foreign key for the relation
  // - `set` to update the foreign key with a relation primary key found by conditions
  // - `delete` to delete the related record, nullify the foreign key
  // - `update` to update the related record
  // - `create` to create the related record
  dataForUpdate:
    | { disconnect: boolean }
    | { set: WhereArg<Q> }
    | { delete: boolean }
    | { update: UpdateData<Q> }
    | {
        create: CreateData<Q, CreateBelongsToData<Q>>;
      };
  // Only for records that update a single record:
  // - `upsert` to update or create the related record
  dataForUpdateOne:
    | { disconnect: boolean }
    | { set: WhereArg<Q> }
    | { delete: boolean }
    | { update: UpdateData<Q> }
    | { create: CreateData<Q, CreateBelongsToData<Q>> }
    | {
        upsert: {
          update: UpdateData<Q>;
          create:
            | CreateData<Q, CreateBelongsToData<Q>>
            | (() => CreateData<Q, CreateBelongsToData<Q>>);
        };
      };
}

interface State {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
  len: number;
  on?: RecordUnknown;
}

type BelongsToNestedInsert = (
  query: Query,
  relationData: NestedInsertOneItem[],
) => Promise<RecordUnknown[]>;

type BelongsToNestedUpdate = (
  q: Query,
  update: RecordUnknown,
  params: NestedUpdateOneItem,
  state: {
    queries?: ((queryResult: QueryResult) => Promise<void>)[];
    collect?: UpdateCtxCollect;
  },
) => void;

class BelongsToVirtualColumn extends VirtualColumn<ColumnSchemaConfig> {
  private readonly nestedInsert: BelongsToNestedInsert;
  private readonly nestedUpdate: BelongsToNestedUpdate;

  constructor(
    schema: ColumnSchemaConfig,
    private key: string,
    private state: State,
  ) {
    super(schema);
    this.nestedInsert = nestedInsert(this.state);
    this.nestedUpdate = nestedUpdate(this.state);
  }

  create(q: Query, ctx: CreateCtx, item: RecordUnknown, rowIndex: number) {
    const {
      key,
      state: { primaryKeys, foreignKeys },
    } = this;

    const columnIndexes = foreignKeys.map((key) => {
      let index = ctx.columns.get(key);
      if (index === undefined) {
        ctx.columns.set(key, (index = ctx.columns.size));
      }
      return index;
    });

    const store = ctx as unknown as {
      belongsTo?: Record<string, [number, number[], unknown][]>;
    };

    if (!store.belongsTo) store.belongsTo = {};

    const values = [rowIndex, columnIndexes, item[key]] as [
      number,
      number[],
      unknown,
    ];

    if (store.belongsTo[key]) {
      store.belongsTo[key].push(values);
      return;
    }

    const relationData = [values];
    store.belongsTo[key] = relationData;
    q.q.wrapInTransaction = true;

    pushQueryValueImmutable(q, 'beforeCreate', async (q: Query) => {
      const inserted = await this.nestedInsert(
        q,
        relationData.map(([, , data]) => data as NestedInsertOneItem),
      );

      const { values } = q.q as InsertQueryData;
      for (let i = 0, len = relationData.length; i < len; i++) {
        const [rowIndex, columnIndexes] = relationData[i];
        const row = (values as unknown[][])[rowIndex];

        for (let c = 0, len = columnIndexes.length; c < len; c++) {
          row[columnIndexes[c]] = inserted[i][primaryKeys[c]];
        }
      }
    });
  }

  update(q: Query, ctx: UpdateCtx, set: RecordUnknown) {
    q.q.wrapInTransaction = true;

    const data = set[this.key] as NestedUpdateOneItem;
    this.nestedUpdate(q, set, data, ctx);
  }
}

export const makeBelongsToMethod = (
  tableConfig: ORMTableInput,
  table: Query,
  relation: BelongsTo,
  relationName: string,
  query: Query,
): RelationData => {
  const primaryKeys = relation.options.references as string[];
  const foreignKeys = relation.options.columns as string[];
  const { on } = relation.options;

  if (on) {
    _queryWhere(query, [on]);
    _queryDefaults(query, on);
  }

  const len = primaryKeys.length;
  const state: State = { query, primaryKeys, foreignKeys, len, on };

  addAutoForeignKey(
    tableConfig,
    table,
    query,
    primaryKeys,
    foreignKeys,
    relation.options,
  );

  const join = (
    baseQuery: Query,
    joiningQuery: Query,
    primaryKeys: string[],
    foreignKeys: string[],
  ) => {
    const baseAs = getQueryAs(baseQuery);

    const q = joiningQuery.clone();
    setQueryObjectValueImmutable(q, 'joinedShapes', baseAs, baseQuery.q.shape);

    for (let i = 0; i < len; i++) {
      pushQueryOnForOuter(
        q,
        baseQuery,
        joiningQuery,
        primaryKeys[i],
        `${baseAs}.${foreignKeys[i]}`,
      );
    }

    return q;
  };

  const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
    return join(
      joiningQuery as Query,
      baseQuery as Query,
      foreignKeys,
      primaryKeys,
    );
  };

  return {
    returns: 'one',
    queryRelated(params: RecordUnknown) {
      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[primaryKeys[i]] = params[foreignKeys[i]];
      }
      return query.where(obj as never);
    },
    virtualColumn: new BelongsToVirtualColumn(
      defaultSchemaConfig,
      relationName,
      state,
    ),
    joinQuery: joinQueryChainingHOF(reverseJoin, (joiningQuery, baseQuery) =>
      join(baseQuery as Query, joiningQuery as Query, primaryKeys, foreignKeys),
    ),
    reverseJoin,
  };
};

const nestedInsert = ({ query, primaryKeys, on }: State) => {
  return (async (_, data) => {
    const t = query.clone();

    // array to store specific items will be reused
    const items: NestedInsertOneItem[] = [];
    for (const item of data) {
      if (item.connectOrCreate) {
        items.push(
          on
            ? {
                ...item,
                connectOrCreate: {
                  ...item.connectOrCreate,
                  where: { ...item.connectOrCreate.where, ...on },
                },
              }
            : item,
        );
      }
    }

    let connectOrCreated: unknown[];
    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        items[i] = t.findByOptional(
          (items[i].connectOrCreate as NestedInsertOneItemConnectOrCreate)
            .where as never,
        ) as never;
      }

      connectOrCreated = await Promise.all(items);
    } else {
      connectOrCreated = emptyArray;
    }

    let connectOrCreatedI = 0;
    items.length = 0;
    for (const item of data) {
      if (item.connectOrCreate) {
        if (!connectOrCreated[connectOrCreatedI++]) items.push(item);
      } else if (item.create) {
        items.push(item);
      }
    }

    let created: unknown[];
    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        items[i] =
          'create' in items[i]
            ? (items[i].create as NestedInsertOneItemCreate)
            : (items[i].connectOrCreate as NestedInsertOneItemConnectOrCreate)
                .create;
      }

      created = (await _queryCreateMany(
        t.select(...primaryKeys),
        items as never,
      )) as never;
    } else {
      created = emptyArray;
    }

    items.length = 0;
    for (const item of data) {
      if (item.connect) {
        items.push(
          on ? { ...item, connect: { ...item.connect, ...on } } : item,
        );
      }
    }

    let connected: unknown[];
    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        items[i] = t.findBy(items[i].connect as WhereArg<Query>) as never;
      }

      connected = await Promise.all(items);
    } else {
      connected = emptyArray;
    }

    let createdI = 0;
    let connectedI = 0;
    connectOrCreatedI = 0;
    return data.map((item) => {
      return item.connectOrCreate
        ? connectOrCreated[connectOrCreatedI++] || created[createdI++]
        : item.connect
        ? connected[connectedI++]
        : created[createdI++];
    }) as RecordUnknown[];
  }) as BelongsToNestedInsert;
};

const nestedUpdate = ({ query, primaryKeys, foreignKeys, len }: State) => {
  return ((q, update, params, state) => {
    if (params.upsert && isQueryReturnsAll(q)) {
      throw new Error('`upsert` option is not allowed in a batch update');
    }

    let idsForDelete: [unknown, ...unknown[]][] | undefined;

    _queryHookBeforeUpdate(q, async (q) => {
      if (params.disconnect) {
        for (const key of foreignKeys) {
          update[key] = null;
        }
      } else if (params.set) {
        let loadPrimaryKeys: string[] | undefined;
        let loadForeignKeys: string[] | undefined;
        for (let i = 0; i < len; i++) {
          const primaryKey = primaryKeys[i];
          if (primaryKey in params.set) {
            update[foreignKeys[i]] =
              params.set[primaryKey as keyof typeof params.set];
          } else {
            (loadPrimaryKeys ??= []).push(primaryKey);
            (loadForeignKeys ??= []).push(foreignKeys[i]);
          }
        }
        if (loadPrimaryKeys) {
          const record = (await _queryFindBy(query.select(...loadPrimaryKeys), [
            params.set as never,
          ])) as RecordUnknown;

          for (let i = 0, len = loadPrimaryKeys.length; i < len; i++) {
            update[(loadForeignKeys as string[])[i]] =
              record[loadPrimaryKeys[i]];
          }
        }
      } else if (params.create) {
        const q = query.clone();
        q.q.select = primaryKeys;
        const record = (await _queryCreate(
          q,
          params.create,
        )) as unknown as RecordUnknown;
        for (let i = 0; i < len; i++) {
          update[foreignKeys[i]] = record[primaryKeys[i]];
        }
      } else if (params.delete) {
        const selectQuery = q.clone();
        selectQuery.q.type = undefined;
        (selectQuery.q as SelectQueryData).distinct = emptyArray;
        idsForDelete = (await _queryRows(selectQuery)) as [
          unknown,
          ...unknown[],
        ][];
        for (const foreignKey of foreignKeys) {
          update[foreignKey] = null;
        }
      }
    });

    const { upsert } = params;
    if (upsert || params.update || params.delete) {
      selectIfNotSelected(q, foreignKeys);
    }

    if (upsert) {
      (state.queries ??= []).push(async (queryResult) => {
        const row = queryResult.rows[0];
        let obj: RecordUnknown | undefined = {};
        for (let i = 0; i < len; i++) {
          const id = row[foreignKeys[i]];
          if (id === null) {
            obj = undefined;
            break;
          }

          obj[primaryKeys[i]] = id;
        }

        const count = obj
          ? await _queryUpdate(
              query.findBy(obj as never),
              upsert.update as UpdateArg<Query>,
            )
          : 0;

        if (!count) {
          const data =
            typeof upsert.create === 'function'
              ? upsert.create()
              : upsert.create;

          const result = (await _queryCreate(
            query.select(...primaryKeys),
            data,
          )) as unknown as RecordUnknown;

          const collectData: RecordUnknown = {};
          state.collect = {
            keys: primaryKeys,
            data: collectData,
          };

          for (let i = 0; i < len; i++) {
            collectData[foreignKeys[i]] = result[primaryKeys[i]];
          }
        }
      });
    } else if (params.delete || params.update) {
      _queryHookAfterUpdate(q, [], async (data) => {
        let ids: [unknown, ...unknown[]][] | undefined;

        if (params.delete) {
          ids = idsForDelete;
        } else {
          ids = [];
          for (const item of data) {
            let row: unknown[] | undefined;
            for (const foreignKey of foreignKeys) {
              const id = (item as RecordUnknown)[foreignKey];
              if (id === null) {
                row = undefined;
                break;
              } else {
                (row ??= []).push(id);
              }
            }
            if (row) ids.push(row as [unknown, ...unknown[]]);
          }
        }

        if (!ids?.length) return;

        const t = query.whereIn(
          primaryKeys as [string, ...string[]],
          ids as [unknown, ...unknown[]][],
        );

        if (params.delete) {
          await _queryDelete(t);
        } else {
          await _queryUpdate(t, params.update as UpdateArg<Query>);
        }
      });
    }
  }) as BelongsToNestedUpdate;
};
