import { pushQueryOn, Query } from 'pqb';
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
  _model: Query,
  relation: HasOne,
  query: Query,
): RelationData => {
  if ('through' in relation.options) {
    return {
      method: () => query,
      joinQuery: query,
    };
    //   const { through, source } = relation.options;
    //
    //   return (params: Record<string, unknown>) => {
    //     type ModelWithQueryMethod = Record<
    //       string,
    //       (params: Record<string, unknown>) => Query
    //     >;
    //
    //     const query1 = (model as unknown as ModelWithQueryMethod)[through](
    //       params,
    //     );
    //     console.log(query1.toSql().text);
    //
    //     const query2 = (query1.__model as unknown as ModelWithQueryMethod)[
    //       source
    //     ];
    //
    //     console.log(query2);
    //   };
  }

  const { primaryKey, foreignKey } = relation.options;

  return {
    method: (params: Record<string, unknown>) => {
      return query.findBy({ [foreignKey]: params[primaryKey] });
    },
    joinQuery: pushQueryOn(query, foreignKey, primaryKey),
  };
};
