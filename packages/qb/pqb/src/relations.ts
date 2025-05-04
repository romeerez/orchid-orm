import { Query } from './query/query';
import { IsQuery, PickQueryMetaReturnType, RecordUnknown } from 'orchid-core';

export interface RelationJoinQuery {
  (joiningQuery: IsQuery, baseQuery: IsQuery): IsQuery;
}

export interface RelationConfigBase {
  returnsOne: boolean;
  query: PickQueryMetaReturnType;
  joinQuery: RelationJoinQuery;
  reverseJoin: RelationJoinQuery;
  params: unknown;
  queryRelated(params: unknown): unknown;
  modifyRelatedQuery?(relatedQuery: IsQuery): (query: IsQuery) => void;
  maybeSingle: PickQueryMetaReturnType;
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
  [K: string]: RelationQueryBase;
}

export interface RelationQueryBase extends Query {
  relationConfig: RelationConfigBase;
}
