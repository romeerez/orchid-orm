import { DbTable, Table, TableClass } from '../baseTable';
import {
  CreateCtx,
  CreateData,
  InsertQueryData,
  isQueryReturnsAll,
  pushQueryOn,
  pushQueryValue,
  Query,
  QueryResult,
  QueryWithTable,
  SelectQueryData,
  setQueryObjectValue,
  SetQueryTableAlias,
  UpdateCtx,
  UpdateData,
  VirtualColumn,
  WhereArg,
  WhereResult,
} from 'pqb';
import {
  RelationData,
  RelationThunkBase,
  RelationToOneDataForCreate,
} from './relations';
import {
  NestedInsertOneItem,
  NestedInsertOneItemConnect,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  relationWhere,
  selectIfNotSelected,
} from './common/utils';
import { emptyArray, EmptyObject } from 'orchid-core';
import {
  RelationCommonOptions,
  RelationKeysOptions,
  RelationRefsOptions,
  RelationRefsOrKeysOptions,
} from './common/options';

export type BelongsTo = RelationThunkBase & {
  type: 'belongsTo';
  options: BelongsToOptions;
};

export type BelongsToOptions<
  Self extends Table = Table,
  Related extends TableClass = TableClass,
  Scope extends Query = Query,
> = RelationCommonOptions<Related, Scope> &
  RelationRefsOrKeysOptions<
    keyof Self['columns'],
    keyof InstanceType<Related>['columns'],
    keyof InstanceType<Related>['columns'],
    keyof Self['columns']
  >;

export type BelongsToInfo<
  T extends Table,
  Relation extends BelongsTo,
  K extends string,
  FK extends string = Relation['options'] extends RelationRefsOptions
    ? Relation['options']['columns'][number]
    : Relation['options'] extends RelationKeysOptions
    ? Relation['options']['foreignKey']
    : never,
  Q extends QueryWithTable = SetQueryTableAlias<
    DbTable<ReturnType<Relation['fn']>>,
    K
  >,
  DataForCreate = RelationToOneDataForCreate<{
    nestedCreateQuery: Q;
    table: Q;
  }>,
  Required = Relation['options']['required'] extends true ? true : false,
> = {
  table: Q;
  query: Q;
  joinQuery(fromQuery: Query, toQuery: Query): Query;
  one: true;
  required: Required;
  omitForeignKeyInCreate: FK;
  dataForCreate: {
    columns: { [L in FK]: T['columns'][L]['inputType'] };
    nested: Required extends true
      ? { [Key in K]: DataForCreate }
      : { [Key in K]?: DataForCreate };
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

  params: { [K in FK]: T['columns'][FK]['type'] };
  populate: never;
  chainedCreate: false;
  chainedDelete: false;
};

type State = {
  query: Query;
  primaryKeys: string[];
  foreignKeys: string[];
  len: number;
};

type BelongsToNestedInsert = (
  query: Query,
  relationData: NestedInsertOneItem[],
) => Promise<Record<string, unknown>[]>;

type BelongsToNestedUpdate = (
  q: Query,
  update: Record<string, unknown>,
  params: NestedUpdateOneItem,
  state: {
    queries?: ((queryResult: QueryResult) => Promise<void>)[];
    updateData?: Record<string, unknown>;
  },
) => void;

class BelongsToVirtualColumn extends VirtualColumn {
  private readonly nestedInsert: BelongsToNestedInsert;
  private readonly nestedUpdate: BelongsToNestedUpdate;

  constructor(private key: string, private state: State) {
    super();
    this.nestedInsert = nestedInsert(this.state);
    this.nestedUpdate = nestedUpdate(this.state);
  }

  create(
    q: Query,
    ctx: CreateCtx,
    item: Record<string, unknown>,
    rowIndex: number,
  ) {
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

  update(q: Query, ctx: UpdateCtx, set: Record<string, unknown>) {
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
  const primaryKeys =
    'columns' in relation.options
      ? relation.options.references
      : [relation.options.primaryKey];

  const foreignKeys =
    'columns' in relation.options
      ? relation.options.columns
      : [relation.options.foreignKey];

  const len = primaryKeys.length;
  const state: State = { query, primaryKeys, foreignKeys, len };
  const makeWhere = relationWhere(len, primaryKeys, foreignKeys);

  const join = (
    fromQuery: Query,
    toQuery: Query,
    primaryKeys: string[],
    foreignKeys: string[],
  ) => {
    const q = toQuery.clone();
    setQueryObjectValue(
      q,
      'joinedShapes',
      (fromQuery.q.as || fromQuery.table) as string,
      fromQuery.q.shape,
    );

    for (let i = 0; i < len; i++) {
      pushQueryOn(q, fromQuery, toQuery, primaryKeys[i], foreignKeys[i]);
    }

    return q;
  };

  return {
    returns: 'one',
    method(params: Record<string, unknown>) {
      return query.where(makeWhere(params));
    },
    virtualColumn: new BelongsToVirtualColumn(relationName, state),
    joinQuery(fromQuery, toQuery) {
      return join(fromQuery, toQuery, primaryKeys, foreignKeys);
    },
    reverseJoin(fromQuery, toQuery) {
      return join(toQuery, fromQuery, foreignKeys, primaryKeys);
    },
  };
};

const nestedInsert = ({ query, primaryKeys }: State) => {
  return (async (_, data) => {
    const t = query.clone();

    // array to store specific items will be reused
    const items: Record<string, unknown>[] = [];
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
            .where,
        );
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

      created = await t.select(...primaryKeys)._createMany(items);
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
        items[i] = t.findBy(items[i].connect as NestedInsertOneItemConnect);
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
    }) as Record<string, unknown>[];
  }) as BelongsToNestedInsert;
};

const nestedUpdate = ({ query, primaryKeys, foreignKeys, len }: State) => {
  return ((q, update, params, state) => {
    if (params.upsert && isQueryReturnsAll(q)) {
      throw new Error('`upsert` option is not allowed in a batch update');
    }

    let idsForDelete: [unknown, ...unknown[]][] | undefined;

    q._beforeUpdate(async (q) => {
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
          const record = await query
            .select(...loadPrimaryKeys)
            ._findBy(params.set);

          for (let i = 0, len = loadPrimaryKeys.length; i < len; i++) {
            update[(loadForeignKeys as string[])[i]] =
              record[loadPrimaryKeys[i]];
          }
        }
      } else if (params.create) {
        const q = query.clone();
        q.q.select = primaryKeys;
        const record = await q._create(params.create);
        for (let i = 0; i < len; i++) {
          update[foreignKeys[i]] = record[primaryKeys[i]];
        }
      } else if (params.delete) {
        const selectQuery = q.clone();
        selectQuery.q.type = undefined;
        (selectQuery.q as SelectQueryData).distinct = emptyArray;
        idsForDelete = (await selectQuery._rows()) as [unknown, ...unknown[]][];
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
        let obj: Record<string, unknown> | undefined = {};
        for (let i = 0; i < len; i++) {
          const id = row[foreignKeys[i]];
          if (id === null) {
            obj = undefined;
            break;
          }

          obj[primaryKeys[i]] = id;
        }

        if (obj) {
          await query.findBy(obj)._update<WhereResult<Query>>(upsert.update);
        } else {
          const data =
            typeof upsert.create === 'function'
              ? upsert.create()
              : upsert.create;
          const result = await query.select(...primaryKeys)._create(data);

          for (let i = 0; i < len; i++) {
            (state.updateData ??= {})[foreignKeys[i]] = result[primaryKeys[i]];
          }
        }
      });
    } else if (params.delete || params.update) {
      q._afterUpdate([], async (data) => {
        let ids: [unknown, ...unknown[]][] | undefined;

        if (params.delete) {
          ids = idsForDelete;
        } else {
          ids = [];
          for (const item of data) {
            let row: unknown[] | undefined;
            for (const foreignKey of foreignKeys) {
              const id = (item as Record<string, unknown>)[foreignKey];
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
          await t._delete();
        } else {
          await t._update<WhereResult<Query>>(
            params.update as UpdateData<Query>,
          );
        }
      });
    }
  }) as BelongsToNestedUpdate;
};
