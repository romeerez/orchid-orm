import {
  AddQuerySelect,
  Query,
  SelectableFromShape,
  SetQueryTableAlias,
  WithDataItem,
} from '../query';
import { SelectQueryData } from '../sql';
import { AliasOrTable } from '../utils';
import { isRaw, RawExpression } from 'orchid-core';
import { getShapeFromSelect } from './select';

export type FromArgs<T extends Query> = [
  first: Query | RawExpression | Exclude<keyof T['withData'], symbol | number>,
  second?: { only?: boolean },
];

type SetFromSelectable<T extends Query, Arg extends Query> = Omit<
  T,
  'selectable'
> & {
  selectable: {
    [K in keyof Arg['result']]: K extends string
      ? {
          as: K;
          column: Arg['result'][K];
        }
      : never;
  };
};

type MergeFromResult<T extends Query, Arg extends Query> = AddQuerySelect<
  Omit<T, 'result'> & {
    result: Pick<T['result'], keyof Arg['result']>;
  },
  Arg['result']
>;

export type FromResult<
  T extends Query,
  Args extends FromArgs<T>,
  Arg = Args[0],
> = Arg extends string
  ? T['withData'] extends Record<string, WithDataItem>
    ? Arg extends keyof T['withData']
      ? Omit<T, 'meta' | 'selectable'> & {
          meta: Omit<T['meta'], 'as'> & {
            as?: string;
          };
          selectable: SelectableFromShape<T['withData'][Arg]['shape'], Arg>;
        }
      : SetQueryTableAlias<T, Arg>
    : SetQueryTableAlias<T, Arg>
  : Arg extends Query
  ? SetQueryTableAlias<
      MergeFromResult<SetFromSelectable<T, Arg>, Arg>,
      AliasOrTable<Arg>
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
    if (typeof args[0] === 'string') {
      this.query.as ||= args[0];
    } else if (!isRaw(args[0] as RawExpression)) {
      const q = args[0] as Query;
      this.query.as ||= q.query.as || q.table || 't';
      this.query.shape = getShapeFromSelect(args[0] as Query, true);
      this.query.parsers = q.query.parsers;
    } else {
      this.query.as ||= 't';
    }

    if (args[1]?.only) {
      (this.query as SelectQueryData).fromOnly = args[1].only;
    }

    this.query.from = args[0];

    return this as unknown as FromResult<T, Args>;
  }
}
