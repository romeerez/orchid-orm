import { defaultsKey, Query, QueryBase, QueryWithTable } from './query';
import { WhereArg, UpdateData, CreateMethodsNames } from './queryMethods';
import { MaybeArray } from './utils';

export type NestedInsertOneItem = {
  create?: Record<string, unknown>;
  connect?: WhereArg<QueryBase>;
  connectOrCreate?: {
    where: WhereArg<QueryBase>;
    create: Record<string, unknown>;
  };
};

export type NestedInsertManyItems = {
  create?: Record<string, unknown>[];
  connect?: WhereArg<QueryBase>[];
  connectOrCreate?: {
    where: WhereArg<QueryBase>;
    create: Record<string, unknown>;
  }[];
};

export type NestedInsertItem = NestedInsertOneItem | NestedInsertManyItems;

export type BelongsToNestedInsert = (
  query: Query,
  relationData: NestedInsertOneItem[],
) => Promise<Record<string, unknown>[]>;

export type HasOneNestedInsert = (
  query: Query,
  data: [
    selfData: Record<string, unknown>,
    relationData: NestedInsertOneItem,
  ][],
) => Promise<void>;

export type HasManyNestedInsert = (
  query: Query,
  data: [
    selfData: Record<string, unknown>,
    relationData: NestedInsertManyItems,
  ][],
) => Promise<void>;

export type NestedUpdateOneItem = {
  disconnect?: boolean;
  set?: WhereArg<QueryBase>;
  delete?: boolean;
  update?: UpdateData<Query>;
  upsert?: {
    update: UpdateData<Query>;
    create: Record<string, unknown>;
  };
  create: Record<string, unknown>;
};

export type NestedUpdateManyItems = {
  disconnect?: MaybeArray<WhereArg<QueryBase>>;
  set?: MaybeArray<WhereArg<QueryBase>>;
  delete?: MaybeArray<WhereArg<QueryBase>>;
  update?: {
    where: MaybeArray<WhereArg<QueryBase>>;
    data: UpdateData<Query>;
  };
  create: Record<string, unknown>[];
};

export type NestedUpdateItem = NestedUpdateOneItem | NestedUpdateManyItems;

export type BelongsToNestedUpdate = (
  q: Query,
  update: Record<string, unknown>,
  params: NestedUpdateOneItem,
  state: {
    updateLater?: Record<string, unknown>;
    updateLaterPromises?: Promise<void>[];
  },
) => boolean;

export type HasOneNestedUpdate = (
  query: Query,
  data: Record<string, unknown>[],
  relationData: NestedUpdateOneItem,
) => Promise<void>;

export type HasManyNestedUpdate = (
  query: Query,
  data: Record<string, unknown>[],
  relationData: NestedUpdateManyItems,
) => Promise<void>;

export type BaseRelation = {
  type: string;
  key: string;
  model: QueryWithTable;
  query: QueryWithTable;
  joinQuery(fromQuery: QueryBase, toQuery: Query): Query;
  nestedCreateQuery: Query;
  nestedInsert?:
    | BelongsToNestedInsert
    | HasOneNestedInsert
    | HasManyNestedInsert;
  nestedUpdate?:
    | BelongsToNestedUpdate
    | HasOneNestedUpdate
    | HasManyNestedUpdate;
  primaryKey: string;
  options: {
    scope?(q: QueryWithTable): QueryWithTable;
    required?: boolean;
  };
};

export interface BelongsToRelation extends BaseRelation {
  type: 'belongsTo';
  returns: 'one';
  options: BaseRelation['options'] & {
    primaryKey: string;
    foreignKey: string;
  };
}

export interface HasOneRelation extends BaseRelation {
  type: 'hasOne';
  returns: 'one';
  options: BaseRelation['options'] &
    (
      | {
          primaryKey: string;
          foreignKey: string;
        }
      | {
          through: string;
          source: string;
        }
    );
}

export interface HasManyRelation extends BaseRelation {
  type: 'hasMany';
  returns: 'many';
  options: BaseRelation['options'] &
    (
      | {
          primaryKey: string;
          foreignKey: string;
        }
      | {
          through: string;
          source: string;
        }
    );
}

export interface HasAndBelongsToManyRelation extends BaseRelation {
  type: 'hasAndBelongsToMany';
  returns: 'many';
  options: BaseRelation['options'] & {
    primaryKey: string;
    foreignKey: string;
    associationPrimaryKey: string;
    associationForeignKey: string;
    joinTable: string;
  };
}

export type Relation =
  | BelongsToRelation
  | HasOneRelation
  | HasManyRelation
  | HasAndBelongsToManyRelation;

export type RelationsBase = Record<never, Relation>;

export type relationQueryKey = typeof relationQueryKey;
export const relationQueryKey = Symbol('relationQuery');

export type isRequiredRelationKey = typeof isRequiredRelationKey;
export const isRequiredRelationKey = Symbol('isRequiredRelation');

export type RelationQueryBase = Query & {
  [relationQueryKey]: string;
  [isRequiredRelationKey]: boolean;
};

type PrepareRelationQuery<
  T extends Query,
  RelationName extends PropertyKey,
  Required extends boolean,
> = Omit<T, 'tableAlias'> & {
  tableAlias: RelationName extends string ? RelationName : never;
  [isRequiredRelationKey]: Required;
  [relationQueryKey]: string;
};

export type RelationQuery<
  Name extends PropertyKey = string,
  Params extends Record<string, unknown> = never,
  Populate extends string = never,
  T extends Query = Query,
  Required extends boolean = boolean,
  ChainedCreate extends boolean = false,
  Q extends RelationQueryBase = ChainedCreate extends true
    ? PrepareRelationQuery<T, Name, Required>
    : PrepareRelationQuery<T, Name, Required> & {
        [K in CreateMethodsNames]: never;
      },
> = ((params: Params) => Q & { [defaultsKey]: Record<Populate, true> }) & Q;
