import { RelationThunk } from './relations';
import { Query } from '../../../queryBuilder/src/query';
import { pushQueryValue } from '../../../queryBuilder/src/queryDataUtils';

export class BelongsTo<
  T extends Query,
  Q extends Query,
  Options extends {
    primaryKey: keyof Q['type'];
    foreignKey: keyof T['type'];
  },
> implements RelationThunk<'belongsTo', Q, Options>
{
  type = 'belongsTo' as const;
  constructor(public fn: () => Q, public options: Options) {}

  applyToModel(target: Query, query: Query, key: string) {
    const primaryKey = this.options?.primaryKey || target.primaryKeys[0];
    const foreignKey = this.options?.foreignKey || `${query.table}Id`;

    target[key as keyof Query] = (
      params: Record<Options['foreignKey'], Q['type'][Options['primaryKey']]>,
    ) => {
      return query.findBy({
        [primaryKey]: params[foreignKey],
      });
    };

    const joinQuery = query.clone();
    pushQueryValue(joinQuery, 'and', [foreignKey, '=', primaryKey]);

    target.relations[key] = {
      key,
      type: this.type,
      query,
      options: this.options,
      joinQuery,
    };
  }
}
