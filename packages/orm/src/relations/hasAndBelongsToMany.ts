import {
  RelationData,
  RelationThunkBase,
  RelationToManyDataForCreate,
} from './relations';
import { DbTable, Table, TableClass } from '../baseTable';
import {
  CreateCtx,
  CreateData,
  getQueryAs,
  NotFoundError,
  OrchidOrmInternalError,
  Query,
  QueryWithTable,
  SetQueryTableAlias,
  toSQLCacheKey,
  UpdateCtx,
  UpdateData,
  VirtualColumn,
  WhereArg,
  WhereResult,
} from 'pqb';
import {
  ColumnsShapeBase,
  ColumnTypeBase,
  EmptyObject,
  MaybeArray,
} from 'orchid-core';
import {
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
} from './common/utils';
import { HasManyNestedInsert, HasManyNestedUpdate } from './hasMany';
import { RelationCommonOptions } from './common/options';

export type HasAndBelongsToMany = RelationThunkBase & {
  type: 'hasAndBelongsToMany';
  options: HasAndBelongsToManyOptions;
};

export type HasAndBelongsToManyOptions<
  Self extends Table = Table,
  Related extends TableClass = TableClass,
  Scope extends Query = Query,
> = RelationCommonOptions<Related, Scope> &
  (
    | {
        columns: (keyof Self['columns'])[];
        references: string[];
        through: {
          table: string;
          columns: string[];
          references: (keyof InstanceType<Related>['columns'])[];
        };
      }
    | {
        primaryKey: keyof Self['columns'];
        foreignKey: string;
        joinTable: string;
        associationPrimaryKey: string;
        associationForeignKey: keyof InstanceType<Related>['columns'];
      }
  );

export type HasAndBelongsToManyInfo<
  T extends Table,
  Relation extends HasAndBelongsToMany,
  K extends string,
  TC extends TableClass = ReturnType<Relation['fn']>,
  Q extends QueryWithTable = SetQueryTableAlias<DbTable<TC>, K>,
> = {
  table: Q;
  query: Q;
  joinQuery(fromQuery: Query, toQuery: Query): Query;
  one: false;
  required: Relation['options']['required'] extends true ? true : false;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: {
    [P in K]?: RelationToManyDataForCreate<{
      nestedCreateQuery: Q;
      table: Q;
    }>;
  };
  // `hasAndBelongsToMany` relation data available for update. It supports:
  // - `disconnect` to delete join table records for related records found by conditions
  // - `set` to create join table records for related records found by conditions
  // - `delete` to delete join table records and related records found by conditions
  // - `update` to update related records found by conditions with a provided data
  // - `create` to create related records and a join table records
  dataForUpdate: {
    disconnect?: MaybeArray<WhereArg<Q>>;
    set?: MaybeArray<WhereArg<Q>>;
    delete?: MaybeArray<WhereArg<Q>>;
    update?: {
      where: MaybeArray<WhereArg<Q>>;
      data: UpdateData<Q>;
    };
    create?: CreateData<Q>[];
  };
  dataForUpdateOne: EmptyObject;

  params: Relation['options'] extends { columns: string[] }
    ? {
        [K in Relation['options']['columns'][number]]: T['columns'][K]['type'];
      }
    : Relation['options'] extends { primaryKey: string }
    ? Record<
        Relation['options']['primaryKey'],
        T['columns'][Relation['options']['primaryKey']]['type']
      >
    : never;
  populate: EmptyObject;
  chainedCreate: true;
  chainedDelete: true;
};

type State = {
  relatedTableQuery: Query;
  joinTableQuery: Query;
  primaryKeys: string[];
  foreignKeys: string[];
  throughForeignKeys: string[];
  throughPrimaryKeys: string[];
  foreignKeysFull: string[];
  throughForeignKeysFull: string[];
  throughPrimaryKeysFull: string[];
};

class HasAndBelongsToManyVirtualColumn extends VirtualColumn {
  private readonly nestedInsert: HasManyNestedInsert;
  private readonly nestedUpdate: HasManyNestedUpdate;

  constructor(private key: string, private state: State) {
    super();
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
    hasRelationHandleUpdate(
      q,
      set,
      this.key,
      this.state.primaryKeys,
      this.nestedUpdate,
    );
  }
}

const removeColumnName = (column: ColumnTypeBase) => {
  if (!column.data.name) return column;

  const cloned = Object.create(column);
  cloned.data = { ...column.data, name: undefined };
  return cloned;
};

export const makeHasAndBelongsToManyMethod = (
  table: Query,
  qb: Query,
  relation: HasAndBelongsToMany,
  relationName: string,
  query: Query,
): RelationData => {
  let primaryKeys: string[];
  let foreignKeys: string[];
  let joinTable: string;
  let throughForeignKeys: string[];
  let throughPrimaryKeys: string[];

  const { options } = relation;
  if ('columns' in options) {
    primaryKeys = options.columns;
    foreignKeys = options.references;
    joinTable = options.through.table;
    throughForeignKeys = options.through.columns;
    throughPrimaryKeys = options.through.references;
  } else {
    primaryKeys = [options.primaryKey];
    foreignKeys = [options.foreignKey];
    joinTable = options.joinTable;
    throughForeignKeys = [options.associationForeignKey];
    throughPrimaryKeys = [options.associationPrimaryKey];
  }

  const foreignKeysFull = foreignKeys.map((key) => `${joinTable}.${key}`);
  const throughForeignKeysFull = throughForeignKeys.map(
    (key) => `${joinTable}.${key}`,
  );

  const foreignTable = getQueryAs(query);
  const throughPrimaryKeysFull = throughPrimaryKeys.map(
    (key) => `${foreignTable}.${key}`,
  );

  const len = primaryKeys.length;
  const throughLen = throughPrimaryKeys.length;

  const baseQuery = Object.create(qb.baseQuery);
  baseQuery.baseQuery = baseQuery;
  baseQuery.table = joinTable;

  const shape: ColumnsShapeBase = {};
  for (let i = 0; i < len; i++) {
    shape[foreignKeys[i]] = removeColumnName(table.shape[primaryKeys[i]]);
  }
  for (let i = 0; i < throughLen; i++) {
    shape[throughForeignKeys[i]] = removeColumnName(
      query.shape[throughPrimaryKeys[i]],
    );
  }

  baseQuery.shape = shape;
  baseQuery.q = {
    ...baseQuery.q,
    shape: baseQuery.shape,
  };
  const subQuery = Object.create(baseQuery);

  const state: State = {
    relatedTableQuery: query,
    joinTableQuery: subQuery,
    primaryKeys,
    foreignKeys,
    throughForeignKeys,
    throughPrimaryKeys,
    foreignKeysFull,
    throughForeignKeysFull,
    throughPrimaryKeysFull,
  };

  const joinQuery = (toQuery: Query, tableAs: string, foreignAs: string) => {
    return toQuery.whereExists(subQuery, (q) => {
      for (let i = 0; i < throughLen; i++) {
        q._on(
          throughForeignKeysFull[i],
          `${foreignAs}.${throughPrimaryKeys[i]}`,
        );
      }

      for (let i = 0; i < len; i++) {
        q._on(foreignKeysFull[i], `${tableAs}.${primaryKeys[i]}`);
      }

      return q;
    });
  };

  const obj: Record<string, string> = {};
  for (let i = 0; i < len; i++) {
    obj[foreignKeys[i]] = primaryKeys[i];
  }
  const selectPrimaryKeysAsForeignKeys = [{ selectAs: obj }];

  return {
    returns: 'many',
    method(params: Record<string, unknown>) {
      return query.whereExists(subQuery, (q) => {
        q = q.clone();

        const where: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          where[foreignKeysFull[i]] = params[primaryKeys[i]];
        }

        for (let i = 0; i < throughLen; i++) {
          q._on(throughForeignKeysFull[i], throughPrimaryKeysFull[i]);
        }

        return q._where(where);
      });
    },
    virtualColumn: new HasAndBelongsToManyVirtualColumn(relationName, state),
    // joinQuery can be a property of RelationQuery and be used by whereExists and other stuff which needs it
    // and the chained query itself may be a query around this joinQuery
    joinQuery(fromQuery, toQuery) {
      const join = joinQuery(
        toQuery,
        getQueryAs(fromQuery),
        getQueryAs(toQuery),
      );

      join.q.joinedShapes = {
        ...join.q.joinedShapes,
        [(fromQuery.q.as || fromQuery.table) as string]: fromQuery.q.shape,
      };

      return join;
    },
    reverseJoin(fromQuery, toQuery) {
      return joinQuery(fromQuery, getQueryAs(fromQuery), getQueryAs(toQuery));
    },
    modifyRelatedQuery(relationQuery) {
      const ref = {} as { q: Query };

      relationQuery._afterCreate([], async (result: unknown[]) => {
        if (result.length > 1) {
          // TODO: currently this relies on `INSERT ... SELECT` that works only for 1 record
          // consider using `WITH` to reuse id of main table for multiple related ids
          throw new OrchidOrmInternalError(
            relationQuery,
            'Creating multiple `hasAndBelongsToMany` records is not yet supported',
          );
        }

        const fromQuery = ref.q.clone();
        fromQuery.q.select = selectPrimaryKeysAsForeignKeys;

        const data: Record<string, unknown> = {};
        for (let i = 0; i < throughLen; i++) {
          data[throughForeignKeys[i]] = (result[0] as Record<string, unknown>)[
            throughPrimaryKeys[i]
          ];
        }

        const createdCount = await subQuery
          .count()
          ._createFrom(fromQuery, data);

        if (createdCount === 0) {
          throw new NotFoundError(fromQuery);
        }
      });

      return (q) => {
        ref.q = q;
      };
    },
  };
};

const queryJoinTable = (
  state: State,
  data: Record<string, unknown>[],
  conditions?: MaybeArray<WhereArg<Query>>,
) => {
  const t = state.joinTableQuery.where({
    IN: {
      columns: state.foreignKeys,
      values: data.map((item) => state.primaryKeys.map((key) => item[key])),
    },
  });

  if (conditions) {
    t._where({
      IN: {
        columns: state.throughForeignKeys,
        values: state.relatedTableQuery
          .where(conditionsToWhereArg(conditions))
          ._select(...state.throughPrimaryKeys),
      },
    });
  }

  return t;
};

const conditionsToWhereArg = (
  conditions: MaybeArray<WhereArg<Query>>,
): WhereArg<Query> =>
  Array.isArray(conditions) ? { OR: conditions } : conditions;

const insertToJoinTable = (
  state: State,
  joinTableTransaction: Query,
  data: Record<string, unknown>[],
  idsRows: unknown[][],
) => {
  const len = state.primaryKeys.length;
  const throughLen = state.throughPrimaryKeys.length;

  const records: Record<string, unknown>[] = [];
  for (const item of data) {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < len; i++) {
      obj[state.foreignKeys[i]] = item[state.primaryKeys[i]];
    }

    for (const ids of idsRows) {
      const record = { ...obj };
      for (let i = 0; i < throughLen; i++) {
        record[state.throughForeignKeys[i]] = ids[i];
      }
      records.push(record);
    }
  }

  return joinTableTransaction.insertMany(records);
};

const nestedInsert = ({
  relatedTableQuery,
  joinTableQuery,
  primaryKeys,
  foreignKeys,
  throughPrimaryKeys,
  throughForeignKeys,
}: State) => {
  const len = primaryKeys.length;
  const throughLen = primaryKeys.length;

  return (async (_, data) => {
    const t = relatedTableQuery.clone();

    // array to store specific items will be reused
    const items: unknown[] = [];
    for (const item of data) {
      if (item[1].connect) {
        items.push(item);
      }
    }

    let connected: Record<string, unknown>[];
    if (items.length) {
      const queries: Query[] = [];

      for (const [, { connect }] of items as [
        unknown,
        { connect: NestedInsertManyConnect },
      ][]) {
        for (const item of connect) {
          queries.push(
            t
              .select(...throughPrimaryKeys)
              ._findBy(item)
              ._take(),
          );
        }
      }

      connected = (await Promise.all(queries)) as Record<string, unknown[]>[];
    } else {
      connected = [];
    }

    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        items.push(item);
      }
    }

    let connectOrCreated: (Record<string, unknown> | undefined)[];
    if (items.length) {
      const queries: Query[] = [];

      for (const [, { connectOrCreate }] of items as [
        unknown,
        { connectOrCreate: NestedInsertManyConnectOrCreate },
      ][]) {
        for (const item of connectOrCreate) {
          queries.push(
            t
              .select(...throughPrimaryKeys)
              ._findBy(item.where)
              ._takeOptional(),
          );
        }
      }

      connectOrCreated = (await Promise.all(queries)) as Record<
        string,
        unknown
      >[];
    } else {
      connectOrCreated = [];
    }

    let connectOrCreateI = 0;
    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        const length = item[1].connectOrCreate.length;
        connectOrCreateI += length;
        for (let i = length; i > 0; i--) {
          if (!connectOrCreated[connectOrCreateI - i]) {
            items.push(item);
            break;
          }
        }
      } else if (item[1].create) {
        items.push(item);
      }
    }

    connectOrCreateI = 0;
    let created: Record<string, unknown>[];
    if (items.length) {
      const records: Record<string, unknown>[] = [];

      for (const [, { create, connectOrCreate }] of items as [
        unknown,
        NestedInsertManyItems,
      ][]) {
        if (create) {
          records.push(...create);
        }

        if (connectOrCreate) {
          for (const item of connectOrCreate) {
            if (!connectOrCreated[connectOrCreateI++]) {
              records.push(item.create);
            }
          }
        }
      }

      created = (await t
        .select(...throughPrimaryKeys)
        ._createMany(records)) as Record<string, unknown>[];
    } else {
      created = [];
    }

    const allKeys = data as unknown as [
      selfData: Record<string, unknown>,
      relationKeys: Record<string, unknown>[],
    ][];

    let createI = 0;
    let connectI = 0;
    connectOrCreateI = 0;
    for (let index = 0, len = data.length; index < len; index++) {
      const item = data[index][1] as NestedInsertManyItems;

      if (item.create || item.connectOrCreate) {
        if (item.create) {
          const len = item.create.length;
          allKeys[index][1] = created.slice(createI, createI + len);
          createI += len;
        }
        if (item.connectOrCreate) {
          const arr: Record<string, unknown>[] = [];
          allKeys[index][1] = arr;

          const len = item.connectOrCreate.length;
          for (let i = 0; i < len; i++) {
            const item = connectOrCreated[connectOrCreateI++];
            if (item) {
              arr.push(item);
            } else {
              arr.push(created[createI++]);
            }
          }
        }
      }

      if (item.connect) {
        const len = item.connect.length;
        allKeys[index][1] = connected.slice(connectI, connectI + len);
        connectI += len;
      }
    }

    const records: Record<string, unknown>[] = [];
    for (const [selfData, relationKeys] of allKeys) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = selfData[primaryKeys[i]];
      }

      for (const relationData of relationKeys) {
        const record = { ...obj };

        for (let i = 0; i < throughLen; i++) {
          record[throughForeignKeys[i]] = relationData[throughPrimaryKeys[i]];
        }

        records.push(record);
      }
    }

    await joinTableQuery.insertMany(records);
  }) as HasManyNestedInsert;
};

const nestedUpdate = (state: State) => {
  const len = state.primaryKeys.length;
  const throughLen = state.throughPrimaryKeys.length;

  return (async (_, data, params) => {
    if (params.create) {
      const idsRows: unknown[][] = await state.relatedTableQuery
        .select(...state.throughPrimaryKeys)
        ._rows()
        ._createMany(params.create);

      const records: Record<string, unknown>[] = [];
      for (const item of data) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          obj[state.foreignKeys[i]] = item[state.primaryKeys[i]];
        }

        for (const ids of idsRows) {
          const record = { ...obj };

          for (let i = 0; i < throughLen; i++) {
            record[state.throughForeignKeys[i]] = ids[i];
          }

          records.push(record);
        }
      }

      await state.joinTableQuery.createMany(records);
    }

    if (params.update) {
      await state.relatedTableQuery
        .whereExists(state.joinTableQuery, (q) => {
          for (let i = 0; i < throughLen; i++) {
            q._on(
              state.throughForeignKeysFull[i],
              state.throughPrimaryKeysFull[i],
            );
          }

          return q._where({
            IN: {
              columns: state.foreignKeysFull,
              values: data.map((item) =>
                state.primaryKeys.map((key) => item[key]),
              ),
            },
          });
        })
        ._where(conditionsToWhereArg(params.update.where))
        ._update<WhereResult<Query>>(params.update.data);
    }

    if (params.disconnect) {
      await queryJoinTable(state, data, params.disconnect)._delete();
    }

    if (params.delete) {
      const j = queryJoinTable(state, data, params.delete);

      const idsRows = await j
        ._select(...state.throughForeignKeys)
        ._rows()
        ._delete();

      await state.relatedTableQuery
        .where({
          IN: {
            columns: state.throughPrimaryKeys,
            values: idsRows,
          },
        })
        ._delete();
    }

    if (params.set) {
      const j = queryJoinTable(state, data);
      await j._delete();
      delete j.q[toSQLCacheKey];

      const idsRows = await state.relatedTableQuery
        .where(conditionsToWhereArg(params.set))
        ._select(...state.throughPrimaryKeys)
        ._rows();

      await insertToJoinTable(state, j, data, idsRows);
    }
  }) as HasManyNestedUpdate;
};
