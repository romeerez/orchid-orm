import { Query, SetQueryTableAlias } from '../query';
import { AliasOrTable, isRaw, RawExpression } from '../common';
import { SelectQueryData } from '../sql';

type FromArgs<T extends Query> = [
  first:
    | string
    | Query
    | RawExpression
    | Exclude<keyof T['withData'], symbol | number>,
  second?: string | { as?: string; only?: boolean },
];

type FromResult<
  T extends Query,
  Args extends FromArgs<T>,
> = Args[1] extends string
  ? SetQueryTableAlias<T, Args[1]>
  : Args[1] extends { as: string }
  ? SetQueryTableAlias<T, Args[1]['as']>
  : Args[0] extends string
  ? SetQueryTableAlias<T, Args[0]>
  : Args[0] extends Query
  ? SetQueryTableAlias<T, AliasOrTable<Args[0]>>
  : T;

export class From {
  from<T extends Query, Args extends FromArgs<T>>(
    this: T,
    ...args: Args
  ): FromResult<T, Args> {
    return this.clone()._from(...args) as FromResult<T, Args>;
  }

  _from<T extends Query, Args extends FromArgs<T>>(
    this: T,
    ...args: Args
  ): FromResult<T, Args> {
    let as: string | undefined;
    if (typeof args[1] === 'string') {
      as = args[1];
    } else if (typeof args[1] === 'object' && args[1].as) {
      as = args[1].as;
    } else if (typeof args[0] === 'string') {
      if (!this.query.as) as = args[0];
    } else if (!isRaw(args[0] as RawExpression)) {
      as = (args[0] as Query).query.as || (args[0] as Query).table;
    }

    if (typeof args[1] === 'object' && 'only' in args[1]) {
      (this.query as SelectQueryData).fromOnly = args[1].only;
    }

    const q = as ? this._as(as) : this;
    q.query.from = args[0];
    return q as unknown as FromResult<T, Args>;
  }
}
