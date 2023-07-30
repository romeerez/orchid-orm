import { Query, QueryWithTable } from './query';
import { CreateMethodsNames, DeleteMethodsNames } from './queryMethods';
import { EmptyObject } from 'orchid-core';
import { QueryBase } from './queryBase';
import { SubQueryBuilder } from './subQueryBuilder';

export type BaseRelation = {
  type: string;
  key: string;
  table: QueryWithTable;
  query: QueryWithTable;
  joinQuery(fromQuery: QueryBase, toQuery: Query): Query;
  nestedCreateQuery: Query;
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

export type RelationQueryData = {
  relationName: string;
  sourceQuery: Query;
  relationQuery: Query;
  joinQuery(fromQuery: Query, toQuery: Query): Query;
};

export type RelationQueryBase = Query & {
  [relationQueryKey]: RelationQueryData;
  [isRequiredRelationKey]: boolean;
};

type PrepareRelationQuery<
  T extends Query,
  RelationName extends PropertyKey,
  Required extends boolean,
  Populate extends string,
> = Omit<T, 'meta'> & {
  meta: Omit<T['meta'], 'as'> & {
    as: RelationName extends string ? RelationName : never;
    defaults: Record<Populate, true>;
  };
  [isRequiredRelationKey]: Required;
  [relationQueryKey]: RelationQueryData;
};

export type RelationQuery<
  Name extends PropertyKey = string,
  Params extends Record<string, unknown> = never,
  Populate extends string = never,
  T extends Query = Query,
  Required extends boolean = boolean,
  ChainedCreate extends boolean = false,
  ChainedDelete extends boolean = false,
  Q extends RelationQueryBase = (ChainedCreate extends true
    ? PrepareRelationQuery<T, Name, Required, Populate>
    : PrepareRelationQuery<T, Name, Required, Populate> & {
        [K in CreateMethodsNames]: never;
      }) &
    (ChainedDelete extends true
      ? EmptyObject
      : {
          [K in DeleteMethodsNames]: never;
        }),
> = ((params: Params) => Q) &
  Q & {
    meta: {
      hasWhere: true;
    };
    // INNER JOIN the current relation instead of the default OUTER behavior
    join<T extends Query>(this: T): T;
  };

/**
 * Map relations into a Record where each relation aggregate methods can be chained with column operators.
 * Used in `where` callback argument, see {@link WhereQueryBuilder}.
 */
export type RelationSubQueries<T extends QueryBase> = {
  [K in keyof T['relations']]: T[K] extends Query
    ? SubQueryBuilder<T[K]>
    : never;
};
