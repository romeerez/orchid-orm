import { ORMTableInput, TableClass } from '../baseTable';
import {
  _queryCreate,
  _queryDefaults,
  _queryDelete,
  _queryFindBy,
  _queryHookAfterUpdate,
  _queryHookBeforeUpdate,
  _queryRows,
  _queryUpdate,
  _queryWhere,
  CreateCtx,
  CreateData,
  CreateMethodsNames,
  DeleteMethodsNames,
  getQueryAs,
  isQueryReturnsAll,
  pushQueryOnForOuter,
  Query,
  SelectableFromShape,
  setQueryObjectValueImmutable,
  QueryTake,
  QueryTakeOptional,
  UpdateCtx,
  UpdateCtxCollect,
  UpdateData,
  VirtualColumn,
  WhereArg,
  TableData,
  defaultSchemaConfig,
  ColumnSchemaConfig,
  emptyArray,
  EmptyObject,
  getPrimaryKeys,
  QueryResult,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  ColumnsShape,
  Column,
  getFreeAlias,
  _with,
  RawSql,
  _orCreate,
} from 'pqb';
import {
  RelationConfigSelf,
  RelationData,
  RelationThunkBase,
  RelationToOneDataForCreateSameQuery,
} from './relations';
import {
  addAutoForeignKey,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  RelJoin,
  selectIfNotSelected,
} from './common/utils';
import { RelationRefsOptions } from './common/options';
import { joinQueryChainHOF } from './common/joinQueryChain';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  options: BelongsToOptions;
}

export interface BelongsToOptions<
  Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit,
  Related extends TableClass = TableClass,
> {
  required?: boolean;
  columns: (keyof Columns)[];
  references: (keyof InstanceType<Related>['columns']['shape'])[];
  foreignKey?: boolean | TableData.References.Options;
  on?: ColumnsShape.InputPartial<InstanceType<Related>['columns']['shape']>;
}

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
  returnsOne: true;
  query: Q;
  params: BelongsToParams<T, Rel>;
  maybeSingle: Required extends true ? QueryTake<Q> : QueryTakeOptional<Q>;
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
        create: CreateData<Q>;
      };
  // Only for records that update a single record:
  // - `upsert` to update or create the related record
  dataForUpdateOne:
    | { disconnect: boolean }
    | { set: WhereArg<Q> }
    | { delete: boolean }
    | { update: UpdateData<Q> }
    | { create: CreateData<Q> }
    | {
        upsert: {
          update: UpdateData<Q>;
          create: CreateData<Q> | (() => CreateData<Q>);
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
  private readonly nestedUpdate: BelongsToNestedUpdate;

  constructor(
    schema: ColumnSchemaConfig,
    private key: string,
    private state: State,
  ) {
    super(schema);
    this.nestedUpdate = nestedUpdate(this.state);
  }

  create(q: Query, ctx: CreateCtx, item: RecordUnknown) {
    const {
      key,
      state: { query, primaryKeys, foreignKeys },
    } = this;

    for (const key of foreignKeys) {
      if (!ctx.columns.has(key)) {
        ctx.columns.set(key, ctx.columns.size);
      }
    }

    const value = item[key] as NestedInsertOneItemCreate;
    if ('create' in value || 'connectOrCreate' in value) {
      foreignKeys.forEach((foreignKey) => (item[foreignKey] = new RawSql('')));

      const selectPKeys = query.select(...primaryKeys);

      _with(
        q,
        (as) => {
          foreignKeys.forEach((foreignKey, i) => {
            (
              item[foreignKey] as RawSql
            )._sql = `(SELECT "${as}"."${primaryKeys[i]}" FROM "${as}")`;
          });
        },
        'create' in value
          ? _queryCreate(selectPKeys, value.create as never)
          : _orCreate(
              _queryWhere(selectPKeys, [
                (value.connectOrCreate as { where: never }).where,
              ]),
              (value.connectOrCreate as { create: never }).create,
            ),
      );

      return;
    } else if ('connect' in value) {
      const as = getFreeAlias(q.q.withShapes, 'q');
      _with(q, as, query.select(...primaryKeys).findBy(value.connect));

      foreignKeys.map((foreignKey, i) => {
        const selectColumn = `(SELECT "${as}"."${primaryKeys[i]}" FROM "${as}")`;
        item[foreignKey] = new RawSql(
          i === 0
            ? `CASE WHEN (SELECT count(*) FROM "${as}") = 0 AND (SELECT 'not-found')::int = 0 THEN NULL ELSE ${selectColumn} END`
            : selectColumn,
        );
      });

      return;
    }
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
    joinQuery: joinQueryChainHOF(
      getPrimaryKeys(query),
      reverseJoin,
      (joiningQuery, baseQuery) =>
        join(
          baseQuery as Query,
          joiningQuery as Query,
          primaryKeys,
          foreignKeys,
        ),
    ),
    reverseJoin,
  };
};

const nestedUpdate = ({ query, primaryKeys, foreignKeys, len }: State) => {
  return ((q, update, params, state) => {
    if (params.upsert && isQueryReturnsAll(q)) {
      throw new Error('`upsert` option is not allowed in a batch update');
    }

    let idsForDelete: [unknown, ...unknown[]][] | undefined;

    _queryHookBeforeUpdate(q, async ({ query: q }) => {
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
          const record = (await _queryFindBy(
            query.select(...loadPrimaryKeys),
            params.set as never,
          )) as RecordUnknown;

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
        const selectQuery = (q as Query).clone();
        selectQuery.q.type = undefined;
        selectQuery.q.distinct = emptyArray;
        selectIfNotSelected(selectQuery, foreignKeys);
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
              upsert.update as UpdateData<Query>,
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
            data: collectData,
          };

          for (let i = 0; i < len; i++) {
            collectData[foreignKeys[i]] = result[primaryKeys[i]];
          }
        }
      });
    } else if (params.delete || params.update) {
      _queryHookAfterUpdate(
        q,
        params.update ? foreignKeys : emptyArray,
        async (data) => {
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
            await _queryUpdate(t, params.update as UpdateData<Query>);
          }
        },
      );
    }
  }) as BelongsToNestedUpdate;
};
