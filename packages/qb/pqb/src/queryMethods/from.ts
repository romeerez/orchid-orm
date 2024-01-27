import {
  Query,
  GetQueryResult,
  SelectableBase,
  SelectableFromShape,
  SetQueryTableAlias,
  WithDataItem,
} from '../query/query';
import { SelectQueryData } from '../sql';
import { AliasOrTable } from '../common/utils';
import {
  QueryCatch,
  QueryThen,
  Expression,
  TemplateLiteralArgs,
  isExpression,
  ColumnsShapeBase,
} from 'orchid-core';
import { getShapeFromSelect } from './select';
import { RawSQL } from '../sql/rawSql';
import { QueryBase } from '../query/queryBase';

export type FromQuerySelf = Pick<
  Query,
  | 'withData'
  | 'meta'
  | 'selectable'
  | 'table'
  | 'returnType'
  | 'clone'
  | 'baseQuery'
  | 'q'
  | 'shape'
>;

export type FromQueryArg = Pick<Query, 'result' | 'table' | 'meta' | 'q'>;

export type FromArgs<T extends FromQuerySelf> =
  | [
      first:
        | FromQueryArg
        | Expression
        | Exclude<keyof T['withData'], symbol | number>,
      second?: { only?: boolean },
    ]
  | TemplateLiteralArgs;

export type FromResult<
  T extends FromQuerySelf,
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
  : Args[0] extends FromQueryArg
  ? FromQueryResult<T, Args[0]>
  : T;

type FromQueryResult<
  T extends FromQuerySelf,
  Q extends FromQueryArg,
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
    : K extends 'result'
    ? Q['result']
    : K extends 'shape'
    ? Q['result']
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

export function queryFrom<T extends FromQuerySelf, Args extends FromArgs<T>>(
  self: T,
  args: Args,
): FromResult<T, Args> {
  if (Array.isArray(args[0])) {
    return queryFrom(self, [
      new RawSQL(args as TemplateLiteralArgs),
    ]) as FromResult<T, Args>;
  }

  if (typeof args[0] === 'string') {
    self.q.as ||= args[0];
  } else if (!isExpression(args[0])) {
    const q = args[0] as FromQueryArg;
    self.q.as ||= q.q.as || q.table || 't';
    self.q.shape = getShapeFromSelect(
      args[0] as QueryBase,
      true,
    ) as ColumnsShapeBase;
    self.q.parsers = q.q.parsers;
  } else {
    self.q.as ||= 't';
  }

  const options = args[1] as { only?: boolean } | undefined;
  if (options?.only) {
    (self.q as SelectQueryData).fromOnly = options.only;
  }

  self.q.from = args[0] as Query;

  return self as unknown as FromResult<T, Args>;
}

export class From {
  /**
   * Set the `FROM` value, by default the table name is used.
   *
   * ```ts
   * // accepts sub-query:
   * db.table.from(Otherdb.table.select('foo', 'bar'));
   *
   * // accepts raw sql by template literal:
   * const value = 123;
   * db.table.from`value = ${value}`;
   *
   * // accepts raw sql:
   * db.table.from(db.table.sql`value = ${value}`);
   *
   * // accepts alias of `WITH` expression:
   * q.with('foo', Otherdb.table.select('id', 'name')).from('foo');
   * ```
   *
   * Optionally takes a second argument of type `{ only?: boolean }`, (see `FROM ONLY` in Postgres docs, this is related to table inheritance).
   *
   * ```ts
   * db.table.from(Otherdb.table.select('foo', 'bar'), {
   *   only: true,
   * });
   * ```
   *
   * @param args - query, raw SQL, name of CTE table, or a template string
   */
  from<T extends FromQuerySelf, Args extends FromArgs<T>>(
    this: T,
    ...args: Args
  ): FromResult<T, Args> {
    return queryFrom(this.clone(), args);
  }
}
