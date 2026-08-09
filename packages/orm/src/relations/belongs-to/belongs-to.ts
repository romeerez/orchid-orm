import { ORMTableInput } from '../../orm-table/legacy-table';
import { Query } from 'pqb';
import {
  _queryDefaults,
  _queryWhere,
  CreateData,
  CreateSelf,
  CreateMethodsNames,
  DeleteMethodsNames,
  getQueryAs,
  pushQueryOnForOuter,
  SelectableFromShape,
  setQueryObjectValueImmutable,
  UpdateData,
  UpdateSelf,
  VirtualColumn,
  WhereArg,
  TableData,
  ColumnSchemaConfig,
  getPrimaryKeys,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  ColumnsShape,
  Column,
  QueryHasWhere,
  internalSchemaConfig,
  CreateCtx,
} from 'pqb/internal';
import {
  RelationConfigSelf,
  RelationData,
  RelationThunkBase,
} from '../relations';
import { addAutoForeignKey, NestedUpdateOneItem } from '../common/utils';
import { joinQueryChainHOF } from '../common/joinQueryChain';
import { BelongsToDataForCreate, belongsToCreate } from './belongs-to.create';
import { nestedUpdate, BelongsToNestedUpdate } from './belongs-to.update';

export { type BelongsToDataForCreate };

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
  [Name in FK]: T['columns']['shape'][Name]['__type'];
};

export type BelongsToDefaultRequired<
  T extends RelationConfigSelf,
  Rel extends BelongsTo,
  Related,
> = Related extends { softDelete: true }
  ? false
  : BelongsToDefaultRequiredFromColumns<T, Rel>;

type BelongsToDefaultRequiredFromColumns<
  T extends RelationConfigSelf,
  Rel extends BelongsTo,
> =
  BelongsToColumnRequired<
    T['columns']['shape'][Rel['options']['columns'][number] & string]
  > extends true
    ? true
    : false;

type BelongsToColumnRequired<Column> = Column extends {
  data: { isNullable: true };
}
  ? false
  : true;

export type BelongsToQuery<T extends Query, Name extends string> = {
  [P in keyof T]: P extends '__selectable'
    ? SelectableFromShape<T['shape'], Name>
    : P extends '__as'
      ? Name
      : P extends CreateMethodsNames | DeleteMethodsNames
        ? never
        : T[P];
} & QueryHasWhere;

export interface BelongsToInfo<
  T extends RelationConfigSelf,
  FK extends string,
  Required,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: true;
  required: Required;
  query: Q;
  params: BelongsToParams<T, FK>;
  omitForeignKeyInCreate: FK;
  // `belongsTo` relation data available for update. It supports:
  // - `disconnect` to nullify a foreign key for the relation
  // - `set` to update the foreign key with a relation primary key found by conditions
  // - `delete` to delete the related record, nullify the foreign key
  // - `update` to update the related record
  // - `create` to create the related record
  dataForUpdate:
    | { disconnect: boolean }
    | { set: WhereArg<Q> }
    | (Q extends Query.Pick.IsNotReadOnly
        ?
            | { delete: boolean }
            | { update: UpdateData<Q> }
            | {
                create: CreateData<Q>;
              }
        : never);
  // Only for records that update a single record:
  // - `upsert` to update or create the related record
  dataForUpdateOne:
    | { disconnect: boolean }
    | { set: WhereArg<Q> }
    | (Q extends Query.Pick.IsNotReadOnly
        ?
            | { delete: boolean }
            | { update: UpdateData<Q> }
            | { create: CreateData<Q> }
            | {
                upsert: {
                  update: UpdateData<Q>;
                  create: CreateData<Q> | (() => CreateData<Q>);
                };
              }
        : never);
}

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  len: number;
  on?: RecordUnknown;
}

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

  create(q: CreateSelf, ctx: CreateCtx, items: RecordUnknown[]) {
    belongsToCreate(this.key, this.state, q, ctx, items);
  }

  update(q: UpdateSelf, set: RecordUnknown) {
    const queryForUpdate = q as unknown as Query;
    queryForUpdate.q.wrapInTransaction = true;

    const data = set[this.key] as NestedUpdateOneItem;
    this.nestedUpdate(queryForUpdate, set, data);
  }
}

export const getBelongsToRequired = (
  tableConfig: ORMTableInput,
  relatedTableConfig: ORMTableInput,
  relation: BelongsTo,
) => {
  const { required } = relation.options;
  if (typeof required === 'boolean') return required;

  if (relatedTableConfig.softDelete) return false;

  return relation.options.columns.every((key) => {
    return !tableConfig.columns.shape[key as string].data.isNullable;
  });
};

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
    _queryDefaults(query as unknown as CreateSelf, on);
  }

  const len = primaryKeys.length;
  const state: State = {
    query: query as Query.NotReadOnlyQuery,
    primaryKeys,
    foreignKeys,
    len,
    on,
  };

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
    setQueryObjectValueImmutable(
      q,
      'joinedShapes',
      baseAs,
      baseQuery.q.selectShape,
    );

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
      internalSchemaConfig,
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
