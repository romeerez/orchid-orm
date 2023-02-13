import { Query, SetQueryTableAlias } from '../query';
import { SelectQueryData } from '../sql';
import { AliasOrTable } from '../utils';
import { isRaw, RawExpression } from '../../../common/src/raw';

type FromArgs<T extends Query> = [
  first: Query | RawExpression | Exclude<keyof T['withData'], symbol | number>,
  second?: { only?: boolean },
];

type FromResult<
  T extends Query,
  Args extends FromArgs<T>,
> = Args[0] extends string
  ? SetQueryTableAlias<T, Args[0]>
  : Args[0] extends Query
  ? SetQueryTableAlias<
      Omit<T, 'selectable'> & {
        selectable: {
          [K in keyof Args[0]['result']]: K extends string
            ? {
                as: K;
                column: Args[0]['result'][K];
              }
            : never;
        };
      },
      AliasOrTable<Args[0]>
    >
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
    if (typeof args[0] === 'string') {
      if (!this.query.as) as = args[0];
    } else if (!isRaw(args[0] as RawExpression)) {
      as = (args[0] as Query).query.as || (args[0] as Query).table;
    }

    if (args[1]?.only) {
      (this.query as SelectQueryData).fromOnly = args[1].only;
    }

    const q = as ? this._as(as) : this;
    q.query.from = args[0];
    return q as unknown as FromResult<T, Args>;
  }
}
