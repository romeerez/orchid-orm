import { Query } from './query/query';
import { RecordUnknown } from 'orchid-core';

export type RelationsChain = (Query | RelationQuery)[];

export type RelationJoinQuery = (
  joiningQuery: Query,
  baseQuery: Query,
) => Query;

export type RelationConfigBase = {
  query: Query;
  methodQuery: Query;
  joinQuery: RelationJoinQuery;
  one: boolean;
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
  params: RecordUnknown;
};

export type RelationConfigDataForCreate = {
  columns: RecordUnknown;
  nested: RecordUnknown;
};

export type RelationsBase = Record<string, RelationQueryBase>;

export interface RelationQueryBase extends Query {
  relationConfig: RelationConfigBase;
}

export type RelationQuery<
  Config extends RelationConfigBase = RelationConfigBase,
> = ((params: Config['params']) => Config['methodQuery']) &
  Config['query'] & {
    relationConfig: Config;
  };
