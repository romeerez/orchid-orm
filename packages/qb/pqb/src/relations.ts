import { Query, QueryWithTable } from './query';
import { CreateMethodsNames, DeleteMethodsNames } from './queryMethods';
import { EmptyObject, StringKey } from 'orchid-core';
import { QueryBase } from './queryBase';
import { SubQueryBuilder } from './subQueryBuilder';

export type RelationConfigBase = {
  table: QueryWithTable;
  query: QueryWithTable;
  joinQuery(fromQuery: QueryBase, toQuery: Query): Query;
  one: boolean;
  required: boolean;
  // Omit `belongsTo` foreign keys to be able to create records
  // with `db.book.create({ authorId: 123 })`
  // or with `db.book.create({ author: authorData })`.
  // Other relation kinds has `never` for it.
  omitForeignKeyInCreate: PropertyKey;
  dataForCreate: unknown;
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
  Q extends Query = (Config['chainedCreate'] extends true
    ? T
    : T & {
        [K in CreateMethodsNames]: never;
      }) &
    (Config['chainedDelete'] extends true
      ? EmptyObject
      : {
          [K in DeleteMethodsNames]: never;
        }),
> = ((params: Config['params']) => Q) &
  Q & {
    meta: Omit<T['meta'], 'as'> & {
      as: StringKey<Name>;
      defaults: Record<Config['populate'], true>;
      hasWhere: true;
    };
    relationConfig: Config;
    // INNER JOIN the current relation instead of the default OUTER behavior
    join<T extends Query>(this: T): T;
  };

/**
 * Map relations into a Record where each relation aggregate methods can be chained with column operators.
 * Used in `where` callback argument, see {@link WhereQueryBuilder}.
 */
export type RelationSubQueries<T extends QueryBase> = {
  [K in keyof T['relations']]: SubQueryBuilder<T['relations'][K]>;
};
