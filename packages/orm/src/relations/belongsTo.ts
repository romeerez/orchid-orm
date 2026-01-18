import { ORMTableInput } from '../baseTable';
import {
  _queryCreate,
  _queryDefaults,
  _queryDelete,
  _queryFindBy,
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
  UpdateData,
  VirtualColumn,
  WhereArg,
  TableData,
  defaultSchemaConfig,
  ColumnSchemaConfig,
  emptyArray,
  EmptyObject,
  getPrimaryKeys,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  ColumnsShape,
  Column,
  getFreeAlias,
  RawSql,
  _orCreate,
  QueryHasWhere,
  QueryManyTake,
  QueryManyTakeOptional,
  _appendQuery,
  _queryWhereIn,
  _queryUpsert,
  UpsertData,
  UpsertThis,
  _querySelect,
  _prependWith,
  noop,
} from 'pqb';
import {
  RelationConfigSelf,
  RelationData,
  RelationThunkBase,
  RelationToOneDataForCreateSameQuery,
} from './relations';
import {
  addAutoForeignKey,
  HasRelJoin,
  NestedInsertOneItemCreate,
  NestedUpdateOneItem,
  _selectIfNotSelected,
  selectCteColumnSql,
  selectCteColumnsSql,
} from './common/utils';
import { joinQueryChainHOF } from './common/joinQueryChain';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  options: BelongsToOptions;
}

export interface BelongsToOptions<
  Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit,
  Related extends ORMTableInput = ORMTableInput,
> {
  required?: boolean;
  columns: (keyof Columns)[];
  references: (keyof Related['columns']['shape'])[];
  foreignKey?: boolean | TableData.References.Options;
  on?: ColumnsShape.InputPartial<Related['columns']['shape']>;
}

export type BelongsToParams<T extends RelationConfigSelf, FK extends string> = {
  [Name in FK]: T['columns']['shape'][Name]['type'];
};

export type BelongsToQuery<T extends Query, Name extends string> = {
  [P in keyof T]: P extends '__selectable'
    ? SelectableFromShape<T['shape'], Name>
    : P extends '__as'
    ? Name
    : P extends CreateMethodsNames | DeleteMethodsNames
    ? never
    : T[P];
} & QueryHasWhere &
  HasRelJoin;

export interface BelongsToInfo<
  T extends RelationConfigSelf,
  Name extends string,
  FK extends string,
  Required,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: true;
  query: Q;
  params: BelongsToParams<T, FK>;
  maybeSingle: Required extends true
    ? QueryManyTake<Q>
    : QueryManyTakeOptional<Q>;
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
      const asFn = setForeignKeysFromCte(item, primaryKeys, foreignKeys);

      const selectPKeys = query.select(...primaryKeys);

      _prependWith(
        q,
        asFn,
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
      _prependWith(q, as, query.select(...primaryKeys).findBy(value.connect));

      foreignKeys.map((foreignKey, i) => {
        item[foreignKey] = new RawSql(
          selectCteColumnMustExistSql(i, as, primaryKeys[i]),
        );
      });

      return;
    }
  }

  update(q: Query, set: RecordUnknown) {
    q.q.wrapInTransaction = true;

    const data = set[this.key] as NestedUpdateOneItem;
    this.nestedUpdate(q, set, data);
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
  return ((self, update, params) => {
    if (params.create) {
      const createQuery = _querySelect(
        _queryCreate(query.clone(), params.create),
        primaryKeys,
      );

      const asFn = setForeignKeysFromCte(update, primaryKeys, foreignKeys);

      _prependWith(self, asFn, createQuery);
    } else if (params.update) {
      _selectIfNotSelected(self, foreignKeys);

      const selectIdsSql = new RawSql('');

      const updateQuery = _queryUpdate(
        _queryWhereIn(query.clone(), true, primaryKeys, selectIdsSql),
        params.update as UpdateData<Query>,
      );

      // don't throw "not found" if it is not found for update
      updateQuery.q.returnType = 'value';

      _appendQuery(self, updateQuery, (as) => {
        selectIdsSql._sql = selectCteColumnsSql(as, foreignKeys);
      });
    } else if (params.upsert) {
      if (isQueryReturnsAll(self)) {
        throw new Error('`upsert` option is not allowed in a batch update');
      }

      const { relQuery } = relWithSelectIds(
        self,
        query,
        primaryKeys,
        foreignKeys,
      );

      const upsertQuery = _querySelect(
        _queryUpsert(
          relQuery,
          params.upsert as UpsertData<UpsertThis, UpdateData<Query>>,
        ),
        primaryKeys,
      );

      const asFn = setForeignKeysFromCte(update, primaryKeys, foreignKeys);

      _prependWith(self, asFn, upsertQuery);
    } else if (params.delete) {
      _selectIfNotSelected(self, foreignKeys);

      disconnect(update, foreignKeys);

      const { selectIdsSql, relQuery } = relWithSelectIds(
        self,
        query,
        primaryKeys,
        foreignKeys,
      );

      self.q.and = self.q.or = undefined;

      _queryWhereIn(self, true, foreignKeys, selectIdsSql);

      const deleteQuery = _queryDelete(relQuery);
      // don't throw "not found" if it is not found for delete
      deleteQuery.q.returnType = 'value';

      _appendQuery(self, deleteQuery, noop);
    } else if (params.disconnect) {
      disconnect(update, foreignKeys);
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
        const asFn = setForeignKeysFromCte(
          update,
          loadPrimaryKeys,
          loadForeignKeys as string[],
          true,
        );

        _prependWith(
          self,
          asFn,
          _queryFindBy(query.select(...loadPrimaryKeys), params.set as never),
        );
      }
    }
  }) as BelongsToNestedUpdate;
};

const disconnect = (update: RecordUnknown, foreignKeys: string[]) => {
  for (const foreignKey of foreignKeys) {
    update[foreignKey] = null;
  }
};

const relWithSelectIds = (
  self: Query,
  rel: Query,
  primaryKeys: string[],
  foreignKeys: string[],
) => {
  const selectIdsQuery = makeSelectIdsQuery(self, foreignKeys);

  const selectIdsSql = new RawSql('');

  _prependWith(
    self,
    (as) => {
      selectIdsSql._sql = selectCteColumnsSql(as, foreignKeys);
    },
    selectIdsQuery,
  );

  return {
    selectIdsSql,
    relQuery: _queryWhereIn(rel.clone(), true, primaryKeys, selectIdsSql),
  };
};

const makeSelectIdsQuery = (self: Query, foreignKeys: string[]) => {
  const selectIdsQuery = self.baseQuery.clone();
  selectIdsQuery.q.distinct = emptyArray;
  selectIdsQuery.q.select = foreignKeys;
  selectIdsQuery.q.and = self.q.and;
  selectIdsQuery.q.or = self.q.or;
  return selectIdsQuery;
};

const setForeignKeysFromCte = (
  record: RecordUnknown,
  primaryKeys: string[],
  foreignKeys: string[],
  mustExist?: boolean,
) => {
  for (const key of foreignKeys) {
    record[key] = new RawSql('');
  }

  return (as: string) => {
    foreignKeys.forEach(
      mustExist
        ? (foreignKey, i) => {
            (record[foreignKey] as RawSql)._sql = selectCteColumnMustExistSql(
              i,
              as,
              primaryKeys[i],
            );
          }
        : (foreignKey, i) => {
            (record[foreignKey] as RawSql)._sql = selectCteColumnSql(
              as,
              primaryKeys[i],
            );
          },
    );
  };
};

const selectCteColumnMustExistSql = (
  i: number,
  cteAs: string,
  column: string,
) => {
  const selectColumn = selectCteColumnSql(cteAs, column);

  return i === 0
    ? `CASE WHEN (SELECT count(*) FROM "${cteAs}") = 0 AND (SELECT 'not-found')::int = 0 THEN NULL ELSE ${selectColumn} END`
    : selectColumn;
};
