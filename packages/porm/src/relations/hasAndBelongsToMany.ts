import { RelationScopeOrModel, RelationThunkBase } from './relations';
import { Model, ModelClass } from '../model';
import { pushQueryValue, Query, SetQueryReturnsAll } from 'pqb';

export interface HasAndBelongsToMany extends RelationThunkBase {
  type: 'hasAndBelongsToMany';
  fn(): ModelClass;
  options: {
    primaryKey: string;
    foreignKey: string;
    associationPrimaryKey: string;
    associationForeignKey: string;
    joinTable: string;
    scope?(q: Query): Query;
  };
}

export type HasAndBelongsToManyMethod<
  T extends Model,
  Relation extends HasAndBelongsToMany,
> = (
  params: Record<
    Relation['options']['primaryKey'],
    T['columns']['shape'][Relation['options']['primaryKey']]['type']
  >,
) => SetQueryReturnsAll<RelationScopeOrModel<Relation>>;

export const makeHasAndBelongsToManyMethod = (
  qb: Query,
  relation: HasAndBelongsToMany,
  query: Query,
) => {
  const {
    primaryKey,
    foreignKey,
    associationPrimaryKey,
    associationForeignKey,
    joinTable,
  } = relation.options;

  const foreignKeyFull = `${joinTable}.${foreignKey}`;
  const associationForeignKeyFull = `${joinTable}.${associationForeignKey}`;
  const associationPrimaryKeyFull = `${query.table}.${associationPrimaryKey}`;

  const subQuery = qb.from(joinTable);

  pushQueryValue(subQuery, 'and', {
    item: {
      type: 'on',
      on: [associationForeignKeyFull, associationPrimaryKeyFull],
    },
  });

  return (params: Record<string, unknown>) => {
    return query.whereExists(
      subQuery.where({
        [foreignKeyFull]: params[primaryKey],
      }),
    );
  };
};
