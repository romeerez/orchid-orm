import { RelationScopeOrModel, RelationThunkBase } from './relations';
import { Model, ModelClass } from '../model';
import { Query, SetQueryReturnsAll } from 'pqb';

export interface HasMany extends RelationThunkBase {
  type: 'hasMany';
  fn(): ModelClass;
  options: {
    primaryKey: string;
    foreignKey: string;
    scope?(q: Query): Query;
  };
}

export type HasManyMethod<T extends Model, Relation extends HasMany> = (
  params: Record<
    Relation['options']['primaryKey'],
    T['columns']['shape'][Relation['options']['primaryKey']]['type']
  >,
) => SetQueryReturnsAll<RelationScopeOrModel<Relation>>;

export const makeHasManyMethod = (relation: HasMany, query: Query) => {
  const { primaryKey, foreignKey } = relation.options;

  return (params: Record<string, unknown>) => {
    return query.where({ [foreignKey]: params[primaryKey] });
  };
};
