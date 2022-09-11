import { RelationData, RelationThunkBase } from './relations';
import { Model } from '../model';
import {
  getQueryAs,
  HasAndBelongsToManyRelation,
  HasManyNestedInsert,
  InsertData,
  Query,
} from 'pqb';

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

  const subQuery = qb.clone();
  subQuery.table = joinTable;

  return {
    returns: 'many',
    method(params: Record<string, unknown>) {
      return query.whereExists(subQuery, (q) =>
        q.on(associationForeignKeyFull, associationPrimaryKeyFull).where({
          [foreignKeyFull]: params[primaryKey],
        }),
      );
    },
    nestedInsert: (async (data) => {
      const allKeys = data as unknown as [
        selfData: Record<string, unknown>,
        relationKeys: Record<string, unknown>[],
      ][];

      const create = data.filter(([, relationData]) => relationData.create);

      if (create.length) {
        const result = await query.insert(
          create.flatMap(([, { create }]) => create) as InsertData<Query>[],
          [associationPrimaryKey],
        );
        let pos = 0;
        create.forEach(([, data], index) => {
          const len = data.create.length;
          allKeys[index][1] = result.slice(pos, pos + len);
          pos += len;
        });
      }

      await subQuery.insert(
        allKeys.flatMap(([selfData, relationKeys]) => {
          const selfKey = selfData[primaryKey];
          return relationKeys.map((relationData) => ({
            [foreignKey]: selfKey,
            [associationForeignKey]: relationData[associationPrimaryKey],
          }));
        }),
      );
    }) as HasManyNestedInsert,
    joinQuery: query.whereExists(subQuery, (q) =>
      q
        .on(associationForeignKeyFull, associationPrimaryKeyFull)
        .on(foreignKeyFull, primaryKeyFull),
    ),
    primaryKey,
  };
};
