import { defaultsKey, Query, QueryWithTable } from './query';

export type NestedInsertOneItem = { create: Record<string, unknown> };
export type NestedInsertManyItems = { create: Record<string, unknown>[] };
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

export type BaseRelation = {
  type: string;
  key: string;
  model: QueryWithTable;
  joinQuery: Query;
  nestedCreateQuery: Query;
  nestedInsert?:
    | BelongsToNestedInsert
    | HasOneNestedInsert
    | HasManyNestedInsert;
  primaryKey: string;
  options: {
    scope?(q: QueryWithTable): QueryWithTable;
    required?: boolean;
  };
};

export interface BelongsToRelation extends BaseRelation {
  type: 'belongsTo';
  options: BaseRelation['options'] & {
    primaryKey: string;
    foreignKey: string;
  };
}

export interface HasOneRelation extends BaseRelation {
  type: 'hasOne';
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
  [relationQueryKey]: true;
  [isRequiredRelationKey]: boolean;
};

export type RelationQuery<
  RelationName extends PropertyKey = string,
  Params extends Record<string, unknown> = never,
  Populate extends string = never,
  T extends Query = Query,
  Required extends boolean = boolean,
  Q extends Query = Omit<T, 'tableAlias'> & {
    tableAlias: RelationName extends string ? RelationName : never;
    [isRequiredRelationKey]: Required;
    [relationQueryKey]: true;
  },
> = ((params: Params) => Q & { [defaultsKey]: Pick<T['type'], Populate> }) & Q;
