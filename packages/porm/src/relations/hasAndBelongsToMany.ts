import { RelationData, RelationThunkBase } from './relations';
import { Model } from '../model';
import { getQueryAs, HasAndBelongsToManyRelation, Query } from 'pqb';

export interface HasAndBelongsToMany extends RelationThunkBase {
  type: 'hasAndBelongsToMany';
  returns: 'many';
  options: HasAndBelongsToManyRelation['options'];
}

export type HasAndBelongsToManyInfo<
  T extends Model,
  Relation extends HasAndBelongsToMany,
> = {
  params: Record<
    Relation['options']['primaryKey'],
    T['columns']['shape'][Relation['options']['primaryKey']]['type']
  >;
  populate: never;
};

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
    returns: 'many',
    method: (params: Record<string, unknown>) => {
      return query
        .whereExists(subQuery, (q) =>
          q.on(associationForeignKeyFull, associationPrimaryKeyFull).where({
            [foreignKeyFull]: params[primaryKey],
          }),
        )
        .beforeInsert(async () => {});
    },
    joinQuery: query.whereExists(subQuery, (q) =>
      q
        .on(associationForeignKeyFull, associationPrimaryKeyFull)
        .on(foreignKeyFull, primaryKeyFull),
    ),
    primaryKey,
  };
};
