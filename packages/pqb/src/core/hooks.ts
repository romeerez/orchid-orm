import {
  IsQuery,
  pushQueryValueImmutable,
  QueryOrExpression,
} from './query/query';
import { RecordUnknown } from './utils';
import { PickQueryInputType } from './query/pick-query-types';

export class QueryHookUtils<T extends PickQueryInputType> {
  constructor(
    public query: IsQuery,
    public columns: string[],
    private key: 'hookCreateSet' | 'hookUpdateSet',
  ) {}

  set = (data: {
    [K in keyof T['inputType']]?:
      | T['inputType'][K]
      | (() => QueryOrExpression<T['inputType'][K]>);
  }) => {
    const set: RecordUnknown = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        set[key] = data[key];
      }
    }
    pushQueryValueImmutable(this.query, this.key, set);
  };
}
