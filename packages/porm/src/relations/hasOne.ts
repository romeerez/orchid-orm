import { Query, SetQueryReturnsOneOrUndefined } from 'pqb';
import { Model, ModelClass } from '../model';
import { RelationScopeOrModel, RelationThunkBase } from './relations';

export interface HasOne extends RelationThunkBase {
  type: 'hasOne';
  fn(): ModelClass;
  options: {
    primaryKey: string;
    foreignKey: string;
    scope?(q: Query): Query;
  };
}

export type HasOneMethod<T extends Model, Relation extends HasOne> = (
  params: Record<
    Relation['options']['primaryKey'],
    T['columns']['shape'][Relation['options']['primaryKey']]['type']
  >,
) => SetQueryReturnsOneOrUndefined<RelationScopeOrModel<Relation>>;

export const makeHasOneMethod = (relation: HasOne, query: Query) => {
  const { primaryKey, foreignKey } = relation.options;

  return (params: Record<string, unknown>) => {
    return query.findBy({ [foreignKey]: params[primaryKey] });
  };
};
