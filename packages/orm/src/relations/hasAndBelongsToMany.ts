import {
  RelationConfigSelf,
  RelationData,
  RelationThunkBase,
} from './relations';
import { ORMTableInput, TableClass } from '../baseTable';
import {
  _queryCreateManyFrom,
  _queryCreateMany,
  _queryDefaults,
  _queryDelete,
  _queryFindBy,
  _queryFindByOptional,
  _queryHookAfterCreate,
  _queryJoinOn,
  _queryRows,
  _querySelect,
  _queryUpdate,
  _queryWhere,
  _queryWhereExists,
  CreateCtx,
  CreateData,
  getQueryAs,
  JoinedShapes,
  Query,
  SelectableFromShape,
  TableData,
  UpdateArg,
  UpdateCtx,
  UpdateData,
  VirtualColumn,
  WhereArg,
} from 'pqb';
import {
  ColumnSchemaConfig,
  ColumnShapeInputPartial,
  ColumnsShapeBase,
  ColumnTypeBase,
  getPrimaryKeys,
  MaybeArray,
  NotFoundError,
  objectHasValues,
  OrchidOrmInternalError,
  pick,
  RecordString,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  toArray,
  toSnakeCase,
} from 'orchid-core';
import {
  addAutoForeignKey,
  hasRelationHandleCreate,
  hasRelationHandleUpdate,
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
  RelJoin,
} from './common/utils';
import { HasManyNestedInsert, HasManyNestedUpdate } from './hasMany';
import { defaultSchemaConfig } from 'pqb';
import { joinQueryChainHOF } from './common/joinQueryChain';

export interface HasAndBelongsToMany extends RelationThunkBase {
  type: 'hasAndBelongsToMany';
  options: HasAndBelongsToManyOptions;
}

export interface HasAndBelongsToManyOptions<
  Columns extends ColumnsShapeBase = ColumnsShapeBase,
  Related extends TableClass = TableClass,
> {
  required?: boolean;
  columns: (keyof Columns)[];
  references: string[];
  foreignKey?: boolean | TableData.References.Options;
  through: {
    table: string;
    columns: string[];
    references: (keyof InstanceType<Related>['columns']['shape'])[];
    foreignKey?: boolean | TableData.References.Options;
  };
  on?: ColumnShapeInputPartial<InstanceType<Related>['columns']['shape']>;
}

export type HasAndBelongsToManyParams<
  T extends RelationConfigSelf,
  Relation extends HasAndBelongsToMany,
> = {
  [Name in Relation['options']['columns'][number]]: T['columns']['shape'][Name]['type'];
};

export type HasAndBelongsToManyQuery<
  Name extends string,
  TableQuery extends Query,
> = {
  [K in keyof TableQuery]: K extends 'meta'
    ? Omit<TableQuery['meta'], 'selectable'> & {
        as: Name;
        hasWhere: true;
        selectable: SelectableFromShape<TableQuery['shape'], Name>;
      }
    : K extends 'join'
    ? RelJoin
    : TableQuery[K];
};

export interface HasAndBelongsToManyInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends HasAndBelongsToMany,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: false;
  query: Q;
  params: HasAndBelongsToManyParams<T, Rel>;
  maybeSingle: Q;
  omitForeignKeyInCreate: never;
  optionalDataForCreate: {
    [P in Name]?: {
      // create related records
      create?: CreateData<Q>[];
      // find existing records by `where` conditions and update their foreign keys with the new id
      connect?: WhereArg<Q>[];
      // try finding records by `where` conditions, and create them if not found
      connectOrCreate?: {
        where: WhereArg<Q>;
        create: CreateData<Q>;
      }[];
    };
  };
  dataForCreate: never;
  // `hasAndBelongsToMany` relation data available for update. It supports:
  // - `disconnect` deletes join table records for related records found by conditions
  // - `set` creates join table records for related records found by conditions, deletes previous connects
  // - `add` creates join table records for related records found by conditions, does not delete previous connects
  // - `delete` deletes join table records and related records found by conditions
  // - `update` updates related records found by conditions with a provided data
  // - `create` creates related records and a join table records
  dataForUpdate: {
    disconnect?: MaybeArray<WhereArg<Q>>;
    set?: MaybeArray<WhereArg<Q>>;
    add?: MaybeArray<WhereArg<Q>>;
    delete?: MaybeArray<WhereArg<Q>>;
    update?: {
      where: MaybeArray<WhereArg<Q>>;
      data: UpdateData<Q>;
    };
    create?: CreateData<Q>[];
  };
  dataForUpdateOne: {
    disconnect?: MaybeArray<WhereArg<Q>>;
    set?: MaybeArray<WhereArg<Q>>;
    add?: MaybeArray<WhereArg<Q>>;
    delete?: MaybeArray<WhereArg<Q>>;
    update?: {
      where: MaybeArray<WhereArg<Q>>;
      data: UpdateData<Q>;
    };
    create?: CreateData<Q>[];
  };
}

interface State {
  relatedTableQuery: Query;
  joinTableQuery: Query;
  primaryKeys: string[];
  foreignKeys: string[];
  throughForeignKeys: string[];
  throughPrimaryKeys: string[];
  foreignKeysFull: string[];
  throughForeignKeysFull: string[];
  throughPrimaryKeysFull: string[];
  primaryKeysShape: ColumnsShapeBase;
  on?: RecordUnknown;
}

class HasAndBelongsToManyVirtualColumn extends VirtualColumn<ColumnSchemaConfig> {
  private readonly nestedInsert: HasManyNestedInsert;
  private readonly nestedUpdate: HasManyNestedUpdate;

  constructor(
    // is used to generate a migration for join table
    public joinTable: Query,
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
  tableConfig: ORMTableInput,
  table: Query,
  qb: Query,
  relation: HasAndBelongsToMany,
  relationName: string,
  query: Query,
): RelationData => {
  const { options } = relation;
  const { snakeCase } = table.internal;
  const primaryKeys = options.columns as string[];
  const foreignKeys = options.references;
  const originalForeignKeys = snakeCase ? [...foreignKeys] : foreignKeys;
  const joinTable = options.through.table;
  const throughForeignKeys = options.through.columns;
  const originalThroughForeignKeys = snakeCase
    ? [...throughForeignKeys]
    : throughForeignKeys;
  const throughPrimaryKeys = options.through.references as string[];
  const { on } = options;

  if (on) {
    _queryWhere(query, [on]);
    _queryDefaults(query, on);
  }

  const foreignKeysFull = foreignKeys.map((key, i) => {
    if (snakeCase) key = foreignKeys[i] = toSnakeCase(key);

    return `${joinTable}.${key}`;
  });

  const throughForeignKeysFull = throughForeignKeys.map((key, i) => {
    if (snakeCase) key = throughForeignKeys[i] = toSnakeCase(key);

    return `${joinTable}.${key}`;
  });

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
  const primaryKeysShape: ColumnsShapeBase = {};

  for (let i = 0; i < len; i++) {
    const pk = primaryKeys[i];

    shape[foreignKeys[i]] = removeColumnName(table.shape[pk] as ColumnTypeBase);

    primaryKeysShape[pk] = table.shape[pk] as ColumnTypeBase;
  }

  for (let i = 0; i < throughLen; i++) {
    shape[throughForeignKeys[i]] = removeColumnName(
      query.shape[throughPrimaryKeys[i]] as ColumnTypeBase,
    );
  }

  baseQuery.shape = shape;
  baseQuery.q = {
    ...baseQuery.q,
    shape: baseQuery.shape,
  };
  const subQuery = Object.create(baseQuery) as Query;

  addAutoForeignKey(
    tableConfig,
    subQuery,
    table,
    primaryKeys,
    foreignKeys,
    relation.options,
    originalForeignKeys,
  );

  addAutoForeignKey(
    tableConfig,
    subQuery,
    query,
    throughPrimaryKeys,
    throughForeignKeys,
    relation.options.through,
    originalThroughForeignKeys,
  );

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
    primaryKeysShape,
    on,
  };

  const joinQuery = (
    joiningQuery: Query,
    tableAs: string,
    foreignAs: string,
    joinedShapes: JoinedShapes,
  ) => {
    const cloned = joiningQuery.clone();
    cloned.q.joinedShapes = joinedShapes;
    return _queryWhereExists(cloned, subQuery, [
      (q) => {
        for (let i = 0; i < throughLen; i++) {
          _queryJoinOn(q, [
            throughForeignKeysFull[i],
            `${foreignAs}.${throughPrimaryKeys[i]}`,
          ]);
        }

        for (let i = 0; i < len; i++) {
          _queryJoinOn(q, [foreignKeysFull[i], `${tableAs}.${primaryKeys[i]}`]);
        }

        return q;
      },
    ]);
  };

  const obj: RecordString = {};
  for (let i = 0; i < len; i++) {
    obj[foreignKeys[i]] = primaryKeys[i];
  }
  const selectPrimaryKeysAsForeignKeys = [{ selectAs: obj }];

  const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
    const foreignAs = getQueryAs(joiningQuery as Query);
    return joinQuery(
      baseQuery as Query,
      getQueryAs(baseQuery as Query),
      foreignAs,
      {
        ...(baseQuery as Query).q.joinedShapes,
        [foreignAs]: (joiningQuery as Query).q.shape,
      },
    );
  };

  return {
    returns: 'many',
    queryRelated(params: RecordUnknown) {
      const q = query.whereExists(subQuery, (q) => {
        q = q.clone();

        const where: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          where[foreignKeysFull[i]] = params[primaryKeys[i]];
        }

        for (let i = 0; i < throughLen; i++) {
          _queryJoinOn(q, [
            throughForeignKeysFull[i],
            throughPrimaryKeysFull[i],
          ]);
        }

        return _queryWhere(q, [where as never]);
      });

      return on ? _queryDefaults(q, on) : q;
    },
    virtualColumn: new HasAndBelongsToManyVirtualColumn(
      subQuery,
      defaultSchemaConfig,
      relationName,
      state,
    ),
    joinQuery: joinQueryChainHOF(
      getPrimaryKeys(query),
      reverseJoin,
      (joiningQuery, baseQuery) =>
        joinQuery(
          joiningQuery as Query,
          getQueryAs(baseQuery as Query),
          getQueryAs(joiningQuery as Query),
          {
            ...(joiningQuery as Query).q.joinedShapes,
            [((baseQuery as Query).q.as ||
              (baseQuery as Query).table) as string]: (baseQuery as Query).q
              .shape,
          },
        ),
    ),
    reverseJoin,
    modifyRelatedQuery(relationQuery) {
      const ref = {} as { q: Query };

      _queryHookAfterCreate(
        relationQuery as Query,
        [],
        async (result: unknown[]) => {
          const baseQuery = ref.q.clone();
          baseQuery.q.select = selectPrimaryKeysAsForeignKeys;

          const data = result.map((resultRow) => {
            const dataRow: RecordUnknown = {};
            for (let i = 0; i < throughLen; i++) {
              dataRow[throughForeignKeys[i]] = (resultRow as RecordUnknown)[
                throughPrimaryKeys[i]
              ];
            }
            return dataRow;
          });

          const createdCount = await _queryCreateManyFrom(
            subQuery.count(),
            baseQuery as Query & { returnType: 'one' | 'oneOrThrow' },
            data,
          );

          if ((createdCount as unknown as number) === 0) {
            throw new NotFoundError(baseQuery);
          }
        },
      );

      return (q) => {
        ref.q = q as Query;
      };
    },
  };
};

const queryJoinTable = (
  state: State,
  data: RecordUnknown[],
  conditions?: MaybeArray<WhereArg<Query>>,
) => {
  const t = state.joinTableQuery.where({
    IN: {
      columns: state.foreignKeys,
      values: data.map((item) => state.primaryKeys.map((key) => item[key])),
    },
  });

  if (conditions) {
    _queryWhere(t, [
      {
        IN: {
          columns: state.throughForeignKeys,
          values: _querySelect(
            state.relatedTableQuery.where(conditionsToWhereArg(conditions)),
            state.throughPrimaryKeys,
          ),
        },
      },
    ]);
  }

  if (state.on) {
    _queryWhereExists(t, state.relatedTableQuery, [
      (q) => {
        for (let i = 0; i < state.throughPrimaryKeys.length; i++) {
          _queryJoinOn(q, [
            state.throughPrimaryKeysFull[i],
            state.throughForeignKeysFull[i],
          ]);
        }
        return q;
      },
    ]);
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
  data: RecordUnknown[],
  idsRows: unknown[][],
) => {
  const len = state.primaryKeys.length;
  const throughLen = state.throughPrimaryKeys.length;

  const records: RecordUnknown[] = [];
  for (const item of data) {
    const obj: RecordUnknown = {};
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

    let connected: RecordUnknown[];
    if (items.length) {
      const queries: Query[] = [];

      for (const [, { connect }] of items as [
        unknown,
        { connect: NestedInsertManyConnect },
      ][]) {
        for (const item of connect) {
          queries.push(
            _queryFindBy(
              t.select(...throughPrimaryKeys),
              item as never,
            ) as Query,
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

    let connectOrCreated: (RecordUnknown | undefined)[];
    if (items.length) {
      const queries: Query[] = [];

      for (const [, { connectOrCreate }] of items as [
        unknown,
        { connectOrCreate: NestedInsertManyConnectOrCreate },
      ][]) {
        for (const item of connectOrCreate) {
          queries.push(
            _queryFindByOptional(
              t.select(...throughPrimaryKeys),
              item.where as never,
            ) as Query,
          );
        }
      }

      connectOrCreated = (await Promise.all(queries)) as RecordUnknown[];
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
    let created: RecordUnknown[];
    if (items.length) {
      const records: RecordUnknown[] = [];

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

      created = (await _queryCreateMany(
        t.select(...throughPrimaryKeys),
        records,
      )) as never;
    } else {
      created = [];
    }

    const allKeys = data as unknown as [
      selfData: RecordUnknown,
      relationKeys: RecordUnknown[],
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
          const arr: RecordUnknown[] = [];
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

    const records: RecordUnknown[] = [];
    for (const [selfData, relationKeys] of allKeys) {
      const obj: RecordUnknown = {};
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

  return (async (query, data, params) => {
    if (params.create) {
      const idsRows: unknown[][] = await _queryCreateMany(
        _queryRows(state.relatedTableQuery.select(...state.throughPrimaryKeys)),
        params.create,
      );

      const records: RecordUnknown[] = [];
      for (const item of data) {
        const obj: RecordUnknown = {};
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
      await _queryUpdate(
        _queryWhere(
          state.relatedTableQuery.whereExists(state.joinTableQuery, (q) => {
            for (let i = 0; i < throughLen; i++) {
              _queryJoinOn(q, [
                state.throughForeignKeysFull[i],
                state.throughPrimaryKeysFull[i],
              ]);
            }

            return _queryWhere(q, [
              {
                IN: {
                  columns: state.foreignKeysFull,
                  values: data.map((item) =>
                    state.primaryKeys.map((key) => item[key]),
                  ),
                },
              },
            ]);
          }),
          [conditionsToWhereArg(params.update.where as WhereArg<Query>)],
        ),
        params.update.data as UpdateArg<Query>,
      );
    }

    /**
     * Performs `insertForEachFrom` on the joining table,
     * based on a query to the related table with applied filters of `params.connect`,
     * joins the main table data using `joinData`.
     */
    if (params.add) {
      const as = query.table as string;
      const relatedWheres = toArray(params.add);
      const joinTableColumns = [
        ...state.foreignKeys,
        ...state.throughForeignKeys,
      ];

      try {
        const count = await state.joinTableQuery
          .insertForEachFrom(
            _querySelect(
              state.relatedTableQuery.whereOneOf(...relatedWheres) as Query,
              [
                Object.fromEntries([
                  ...state.primaryKeys.map((key, i) => [
                    state.foreignKeys[i],
                    as + '.' + (state.primaryKeysShape[key].data.name || key),
                  ]),
                  ...state.throughForeignKeys.map((key, i) => [
                    key,
                    state.throughPrimaryKeys[i],
                  ]),
                ]),
              ],
            ).joinData(
              as,
              () =>
                Object.fromEntries(
                  state.primaryKeys.map((key) => [
                    key,
                    state.primaryKeysShape[key],
                  ]),
                ),
              data.map((x) => pick(x, state.primaryKeys)),
            ),
          )
          // do update on conflict to increase the resulting counter
          .onConflict(joinTableColumns)
          .merge([state.foreignKeys[0]]);

        if (count < data.length * relatedWheres.length) {
          throw new OrchidOrmInternalError(
            query,
            `Expected to find at least ${
              relatedWheres.length
            } record(s) based on \`add\` conditions, but found ${
              count / data.length
            }`,
          );
        }
      } catch (err) {
        if ((err as RecordUnknown).code === '42P10') {
          throw new OrchidOrmInternalError(
            query,
            `"${
              state.joinTableQuery.table
            }" must have a primary key or a unique index on columns (${joinTableColumns.join(
              ', ',
            )}) for this kind of query.`,
          );
        }
        throw err;
      }
    }

    if (params.disconnect) {
      await _queryDelete(
        queryJoinTable(state, data, params.disconnect as WhereArg<Query>),
      );
    }

    if (params.delete) {
      const j = queryJoinTable(state, data, params.delete as WhereArg<Query>);

      const idsRows = await _queryDelete(
        _queryRows(_querySelect(j, state.throughForeignKeys)),
      );

      await _queryDelete(
        state.relatedTableQuery.where({
          IN: {
            columns: state.throughPrimaryKeys,
            values: idsRows,
          },
        }),
      );
    }

    if (params.set) {
      const j = queryJoinTable(state, data);
      await _queryDelete(j);

      if (
        Array.isArray(params.set)
          ? params.set.length
          : objectHasValues(params.set)
      ) {
        const idsRows = await _queryRows(
          _querySelect(
            state.relatedTableQuery.where(
              conditionsToWhereArg(params.set as WhereArg<Query>),
            ),
            state.throughPrimaryKeys,
          ),
        );

        await insertToJoinTable(state, j, data, idsRows);
      }
    }
  }) as HasManyNestedUpdate;
};
