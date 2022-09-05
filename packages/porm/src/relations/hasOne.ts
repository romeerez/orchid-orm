import { addQueryOn, OnQueryBuilder, Query, Relation } from 'pqb';
import { Model, ModelClass } from '../model';
import {
  RelationData,
  RelationParams,
  RelationThunkBase,
  RelationThunks,
} from './relations';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  returns: 'one';
  fn(): ModelClass;
  options: RelationThunkBase['options'] &
    (
      | {
          primaryKey: string;
          foreignKey: string;
        }
      | {
          through: string;
          source: string;
        }
    );
}

export type HasOneParams<
  T extends Model,
  Relations extends RelationThunks,
  Relation extends HasOne,
> = Relation['options'] extends { primaryKey: string }
  ? Record<
      Relation['options']['primaryKey'],
      T['columns']['shape'][Relation['options']['primaryKey']]['type']
    >
  : Relation['options'] extends { through: string }
  ? RelationParams<T, Relations, Relations[Relation['options']['through']]>
  : never;

export const makeHasOneMethod = (
  model: Query,
  relation: HasOne,
  query: Query,
): RelationData => {
  if ('through' in relation.options) {
    const { through, source } = relation.options;

    type ModelWithQueryMethod = Record<
      string,
      (params: Record<string, unknown>) => Query
    >;

    const throughRelation = (model.relations as Record<string, Relation>)[
      through
    ];

    const sourceRelation = (
      throughRelation.model.relations as Record<string, Relation>
    )[source];

    const whereExistsCallback = (q: OnQueryBuilder<Query, never>) =>
      sourceRelation.joinQuery as unknown as typeof q;

    return {
      method: (params: Record<string, unknown>) => {
        const throughQuery = (model as unknown as ModelWithQueryMethod)[
          through
        ](params);

        return query.whereExists(throughQuery, whereExistsCallback)._take();
      },
      joinQuery: query.whereExists(
        throughRelation.joinQuery,
        whereExistsCallback,
      ),
    };
  }

  const { primaryKey, foreignKey } = relation.options;

  return {
    method: (params: Record<string, unknown>) => {
      return query.findBy({ [foreignKey]: params[primaryKey] });
    },
    joinQuery: addQueryOn(query, query, model, foreignKey, primaryKey),
  };
};
