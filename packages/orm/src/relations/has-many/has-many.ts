import {
  RelationData,
  RelationThunkBase,
  RelationConfigSelf,
} from '../relations';
import { Query } from 'pqb';
import {
  CreateData,
  WhereArg,
  VirtualColumn,
  CreateCtx,
  CreateSelf,
  UpdateData,
  UpdateSelf,
  _queryDefaults,
  _queryUpdate,
  PickQueryQ,
  _queryWhere,
  SelectableFromShape,
  ColumnSchemaConfig,
  getPrimaryKeys,
  MaybeArray,
  RecordString,
  RecordUnknown,
  RelationConfigBase,
  RelationJoinQuery,
  prepareSubQueryForSql,
  QueryHasWhere,
  internalSchemaConfig,
} from 'pqb/internal';
import { addAutoForeignKey, joinHasRelation } from '../common/utils';
import {
  HasManyNestedUpdate,
  hasManyUpdate,
  nestedUpdate,
} from './has-many.update';
import { makeHasManyThroughMethod } from './has-many.through';

export type { HasManyNestedUpdate } from './has-many.update';
import { RelationRefsOptions, RelationThroughOptions } from '../common/options';
import {
  HasOneOptions,
  HasOneParams,
  HasOneQueryThrough,
} from '../has-one/has-one';
import { ORMTableInput } from '../../orm-table/legacy-table';
import { joinQueryChainHOF } from '../common/joinQueryChain';
import {
  HasManyNestedInsert,
  nestedInsert,
  hasManyCreate,
} from './has-many.create';

export interface HasMany extends RelationThunkBase {
  type: 'hasMany';
  options: HasOneOptions;
}

export type HasManyQuery<
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
            : TableQuery[K];
    } & QueryHasWhere
  : HasOneQueryThrough<Name, TableQuery>;

export interface HasManyInfo<
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends HasMany,
  Q extends Query,
> extends RelationConfigBase {
  returnsOne: false;
  query: Q;
  params: HasOneParams<T, Rel['options']>;
  omitForeignKeyInCreate: never;
  dataForCreate: {
    [K in Name]?: Q extends Query.Pick.IsNotReadOnly
      ? Rel['options'] extends RelationThroughOptions
        ? never
        : {
            // create related records
            create?: CreateData<Q>[];
            // find existing records by `where` conditions and update their foreign keys with the new id
            connect?: WhereArg<Q>[];
            // try finding records by `where` conditions, and create them if not found
            connectOrCreate?: {
              where: WhereArg<Q>;
              create: CreateData<Q>;
            }[];
          }
      : never;
  };
  // `hasMany` relation data available for update. It supports:
  // - `disconnect` nullifies foreign keys of the related records
  // - `delete` deletes related record found by conditions
  // - `update` updates related records found by conditions with a provided data
  dataForUpdate: Q extends Query.Pick.IsNotReadOnly
    ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
          where: MaybeArray<WhereArg<Q>>;
          data: UpdateData<Q>;
        };
      }
    : never;
  // Only for records that update a single record:
  // - `set` updates foreign keys of related records found by conditions, nullifies previously connected
  // - `add` updates foreign keys of related records found by conditions, doesn't nullify previously connected
  // - `create` creates related records
  dataForUpdateOne: Q extends Query.Pick.IsNotReadOnly
    ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
          where: MaybeArray<WhereArg<Q>>;
          data: UpdateData<Q>;
        };
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
        create?: CreateData<Q>[];
        upsert?: {
          findBy: Q['internal']['uniqueColumns'];
          update: UpdateData<Q>;
          create?: CreateData<Q> | (() => CreateData<Q>);
        };
      }
    : never;
}

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
}

class HasManyVirtualColumn extends VirtualColumn<ColumnSchemaConfig> {
  private readonly nestedInsert: HasManyNestedInsert;
  private readonly nestedUpdate: HasManyNestedUpdate;
  private readonly setNulls: RecordUnknown;

  constructor(
    schema: ColumnSchemaConfig,
    private key: string,
    private state: State,
  ) {
    super(schema);
    this.nestedInsert = nestedInsert(state);
    this.nestedUpdate = nestedUpdate(state);

    this.setNulls = {};
    for (const foreignKey of state.foreignKeys) {
      this.setNulls[foreignKey] = null;
    }
  }

  create(
    self: CreateSelf,
    ctx: CreateCtx,
    items: RecordUnknown[],
    rowIndexes: number[],
    count: number,
  ) {
    hasManyCreate(
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
    hasManyUpdate(this.key, this.state, this.nestedUpdate, self, set);
  }
}

export const makeHasManyMethod = (
  tableConfig: ORMTableInput,
  table: Query,
  relation: HasMany,
  relationName: string,
  query: Query,
): RelationData => {
  const relPKeys = getPrimaryKeys(query);

  const throughResult = makeHasManyThroughMethod({
    table,
    query,
    relation,
    relationName,
    relPKeys,
  });
  if (throughResult) return throughResult;

  // After through check, we know options has columns/references
  const opts = relation.options as RelationRefsOptions;
  const primaryKeys = opts.columns as string[];
  const foreignKeys = opts.references as string[];
  const { on } = opts;

  if (on) {
    _queryWhere(query, [on]);
    _queryDefaults(query as unknown as CreateSelf, on);
  }

  addAutoForeignKey(tableConfig, query, table, primaryKeys, foreignKeys, opts);

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
    returns: 'many',
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
    virtualColumn: new HasManyVirtualColumn(
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
