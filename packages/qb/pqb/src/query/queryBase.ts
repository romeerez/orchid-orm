import { Query, QueryReturnType, WithDataBase } from './query';
import { QueryData } from '../sql';
import {
  EmptyObject,
  QueryBaseCommon,
  QueryInternal,
  QueryMetaBase,
  QueryColumns,
  RecordKeyTrue,
} from 'orchid-core';
import { RelationsBase } from '../relations';
import { getClonedQueryData } from '../common/utils';

export type CloneSelfKeys = 'clone' | 'baseQuery' | 'q';

export abstract class QueryBase<Scopes extends RecordKeyTrue = EmptyObject>
  implements QueryBaseCommon<Scopes>
{
  /**
   * Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.
   *
   * Used under the hood, and not really needed on the app side.
   */
  clone<T extends Pick<QueryBase, 'baseQuery' | 'q'>>(this: T): T {
    const cloned = Object.create(this.baseQuery);
    cloned.q = getClonedQueryData(this.q);
    return cloned;
  }
  abstract result: QueryColumns;
  __isQuery!: true;
  q = {} as QueryData;
  table?: string;
  shape!: QueryColumns;
  relations!: RelationsBase;
  withData!: WithDataBase;
  baseQuery!: Query;
  internal!: QueryInternal;
  meta!: QueryMetaBase<Scopes>;
  returnType!: QueryReturnType;
}
