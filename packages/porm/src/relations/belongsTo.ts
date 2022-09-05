import { Model, ModelClass } from '../model';
import { addQueryOn, Query } from 'pqb';
import { RelationData, RelationThunkBase } from './relations';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  returns: 'one';
  fn(): ModelClass;
  options: RelationThunkBase['options'] & {
    primaryKey: string;
    foreignKey: string;
  };
}

export type BelongsToParams<
  T extends Model,
  Relation extends BelongsTo,
> = Record<
  Relation['options']['foreignKey'],
  T['columns']['shape'][Relation['options']['foreignKey']]['type']
>;

export const makeBelongsToMethod = (
  model: Query,
  relation: BelongsTo,
  query: Query,
): RelationData => {
  const { primaryKey, foreignKey } = relation.options;

  return {
    method: (params: Record<string, unknown>) => {
      return query.findBy({ [primaryKey]: params[foreignKey] });
    },
    joinQuery: addQueryOn(query, query, model, primaryKey, foreignKey),
  };
};
