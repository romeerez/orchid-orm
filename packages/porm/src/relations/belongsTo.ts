import { RelationThunk } from './relations';
import { Query, pushQueryValue, QueryWithTable } from 'pqb';

export class BelongsTo<
  T extends Query,
  Q extends QueryWithTable,
  Options extends {
    primaryKey: keyof Q['shape'];
    foreignKey: keyof T['shape'];
  },
> implements RelationThunk<'belongsTo', Q, Options>
{
  type = 'belongsTo' as const;
  constructor(public fn: () => Q, public options: Options) {}

  applyToModel(target: Query, query: QueryWithTable, key: string) {
    const primaryKey = this.options?.primaryKey || target.primaryKeys[0];
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
