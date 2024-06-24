import {
  Query,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
} from './query/query';
import { RecordUnknown } from 'orchid-core';

export interface RelationJoinQuery {
  (joiningQuery: Query, baseQuery: Query): Query;
}

export interface RelationConfigBase {
  query: Query;
  joinQuery: RelationJoinQuery;
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
}

export interface RelationConfigDataForCreate {
  columns: RecordUnknown;
  nested: RecordUnknown;
}

export interface RelationsBase {
  [K: string]: RelationQueryBase;
}

export interface RelationQueryBase extends Query {
  relationConfig: RelationConfigBase;
}

export type RelationQuery<
  Config extends RelationConfigBase = RelationConfigBase,
  Params = never,
  Required = never,
  One = never,
> = RelationQueryFnAndConfig<Config, Params, Required, One> & Config['query'];

interface RelationQueryFnAndConfig<
  Config extends RelationConfigBase = RelationConfigBase,
  Params = never,
  Required = never,
  One = never,
> {
  (params: Params): One extends true
    ? Required extends true
      ? SetQueryReturnsOne<Config['query']>
      : SetQueryReturnsOneOptional<Config['query']>
    : Config['query'];
  relationConfig: Config;
}
