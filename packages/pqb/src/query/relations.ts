import {
  PickQueryAs,
  PickQueryMetaSelectableReturnType,
  PickQuerySelectable,
  PickQueryShape,
  PickQueryTable,
  PickQueryTableMetaResult,
} from './pick-query-types';
import { RecordUnknown } from '../utils';
import { IsQuery } from './query';

export interface RelationJoinQuery {
  (joiningQuery: IsQuery, baseQuery: IsQuery): IsQuery;
}

export interface RelationConfigQuery
  extends PickQueryTableMetaResult,
    PickQuerySelectable,
    PickQueryShape,
    PickQueryTable,
    PickQueryAs {}

export interface RelationConfigBase extends IsQuery {
  returnsOne: boolean;
  query: RelationConfigQuery;
  joinQuery: RelationJoinQuery;
  reverseJoin: RelationJoinQuery;
  params: unknown;

  queryRelated(params: unknown): unknown;

  modifyRelatedQuery?(relatedQuery: IsQuery): (query: IsQuery) => void;

  maybeSingle: PickQueryMetaSelectableReturnType;
  // Omit `belongsTo` foreign keys to be able to create records
  // with `db.book.create({ authorId: 123 })`
  // or with `db.book.create({ author: authorData })`.
  // Other relation kinds have `omitForeignKeyInCreate: never`.
  omitForeignKeyInCreate: PropertyKey;
  // Data for `create` method that may have required properties.
  // Only `belongsTo` has it for required foreign keys.
  dataForCreate?: RelationConfigDataForCreate;
  // Data for `create` method with all optional properties.
  // Other than `belongsTo` relation kinds use it.
  optionalDataForCreate: unknown;
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

/* getters */

export const isRelationQuery = (q: IsQuery): q is RelationConfigBase =>
  'joinQuery' in q;
