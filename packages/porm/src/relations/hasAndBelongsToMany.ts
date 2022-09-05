import { RelationData, RelationThunkBase } from './relations';
import { Model, ModelClass } from '../model';
import { getQueryAs, Query } from 'pqb';

export interface HasAndBelongsToMany extends RelationThunkBase {
  type: 'hasAndBelongsToMany';
  returns: 'many';
  fn(): ModelClass;
  options: RelationThunkBase['options'] & {
    primaryKey: string;
    foreignKey: string;
    associationPrimaryKey: string;
    associationForeignKey: string;
    joinTable: string;
  };
}

export type HasAndBelongsToManyParams<
  T extends Model,
  Relation extends HasAndBelongsToMany,
> = Record<
  Relation['options']['primaryKey'],
  T['columns']['shape'][Relation['options']['primaryKey']]['type']
>;

export const makeHasAndBelongsToManyMethod = (
  model: Query,
  qb: Query,
  relation: HasAndBelongsToMany,
  query: Query,
): RelationData => {
  const {
    primaryKey,
    foreignKey,
    associationPrimaryKey,
    associationForeignKey,
    joinTable,
  } = relation.options;

  const primaryKeyFull = `${getQueryAs(model)}.${primaryKey}`;
  const foreignKeyFull = `${joinTable}.${foreignKey}`;
  const associationForeignKeyFull = `${joinTable}.${associationForeignKey}`;
  const associationPrimaryKeyFull = `${getQueryAs(
    query,
  )}.${associationPrimaryKey}`;

  const subQuery = qb.from(joinTable);

  return {
    method: (params: Record<string, unknown>) => {
      return query.whereExists(subQuery, (q) =>
        q.on(associationForeignKeyFull, associationPrimaryKeyFull).where({
          [foreignKeyFull]: params[primaryKey],
        }),
      );
    },
    joinQuery: query.whereExists(subQuery, (q) =>
      q
        .on(associationForeignKeyFull, associationPrimaryKeyFull)
        .on(foreignKeyFull, primaryKeyFull),
    ),
  };
};
