import { Query } from 'pqb';
import { Column, internalSchemaConfig } from 'pqb/internal';
import {
  _queryDefaults,
  _queryWhere,
  ColumnSchemaConfig,
  CreateCtx,
  CreateData,
  CreateSelf,
  CreateManyMethodsNames,
  CreateMethodsNames,
  EmptyObject,
  getPrimaryKeys,
  PickQueryQ,
  prepareSubQueryForSql,
  QueryHasWhere,
  RecordString,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  SelectableFromShape,
  UpdateSelf,
  UpdateData,
  VirtualColumn,
  WhereArg,
} from 'pqb/internal';
import { ORMTableInput } from '../../orm-table/legacy-table';
import {
  RelationData,
  RelationThunkBase,
  RelationConfigParams,
  RelationConfigSelf,
  RelationToOneDataForCreate,
} from '../relations';
import { addAutoForeignKey, joinHasRelation } from '../common/utils';
import { RelationRefsOptions, RelationThroughOptions } from '../common/options';
import { joinQueryChainHOF } from '../common/joinQueryChain';
import {
  HasOneNestedInsert,
  hasOneCreate,
  nestedInsert,
} from './has-one.create';
import { hasOneThrough } from './has-one.through';
import { hasOneUpdate } from './has-one.update';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  options: HasOneOptions;
}

interface RelationHasOneThroughOptions<
  Through extends string,
> extends RelationThroughOptions<Through> {
  required?: boolean;
}

export type HasOneOptions<
  Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit,
  Related extends ORMTableInput = ORMTableInput,
  Through extends string = string,
> =
  | RelationRefsOptions<keyof Columns, Related['columns']['shape']>
  | RelationHasOneThroughOptions<Through>;

export type HasOneParams<
  T extends RelationConfigSelf,
  Options,
> = Options extends RelationRefsOptions
  ? {
      [Name in Options['columns'][number]]: T['columns']['shape'][Name]['__type'];
    }
  : Options extends RelationThroughOptions
    ? RelationConfigParams<T, T['relations'][Options['through']]>
    : never;

export type HasOneQueryThrough<
  Name extends string,
  TableQuery extends Query,
> = {
  [K in keyof TableQuery]: K extends '__selectable'
    ? SelectableFromShape<TableQuery['shape'], Name>
    : K extends '__as'
      ? Name
      : K extends CreateMethodsNames
        ? never
        : TableQuery[K];
} & QueryHasWhere;

export type HasOneQuery<
  T extends RelationConfigSelf,
  Name extends string,
  TableQuery extends Query,
> = T['relations'][Name]['options'] extends RelationRefsOptions
  ? {
      [K in keyof TableQuery]: K extends '__defaults'
        ? {
            [K in
              | keyof TableQuery['__defaults']
              | T['relations'][Name]['options']['references'][number]]: true;
          }
        : K extends '__selectable'
          ? SelectableFromShape<TableQuery['shape'], Name>
          : K extends '__as'
            ? Name
            : K extends CreateManyMethodsNames
              ? never
              : TableQuery[K];
    } & QueryHasWhere
  : HasOneQueryThrough<Name, TableQuery>;

export interface HasOneInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends HasOne,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: true;
  required: Rel['options']['required'];
  query: Q;
  params: HasOneParams<T, Rel['options']>;
  omitForeignKeyInCreate: never;
  dataForCreate: {
    [K in Name]?: Q extends Query.Pick.IsNotReadOnly
      ? Rel['options'] extends RelationThroughOptions
        ? EmptyObject
        : RelationToOneDataForCreate<{
            nestedCreateQuery: CreateData<Q>;
            table: Q;
          }>
      : never;
  };
  // `hasOne` relation data available for update. It supports:
  // - `disconnect` to nullify a foreign key of the related record
  // - `delete` to delete the related record
  // - `update` to update the related record
  dataForUpdate: Q extends Query.Pick.IsNotReadOnly
    ? { disconnect: boolean } | { delete: boolean } | { update: UpdateData<Q> }
    : never;
  // Only for records that update a single record:
  // - `set` to update the foreign key of related record found by condition
  // - `upsert` to update or create the related record
  // - `create` to create a related record
  dataForUpdateOne: Q extends Query.Pick.IsNotReadOnly
    ?
        | { disconnect: boolean }
        | { set: WhereArg<Q> }
        | { delete: boolean }
        | { update: UpdateData<Q> }
        | {
            upsert: {
              update: UpdateData<Q>;
              create: CreateData<Q> | (() => CreateData<Q>);
            };
          }
        | {
            create: CreateData<Q>;
          }
    : never;
}

export interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
}

export type { HasOneNestedInsert } from './has-one.create';

class HasOneVirtualColumn extends VirtualColumn<ColumnSchemaConfig> {
  private readonly nestedInsert: HasOneNestedInsert;

  constructor(
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
    hasOneCreate(
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

  update(self: UpdateSelf, set: RecordUnknown) {
    hasOneUpdate(this.key, this.state, self, set);
  }
}

export const makeHasOneMethod = (
  tableConfig: ORMTableInput,
  table: Query,
  relation: HasOne,
  relationName: string,
  query: Query,
): RelationData => {
  const relPKeys = getPrimaryKeys(query);

  if ('through' in relation.options) {
    return hasOneThrough(
      table,
      relation.options,
      relationName,
      query,
      relPKeys,
    );
  }

  const primaryKeys = relation.options.columns as string[];
  const foreignKeys = relation.options.references as string[];
  const { on } = relation.options;

  if (on) {
    _queryWhere(query, [on]);
    _queryDefaults(query as unknown as CreateSelf, on);
  }

  addAutoForeignKey(
    tableConfig,
    query,
    table,
    primaryKeys,
    foreignKeys,
    relation.options,
  );

  const state: State = {
    query: query as Query.NotReadOnlyQuery,
    primaryKeys,
    foreignKeys,
    on,
  };
  const len = primaryKeys.length;

  const reversedOn: RecordString = {};
  for (let i = 0; i < len; i++) {
    reversedOn[foreignKeys[i]] = primaryKeys[i];
  }

  const fromQuerySelect = [{ selectAs: reversedOn }];

  const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
    return joinHasRelation(
      joiningQuery as Query,
      baseQuery as Query,
      foreignKeys,
      primaryKeys,
      len,
    );
  };

  return {
    returns: 'one',
    queryRelated: (params: RecordUnknown) => {
      const values: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        values[foreignKeys[i]] = params[primaryKeys[i]];
      }

      return _queryDefaults(
        query.where(values as never) as unknown as CreateSelf,
        {
          ...on,
          ...values,
        },
      ) as unknown as Query;
    },
    virtualColumn: new HasOneVirtualColumn(
      internalSchemaConfig,
      relationName,
      state,
    ),
    joinQuery: joinQueryChainHOF(
      relPKeys,
      reverseJoin,
      (joiningQuery, baseQuery) =>
        joinHasRelation(
          baseQuery as Query,
          joiningQuery as Query,
          primaryKeys,
          foreignKeys,
          len,
        ),
    ),
    reverseJoin,
    modifyRelatedQuery(relationQuery) {
      return (query) => {
        const baseQuery = (query as Query).clone();
        baseQuery.q.select = fromQuerySelect;
        const q = (relationQuery as unknown as PickQueryQ).q;
        q.insertFrom = prepareSubQueryForSql(q as never, baseQuery);
        q.values = [];
      };
    },
  };
};
