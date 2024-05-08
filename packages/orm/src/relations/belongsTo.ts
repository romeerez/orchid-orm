import { TableClass } from '../baseTable';
import {
  _queryCreate,
  _queryCreateMany,
  _queryDelete,
  _queryFindBy,
  _queryHookAfterUpdate,
  _queryHookBeforeUpdate,
  _queryRows,
  _queryUpdate,
  CreateCtx,
  CreateData,
  CreateMethodsNames,
  DeleteMethodsNames,
  InsertQueryData,
  isQueryReturnsAll,
  pushQueryOn,
  pushQueryValue,
  Query,
  QueryResult,
  RelationJoinQuery,
  SelectableFromShape,
  SelectQueryData,
  setQueryObjectValue,
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
  joinQueryChainingHOF,
  NestedInsertOneItem,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  relationWhere,
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
import {
  RelationCommonOptions,
  RelationKeysOptions,
  RelationRefsOptions,
  RelationRefsOrKeysOptions,
} from './common/options';
import { defaultSchemaConfig } from 'pqb';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  options: BelongsToOptions;
}

export type BelongsToOptions<
  Columns extends ColumnsShapeBase = ColumnsShapeBase,
  Related extends TableClass = TableClass,
  Scope extends Query = Query,
> = RelationCommonOptions<Related, Scope> &
  RelationRefsOrKeysOptions<
    keyof Columns,
    keyof InstanceType<Related>['columns']['shape'],
    keyof InstanceType<Related>['columns']['shape'],
    keyof Columns
  >;

export type BelongsToFKey<Relation extends RelationThunkBase> =
  Relation['options'] extends RelationRefsOptions
    ? Relation['options']['columns'][number]
    : Relation['options'] extends RelationKeysOptions
    ? Relation['options']['foreignKey']
    : never;

export type BelongsToParams<
  T extends RelationConfigSelf,
  Relation extends RelationThunkBase,
> = {
  [Name in BelongsToFKey<Relation>]: T['columns']['shape'][Name]['type'];
};

export interface BelongsToInfo<
  T extends RelationConfigSelf,
  Name extends keyof T['relations'] & string,
  TableQuery extends Query,
  FK extends string,
  Required,
  Q extends Query = {
    [P in keyof TableQuery]: P extends 'meta'
      ? // Omit is optimal
        Omit<TableQuery['meta'], 'selectable'> & {
          as: Name;
          hasWhere: true;
          selectable: SelectableFromShape<TableQuery['shape'], Name>;
        }
      : P extends 'join'
      ? RelJoin
      : P extends CreateMethodsNames | DeleteMethodsNames
      ? never
      : TableQuery[P];
  },
> {
  query: Q;
  methodQuery: Required extends true
    ? SetQueryReturnsOne<Q>
    : SetQueryReturnsOneOptional<Q>;
  joinQuery: RelationJoinQuery;
  one: true;
  omitForeignKeyInCreate: FK;
  dataForCreate: {
    columns: { [L in FK]: T['columns']['shape'][L]['inputType'] };
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
        create: CreateData<Q>;
      };
  // Only for records that updates a single record:
  // - `upsert` to update or create the related record
  dataForUpdateOne: {
    upsert: {
      update: UpdateData<Q>;
      create: CreateData<Q> | (() => CreateData<Q>);
    };
  };

  params: BelongsToParams<T, T['relations'][Name]>;
}

interface State {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
  len: number;
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

    pushQueryValue(q, 'beforeCreate', async (q: Query) => {
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
  relation: BelongsTo,
  relationName: string,
  query: Query,
): RelationData => {
  const primaryKeys = (
    'columns' in relation.options
      ? relation.options.references
      : [relation.options.primaryKey]
  ) as string[];

  const foreignKeys = (
    'columns' in relation.options
      ? relation.options.columns
      : [relation.options.foreignKey]
  ) as string[];

  const len = primaryKeys.length;
  const state: State = { query, primaryKeys, foreignKeys, len };
  const makeWhere = relationWhere(len, primaryKeys, foreignKeys);

  const join = (
    baseQuery: Query,
    joiningQuery: Query,
    primaryKeys: string[],
    foreignKeys: string[],
  ) => {
    const q = joiningQuery.clone();
    setQueryObjectValue(
      q,
      'joinedShapes',
      (baseQuery.q.as || baseQuery.table) as string,
      baseQuery.q.shape,
    );

    for (let i = 0; i < len; i++) {
      pushQueryOn(q, baseQuery, joiningQuery, primaryKeys[i], foreignKeys[i]);
    }

    return q;
  };

  const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
    return join(joiningQuery, baseQuery, foreignKeys, primaryKeys);
  };

  return {
    returns: 'one',
    method(params: RecordUnknown) {
      return query.where(makeWhere(params) as never);
    },
    virtualColumn: new BelongsToVirtualColumn(
      defaultSchemaConfig,
      relationName,
      state,
    ),
    joinQuery: joinQueryChainingHOF(reverseJoin, (joiningQuery, baseQuery) =>
      join(baseQuery, joiningQuery, primaryKeys, foreignKeys),
    ),
    reverseJoin,
  };
};

const nestedInsert = ({ query, primaryKeys }: State) => {
  return (async (_, data) => {
    const t = query.clone();

    // array to store specific items will be reused
    const items: NestedInsertOneItem[] = [];
    for (const item of data) {
      if (item.connectOrCreate) {
        items.push(item);
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

      created = await _queryCreateMany(
        t.select(...primaryKeys),
        items as never,
      );
    } else {
      created = emptyArray;
    }

    items.length = 0;
    for (const item of data) {
      if (item.connect) {
        items.push(item);
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
        const record = await _queryCreate(q, params.create);
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

        if (obj) {
          await _queryUpdate(
            query.findBy(obj as never),
            upsert.update as UpdateArg<Query>,
          );
        } else {
          const data =
            typeof upsert.create === 'function'
              ? upsert.create()
              : upsert.create;
          const result = await _queryCreate(query.select(...primaryKeys), data);

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
