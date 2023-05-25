import { Query, SelectableBase, WithDataBase } from './query';
import { QueryData } from './sql';
import {
  ColumnsShapeBase,
  QueryBaseCommon,
  QueryInternal,
  QueryMetaBase,
} from 'orchid-core';
import { RelationsBase } from './relations';
import { getClonedQueryData } from './utils';

export abstract class QueryBase implements QueryBaseCommon {
  clone<T extends QueryBase>(this: T): T {
    const cloned = Object.create(this.baseQuery);
    cloned.query = getClonedQueryData(this.query);
    return cloned;
  }
  abstract result: ColumnsShapeBase;
  query = {} as QueryData;
  table?: string;
  selectable!: SelectableBase;
  shape!: ColumnsShapeBase;
  relations!: RelationsBase;
  withData!: WithDataBase;
  baseQuery!: Query;
  internal!: QueryInternal;
  meta!: QueryMetaBase;
}
