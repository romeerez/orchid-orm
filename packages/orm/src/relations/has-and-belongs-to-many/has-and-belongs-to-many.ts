import {
  RelationConfigSelf,
  RelationData,
  RelationThunkBase,
} from '../relations';
import { NotFoundError, Query } from 'pqb';
import { ORMTableInput } from '../../orm-table/legacy-table';
import {
  _queryCreateManyFrom,
  _queryDefaults,
  _queryHookAfterCreate,
  _queryJoinOn,
  _queryWhere,
  _queryWhereExists,
  CreateCtx,
  CreateData,
  getQueryAs,
  JoinedShapes,
  SelectableFromShape,
  TableData,
  UpdateData,
  VirtualColumn,
  WhereArg,
  ColumnSchemaConfig,
  ColumnsShape,
  getPrimaryKeys,
  MaybeArray,
  RecordString,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  toSnakeCase,
  Column,
  CreateSelf,
  toArray,
  RawSql,
  QueryHasWhere,
  QuerySchema,
  internalSchemaConfig,
  UpdateSelf,
} from 'pqb/internal';
import {
  addAutoForeignKey,
  NestedUpdateManyItems,
  NestedUpdateManyUpdate,
  throwIfQueryReturnsAllForNestedUpdate,
} from '../common/utils';
import { HasManyNestedInsert } from '../has-many/has-many.create';
import { joinQueryChainHOF } from '../common/joinQueryChain';
import {
  hasAndBelongsToManyCreate,
  nestedInsert,
} from './has-and-belongs-to-many.create';
import {
  nestedUpdateAdd,
  nestedUpdateCreate,
  nestedUpdateDelete,
  nestedUpdateDisconnect,
  nestedUpdateSet,
  nestedUpdateUpdate,
  nestedUpdateUpsert,
} from './has-and-belongs-to-many.update';

export interface HasAndBelongsToMany extends RelationThunkBase {
  type: 'hasAndBelongsToMany';
  options: HasAndBelongsToManyOptions;
}

export interface HasAndBelongsToManyOptions<
  Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit,
  Related extends ORMTableInput = ORMTableInput,
> {
  required?: boolean;
  columns: (keyof Columns)[];
  references: string[];
  foreignKey?: boolean | TableData.References.Options;
  through: {
    schema?: QuerySchema;
    table: string;
    snakeCase?: boolean;
    columns: string[];
    references: (keyof Related['columns']['shape'])[];
    foreignKey?: boolean | TableData.References.Options;
  };
  on?: ColumnsShape.InputPartial<Related['columns']['shape']>;
}

export type HasAndBelongsToManyParams<
  T extends RelationConfigSelf,
  FK extends string,
> = {
  [Name in FK]: T['columns']['shape'][Name]['__type'];
};

export type HasAndBelongsToManyQuery<
  Name extends string,
  TableQuery extends Query,
> = {
  [K in keyof TableQuery]: K extends '__selectable'
    ? SelectableFromShape<TableQuery['shape'], Name>
    : K extends '__as'
      ? Name
      : TableQuery[K];
} & QueryHasWhere;

export interface HasAndBelongsToManyInfo<
  T extends RelationConfigSelf,
  Name extends string,
  FK extends string,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: false;
  query: Q;
  params: HasAndBelongsToManyParams<T, FK>;
  omitForeignKeyInCreate: never;
  dataForCreate: {
    [K in Name]?: Q extends Query.Pick.IsNotReadOnly
      ? {
          // create related records
          create?: CreateData<Q>[];
          // find existing records by `where` conditions and update their foreign keys with the new id
          connect?: WhereArg<Q>[];
          // try finding records by `where` conditions, and create them if not found
          connectOrCreate?: {
            where: WhereArg<Q>;
            create: CreateData<Q>;
          }[];
          upsert?: MaybeArray<{
            findBy: Q['internal']['uniqueColumns'];
            update: UpdateData<Q>;
            create?: CreateData<Q> | (() => CreateData<Q>);
          }>;
        }
      : {
          // find existing records by `where` conditions and update their foreign keys with the new id
          connect?: WhereArg<Q>[];
        };
  };
  // `hasAndBelongsToMany` relation data available for update. It supports:
  // - `disconnect` deletes join table records for related records found by conditions
  // - `set` creates join table records for related records found by conditions, deletes previous connects
  // - `add` creates join table records for related records found by conditions, does not delete previous connects
  // - `delete` deletes join table records and related records found by conditions
  // - `update` updates related records found by conditions with a provided data
  // - `create` creates related records and a join table records
  dataForUpdate: Q extends Query.Pick.IsNotReadOnly
    ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: MaybeArray<{
          where: MaybeArray<WhereArg<Q>>;
          data: UpdateData<Q>;
        }>;
        create?: CreateData<Q>[];
      }
    : {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
      };
  dataForUpdateOne: Q extends Query.Pick.IsNotReadOnly
    ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: MaybeArray<{
          where: MaybeArray<WhereArg<Q>>;
          data: UpdateData<Q>;
        }>;
        create?: CreateData<Q>[];
        upsert?: MaybeArray<{
          findBy: Q['internal']['uniqueColumns'];
          update: UpdateData<Q>;
          create?: CreateData<Q> | (() => CreateData<Q>);
        }>;
      }
    : {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
      };
}

export interface State {
  queryBuilder: Query.NotReadOnlyQuery;
  relatedTableQuery: Query.NotReadOnlyQuery;
  joinTableQuery: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  throughForeignKeys: string[];
  throughPrimaryKeys: string[];
  foreignKeysFull: string[];
  throughForeignKeysFull: string[];
  throughPrimaryKeysFull: string[];
  primaryKeysShape: Column.Shape.Data;
  on?: RecordUnknown;
}

interface QueryReturnsOne extends Query {
  returnType: 'one' | 'oneOrThrow';
}

class HasAndBelongsToManyVirtualColumn extends VirtualColumn<ColumnSchemaConfig> {
  private readonly nestedInsert: HasManyNestedInsert;

  constructor(
    // is used to generate a migration for join table
    public joinTable: Query,
    schema: ColumnSchemaConfig,
    private key: string,
    private state: State,
  ) {
    super(schema);
    this.nestedInsert = nestedInsert(state);
  }

  create(
    self: CreateSelf,
    ctx: CreateCtx,
    items: RecordUnknown[],
    rowIndexes: number[],
    count: number,
  ) {
    hasAndBelongsToManyCreate(
      this.key,
      this.state,
      this.nestedInsert,
      self,
      ctx,
      items,
      rowIndexes,
      count,
    );
  }

  update(q: UpdateSelf, set: RecordUnknown) {
    const querySelf = q as unknown as Query;
    const params = set[this.key] as NestedUpdateManyItems;
    const hasUpdate =
      !!params.update &&
      toArray(params.update).some(
        (update) => !Array.isArray(update.where) || update.where.length,
      );
    const hasAdd =
      params.add && (!Array.isArray(params.add) || params.add.length > 0);
    const addedAs = hasUpdate && hasAdd ? new RawSql('') : undefined;
    const setAs = hasUpdate && params.set ? new RawSql('') : undefined;
    const sourceCondition = addedAs || setAs ? new RawSql('') : undefined;
    const updateFrom = sourceCondition ? new RawSql('') : undefined;

    const setSourceCondition = () => {
      if (!sourceCondition) return;

      const relatedAs =
        this.state.relatedTableQuery.q.as || this.state.relatedTableQuery.table;
      const joinCondition = (as: string) =>
        this.state.throughPrimaryKeys
          .map(
            (key, i) =>
              `"${relatedAs}"."${(this.state.relatedTableQuery.shape as ColumnsShape)[key].data.name || key}" = ${as}."${this.state.throughForeignKeys[i]}"`,
          )
          .join(' AND ');
      const sourceAs = '"relatedIds"';
      sourceCondition._sql = joinCondition(sourceAs);
      const columns = this.state.throughForeignKeys;
      const sourceColumns = columns.map((key) => `"${key}"`).join(', ');
      updateFrom!._sql = `(${[addedAs, setAs]
        .filter((as): as is RawSql => !!as && !!as._sql)
        .map((as) => `SELECT ${sourceColumns} FROM ${as._sql}`)
        .concat()
        .join(' UNION ALL ')}) AS ${sourceAs}`;
    };

    if (params.add) {
      nestedUpdateAdd(querySelf, this.state, params.add, (as) => {
        if (addedAs) {
          addedAs._sql = `"${as}"`;
          setSourceCondition();
        }
      });
      set[this.key] = { ...params, add: undefined };
    }

    if (params.create?.length) {
      nestedUpdateCreate(querySelf, this.state, params.create);
      set[this.key] = { ...params, create: undefined };
    }

    if (
      params.disconnect &&
      (!Array.isArray(params.disconnect) || params.disconnect.length > 0)
    ) {
      nestedUpdateDisconnect(querySelf, this.state, params.disconnect);
      set[this.key] = { ...params, disconnect: undefined };
    }

    if (
      params.delete &&
      (!Array.isArray(params.delete) || params.delete.length)
    ) {
      nestedUpdateDelete(querySelf, this.state, params.delete);
      set[this.key] = { ...params, delete: undefined };
    }

    if (params.set) {
      nestedUpdateSet(querySelf, this.state, params.set, (as) => {
        if (setAs) {
          setAs._sql = `"${as}"`;
          setSourceCondition();
        }
      });
      set[this.key] = { ...params, set: undefined };
    }

    if (
      !!params.upsert &&
      (!Array.isArray(params.upsert) || params.upsert.length > 0)
    ) {
      throwIfQueryReturnsAllForNestedUpdate(querySelf, {
        upsert: params.upsert,
      });
      nestedUpdateUpsert(
        querySelf,
        this.state,
        params.upsert,
        undefined,
        hasAdd || params.set ? updateFrom : undefined,
        hasAdd || params.set ? sourceCondition : undefined,
        params.disconnect,
        params.set,
      );
    }

    if (hasUpdate) {
      nestedUpdateUpdate(
        querySelf,
        this.state,
        params.update as NestedUpdateManyUpdate,
        updateFrom,
        sourceCondition,
        params.disconnect,
        params.set,
      );
      set[this.key] = { ...params, update: undefined };
    }
  }
}

const removeColumnName = (column: Column.Pick.Data) => {
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
  schema?: QuerySchema,
): RelationData => {
  const { options } = relation;
  const { snakeCase } = table.internal;
  const primaryKeys = options.columns as string[];
  const originalForeignKeys = options.references;
  const foreignKeys = snakeCase
    ? [...originalForeignKeys]
    : originalForeignKeys;
  const joinTableSnakeCase = snakeCase && options.through.snakeCase !== false;
  const joinTable = joinTableSnakeCase
    ? toSnakeCase(options.through.table)
    : options.through.table;
  const originalThroughForeignKeys = options.through.columns;
  const throughForeignKeys = snakeCase
    ? [...originalThroughForeignKeys]
    : originalThroughForeignKeys;
  const throughPrimaryKeys = options.through.references as string[];
  const { on } = options;

  if (on) {
    _queryWhere(query, [on]);
    _queryDefaults(query as unknown as CreateSelf, on);
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

  const shape: Column.Shape.Data = {};
  const primaryKeysShape: Column.Shape.Data = {};

  for (let i = 0; i < len; i++) {
    const pk = primaryKeys[i];

    shape[foreignKeys[i]] = removeColumnName(
      table.shape[pk] as unknown as Column.Pick.Data,
    );

    primaryKeysShape[pk] = table.shape[pk] as unknown as Column.Pick.Data;
  }

  for (let i = 0; i < throughLen; i++) {
    shape[throughForeignKeys[i]] = removeColumnName(
      query.shape[throughPrimaryKeys[i]] as unknown as Column.Pick.Data,
    );
  }

  baseQuery.shape = shape;
  baseQuery.q = {
    ...baseQuery.q,
    schema: options.through.schema || schema,
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
    queryBuilder: qb as Query.NotReadOnlyQuery,
    relatedTableQuery: query as Query.NotReadOnlyQuery,
    joinTableQuery: subQuery as Query.NotReadOnlyQuery,
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
        [foreignAs]: (joiningQuery as Query).q.selectShape,
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

      return on
        ? (_queryDefaults(q as unknown as CreateSelf, on) as unknown as Query)
        : q;
    },
    virtualColumn: new HasAndBelongsToManyVirtualColumn(
      subQuery,
      internalSchemaConfig,
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
              .selectShape,
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
            subQuery.count() as unknown as CreateSelf,
            baseQuery as QueryReturnsOne,
            data as never,
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
