import { Query, QueryWithTable } from './query/query';
import { CreateMethodsNames, DeleteMethodsNames } from './queryMethods';
import { StringKey } from 'orchid-core';
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
  dataForCreate?: RelationConfigDataForCreate;
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

export type RelationConfigDataForCreate = {
  columns: Record<string, unknown>;
  nested: Record<string, unknown>;
};

export type RelationsBase = Record<string, RelationQueryBase>;

export type RelationQueryBase = Query & {
  relationConfig: RelationConfigBase;
};

export type RelationQuery<
  Name extends PropertyKey = PropertyKey,
  Config extends RelationConfigBase = RelationConfigBase,
  T extends Query = Query,
  Q = {
    [K in keyof T | 'relationConfig']: K extends 'meta'
      ? Omit<T['meta'], 'as'> & {
          as: StringKey<Name>;
          defaults: Record<Config['populate'], true>;
          hasWhere: true;
        }
      : K extends 'join'
      ? // INNER JOIN the current relation instead of the default OUTER behavior
        <T extends Query>(this: T) => T
      : K extends CreateMethodsNames
      ? Config['chainedCreate'] extends true
        ? T[K]
        : never
      : K extends DeleteMethodsNames
      ? Config['chainedDelete'] extends true
        ? T[K]
        : never
      : K extends keyof T
      ? T[K]
      : Config;
  },
> = ((params: Config['params']) => Q) & Q;
