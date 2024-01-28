import { Query, QueryWithTable } from './query/query';

export type RelationsChain = (Query | RelationQuery)[];

export type RelationJoinQuery = (
  joiningQuery: Query,
  baseQuery: Query,
) => Query;

export type RelationConfigBase = {
  table: QueryWithTable;
  query: QueryWithTable;
  chainedQuery: Query;
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
  params: Record<string, unknown>;
};

export type RelationConfigDataForCreate = {
  columns: Record<string, unknown>;
  nested: Record<string, unknown>;
};

export type RelationsBase = Record<string, RelationQueryBase>;

export type RelationQueryBase = Query & {
  relationConfig: RelationConfigBase;
};

export type RelationQuery<
  Config extends RelationConfigBase = RelationConfigBase,
> = ((params: Config['params']) => Config['methodQuery']) &
  Config['chainedQuery'] & {
    relationConfig: Config;
  };
