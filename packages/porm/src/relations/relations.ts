import { PostgresModelConstructor } from '../model';
import { BelongsTo } from './belongsTo';
import {
  QueryData,
  Query,
  SetQueryReturns,
  QueryWithTable,
  Selectable,
} from 'pqb';

export type ModelOrQuery = PostgresModelConstructor | QueryWithTable;

export type ModelOrQueryToQuery<T extends ModelOrQuery> =
  T extends PostgresModelConstructor ? InstanceType<T> : T;

export type RelationType = 'belongsTo';

export type RelationThunk<
  Type extends RelationType = RelationType,
  Q extends ModelOrQuery = ModelOrQuery,
  Options extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: Type;
  fn: () => Q;
  options: Options;
};

export type Relation<
  Key extends PropertyKey = PropertyKey,
  T extends RelationThunk = RelationThunk,
> = {
  key: Key;
  type: T['type'];
  query: ModelOrQueryToQuery<ReturnType<T['fn']>>;
  options: T['options'];
  joinQuery: Query & { query: QueryData };
};

export type MapRelationMethods<T extends Query> = Omit<
  {
    [K in keyof T]: T[K] extends BelongsTo<Query, infer Q, infer Options>
      ? (
          params: Record<
            Options['foreignKey'],
            Q['selectable'][Options['primaryKey']]
          >,
        ) => SetQueryReturns<Q, 'one'>
      : T[K];
  },
  'relations'
> & {
  relations: Relations<T>;
};

export type Relations<
  T extends Query,
  R = {
    [K in keyof T]: T[K] extends RelationThunk ? Relation<K, T[K]> : never;
  },
> = Pick<
  R,
  {
    [K in keyof R]: R[K] extends Relation ? K : never;
  }[keyof R]
>;

export class RelationMethods {
  belongsTo<
    T extends Query,
    F extends ModelOrQuery,
    Q extends QueryWithTable,
    PK extends Selectable<Q>,
    FK extends Selectable<T>,
  >(
    this: T,
    fn: () => F,
    options?: {
      primaryKey: PK;
      foreignKey: FK;
    },
  ): BelongsTo<T, Q, { primaryKey: PK; foreignKey: FK }> {
    return new BelongsTo(
      // it's necessary to convert model to query here
      // otherwise, TS cannot pick the type of model
      fn as unknown as () => Q,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      options!,
    );
  }
}
