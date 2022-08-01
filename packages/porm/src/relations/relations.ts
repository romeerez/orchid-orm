import { BelongsTo } from './belongsTo';
import { QueryData, Query, SetQueryReturns } from 'pqb';
import { ModelClass, PostgresModel } from '../model';

export type RelationType = 'belongsTo';

export type RelationThunk<
  Type extends RelationType = RelationType,
  RelatedModel extends ModelClass = ModelClass,
  Options extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: Type;
  fn: () => RelatedModel;
  options: Options;
};

export type Relation<
  Key extends PropertyKey = PropertyKey,
  T extends RelationThunk = RelationThunk,
> = {
  key: Key;
  type: T['type'];
  model: PostgresModel;
  options: T['options'];
  joinQuery: Query & { query: QueryData };
};

export type MapRelationMethods<T extends Query> = Omit<
  {
    [K in keyof T]: T[K] extends BelongsTo
      ? (
          params: Record<
            T[K]['options']['foreignKey'],
            InstanceType<
              ReturnType<T[K]['fn']>
            >['shape'][T[K]['options']['primaryKey']]['type']
          >,
        ) => SetQueryReturns<InstanceType<ReturnType<T[K]['fn']>>, 'one'>
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
    This extends PostgresModel,
    RelatedModel extends ModelClass,
    PK extends keyof InstanceType<RelatedModel>['shape'],
    FK extends keyof This['shape'],
  >(
    this: This,
    fn: () => RelatedModel,
    options: {
      primaryKey: PK;
      foreignKey: FK;
    },
  ): BelongsTo<This, RelatedModel, { primaryKey: PK; foreignKey: FK }> {
    return new BelongsTo(fn, options);
  }
}
