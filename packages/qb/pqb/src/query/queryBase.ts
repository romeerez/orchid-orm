import { Query, QueryReturnType, SelectableBase, WithDataBase } from './query';
import { QueryData } from '../sql';
import {
  ColumnsShapeBase,
  EmptyObject,
  QueryBaseCommon,
  QueryInternal,
  QueryMetaBase,
  RecordKeyTrue,
} from 'orchid-core';
import { RelationsBase } from '../relations';
import { getClonedQueryData } from '../common/utils';

export abstract class QueryBase<Scopes extends RecordKeyTrue = EmptyObject>
  implements QueryBaseCommon<Scopes>
{
  /**
   * Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.
   *
   * Used under the hood, and not really needed on the app side.
   */
  clone<T extends QueryBase<Scopes>>(this: T): T {
    const cloned = Object.create(this.baseQuery);
    cloned.q = getClonedQueryData(this.q);
    return cloned;
  }
  abstract result: ColumnsShapeBase;
  q = {} as QueryData;
  table?: string;
  selectable!: SelectableBase;
  shape!: ColumnsShapeBase;
  relations!: RelationsBase;
  withData!: WithDataBase;
  baseQuery!: Query;
  internal!: QueryInternal;
  meta!: QueryMetaBase<Scopes>;
  returnType!: QueryReturnType;
}
