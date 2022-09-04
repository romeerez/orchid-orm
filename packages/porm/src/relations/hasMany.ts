import { RelationData, RelationThunkBase } from './relations';
import { Model, ModelClass } from '../model';
import { pushQueryOn, Query } from 'pqb';

export interface HasMany extends RelationThunkBase {
  type: 'hasMany';
  returns: 'many';
  fn(): ModelClass;
  options: RelationThunkBase['options'] & {
    primaryKey: string;
    foreignKey: string;
  };
}

export type HasManyParams<T extends Model, Relation extends HasMany> = Record<
  Relation['options']['primaryKey'],
  T['columns']['shape'][Relation['options']['primaryKey']]['type']
>;

export const makeHasManyMethod = (
  relation: HasMany,
  query: Query,
): RelationData => {
  const { primaryKey, foreignKey } = relation.options;

  return {
    method: (params: Record<string, unknown>) => {
      return query.where({ [foreignKey]: params[primaryKey] });
    },
    joinQuery: pushQueryOn(query, foreignKey, primaryKey),
  };
};
