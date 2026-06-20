import {
  PickQueryAs,
  PickQuerySelectable,
  PickQueryShape,
  PickQueryTable,
  PickQueryResult,
  PickQueryRelations,
  PickQueryReturnType,
} from './pick-query-types';
import { RecordUnknown } from '../utils';
import { IsQuery, QueryManyTake, QueryManyTakeOptional } from './query';

export interface RelationJoinQuery {
  (joiningQuery: IsQuery, baseQuery: IsQuery): IsQuery;
}

export interface RelationConfigQuery
  extends
    PickQueryResult,
    PickQuerySelectable,
    PickQueryShape,
    PickQueryTable,
    PickQueryAs,
    PickQueryRelations,
    PickQueryReturnType {}

export interface RelationConfigBase extends IsQuery {
  returnsOne: boolean;
  required?: unknown;
  query: RelationConfigQuery;
  joinQuery: RelationJoinQuery;
  reverseJoin: RelationJoinQuery;
  params: unknown;

  queryRelated(params: unknown): unknown;

  modifyRelatedQuery?(relatedQuery: IsQuery): (query: IsQuery) => void;

  // Omit `belongsTo` foreign keys to be able to create records
  // with `db.book.create({ authorId: 123 })`
  // or with `db.book.create({ author: authorData })`.
  // Other relation kinds have `omitForeignKeyInCreate: never`.
  omitForeignKeyInCreate: PropertyKey;
  // Data for `create` method, handled separately for belongsTo and the rest
  dataForCreate: unknown;
  dataForUpdate: unknown;
  dataForUpdateOne: unknown;
  primaryKeys: string[];
}

export interface RelationConfigDataForCreate {
  columns: PropertyKey;
  nested: RecordUnknown;
}

export interface RelationsBase {
  [K: string]: RelationConfigBase;
}

export type RelationQueryMaybeSingle<T extends RelationConfigBase> =
  T['returnsOne'] extends true
    ? T['required'] extends true
      ? QueryManyTake<T['query']>
      : QueryManyTakeOptional<T['query']>
    : T['query'];

/* getters */

export const isRelationQuery = (q: IsQuery): q is RelationConfigBase =>
  'joinQuery' in q;
