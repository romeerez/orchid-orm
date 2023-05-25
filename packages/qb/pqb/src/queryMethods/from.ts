import {
  Query,
  GetQueryResult,
  SelectableBase,
  SelectableFromShape,
  SetQueryTableAlias,
  WithDataItem,
} from '../query';
import { SelectQueryData } from '../sql';
import { AliasOrTable } from '../utils';
import { isRaw, QueryCatch, QueryThen, raw, RawExpression } from 'orchid-core';
import { getShapeFromSelect } from './select';

export type FromArgs<T extends Query> =
  | [
      first:
        | Query
        | RawExpression
        | Exclude<keyof T['withData'], symbol | number>,
      second?: { only?: boolean },
    ]
  | [TemplateStringsArray, ...unknown[]];

export type FromResult<
  T extends Query,
  Args extends FromArgs<T>,
> = Args extends TemplateStringsArray
  ? T
  : Args[0] extends string
  ? T['withData'] extends Record<string, WithDataItem>
    ? Args[0] extends keyof T['withData']
      ? Omit<T, 'meta' | 'selectable'> & {
          meta: Omit<T['meta'], 'as'> & {
            as?: string;
          };
          selectable: SelectableFromShape<
            T['withData'][Args[0]]['shape'],
            Args[0]
          >;
        }
      : SetQueryTableAlias<T, Args[0]>
    : SetQueryTableAlias<T, Args[0]>
  : Args[0] extends Query
  ? FromQueryResult<T, Args[0]>
  : T;

type FromQueryResult<
  T extends Query,
  Q extends Query,
  Selectable extends SelectableBase = {
    [K in keyof Q['result']]: K extends string
      ? {
          as: K;
          column: Q['result'][K];
        }
      : never;
  },
  Data = GetQueryResult<T['returnType'], Q['result']>,
> = {
  [K in keyof T]: K extends 'meta'
    ? Omit<T['meta'], 'hasSelect' | 'as'> & { as: AliasOrTable<Q> }
    : K extends 'selectable'
    ? Selectable
    : K extends 'result' | 'shape'
    ? Q['result']
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

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
    if (Array.isArray(args[0])) {
      return this._from(
        raw(args as [TemplateStringsArray, ...unknown[]]),
      ) as FromResult<T, Args>;
    }

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

    const options = args[1] as { only?: boolean } | undefined;
    if (options?.only) {
      (this.query as SelectQueryData).fromOnly = options.only;
    }

    this.query.from = args[0] as Query;

    return this as unknown as FromResult<T, Args>;
  }
}
