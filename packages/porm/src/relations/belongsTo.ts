import { RelationThunk } from './relations';
import { Query, pushQueryValue, QueryWithTable } from 'pqb';
import { ModelClass, PostgresModel } from '../model';

export class BelongsTo<
  This extends PostgresModel = PostgresModel,
  RelatedModel extends ModelClass = ModelClass,
  Options extends {
    primaryKey: keyof InstanceType<RelatedModel>['shape'];
    foreignKey: keyof This['shape'];
  } = {
    primaryKey: string;
    foreignKey: string;
  },
> implements RelationThunk<'belongsTo', RelatedModel, Options>
{
  type = 'belongsTo' as const;
  constructor(public fn: () => RelatedModel, public options: Options) {}

  applyToModel(target: Query, query: QueryWithTable, key: string) {
    const primaryKey = this.options?.primaryKey || target.schema.primaryKeys[0];
    const foreignKey = this.options?.foreignKey || `${query.table}Id`;

    (target as unknown as Record<string, unknown>)[key] = (
      params: Record<typeof foreignKey, unknown>,
    ) => {
      return query.findBy({
        [primaryKey]: params[foreignKey],
      });
    };

    const joinQuery = query.clone();
    pushQueryValue(joinQuery, 'and', [foreignKey, '=', primaryKey]);

    (target.relations as Record<string, unknown>)[key] = {
      key,
      type: this.type,
      query,
      options: this.options,
      joinQuery,
    };
  }
}
