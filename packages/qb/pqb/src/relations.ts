import { Query, QueryWithTable } from './query/query';
import { CreateMethodsNames, DeleteMethodsNames } from './queryMethods';
import { EmptyObject, StringKey } from 'orchid-core';
import { QueryBase } from './query/queryBase';

export type RelationConfigBase = {
  table: QueryWithTable;
  query: QueryWithTable;
  joinQuery(fromQuery: QueryBase, toQuery: Query): Query;
  one: boolean;
  required: boolean;
  // Omit `belongsTo` foreign keys to be able to create records
  // with `db.book.create({ authorId: 123 })`
  // or with `db.book.create({ author: authorData })`.
  // Other relation kinds have `omitForeignKeyInCreate: never`.
  omitForeignKeyInCreate: PropertyKey;
  // Data for `create` method that may have required properties.
  // Only `belongsTo` has it for required foreign keys.
  requiredDataForCreate: unknown;
  // Data for `create` method with all optional properties.
  // Other than `belongsTo` relation kinds use it.
  optionalDataForCreate: unknown;
  dataForUpdate: unknown;
  dataForUpdateOne: unknown;
  params: Record<string, unknown>;
  populate: string;
  chainedCreate: boolean;
  chainedDelete: boolean;
};

export type RelationsBase = Record<string, RelationQueryBase>;

export type RelationQueryBase = Query & {
  relationConfig: RelationConfigBase;
};

export type RelationQuery<
  Name extends PropertyKey = PropertyKey,
  Config extends RelationConfigBase = RelationConfigBase,
  T extends Query = Query,
  Q extends Query = ((Config['chainedCreate'] extends true
    ? T
    : T & {
        [K in CreateMethodsNames]: never;
      }) &
    (Config['chainedDelete'] extends true
      ? EmptyObject
      : {
          [K in DeleteMethodsNames]: never;
        })) & {
    meta: Omit<T['meta'], 'as'> & {
      as: StringKey<Name>;
      defaults: Record<Config['populate'], true>;
      hasWhere: true;
    };
    relationConfig: Config;
    // INNER JOIN the current relation instead of the default OUTER behavior
    join<T extends Query>(this: T): T;
  },
> = ((params: Config['params']) => Q) & Q;
