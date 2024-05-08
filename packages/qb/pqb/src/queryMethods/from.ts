import {
  Query,
  SelectableFromShape,
  SetQueryTableAlias,
  WithDataItems,
  PickQueryQ,
  PickQueryMetaTableShapeReturnTypeWithData,
  GetQueryResult,
} from '../query/query';
import { SelectQueryData } from '../sql';
import { AliasOrTable } from '../common/utils';
import {
  QueryThen,
  ColumnsShapeBase,
  PickQueryTableMetaResult,
  SQLQueryArgs,
  isExpression,
  Expression,
} from 'orchid-core';
import { getShapeFromSelect } from './select';
import { QueryBase } from '../query/queryBase';
import { sqlQueryArgsToExpression } from '../sql/rawSql';

export type FromQuerySelf = PickQueryMetaTableShapeReturnTypeWithData;

export type FromArg<T extends FromQuerySelf> =
  | PickQueryTableMetaResult
  | Expression
  | Exclude<keyof T['withData'], symbol | number>;

export interface FromArgOptions {
  only?: boolean;
}

export type FromResult<
  T extends FromQuerySelf,
  Arg extends FromArg<T>,
> = Arg extends string
  ? T['withData'] extends WithDataItems
    ? Arg extends keyof T['withData']
      ? {
          [K in keyof T]: K extends 'meta'
            ? {
                [K in keyof T['meta']]: K extends 'as'
                  ? string | undefined
                  : K extends 'selectable'
                  ? SelectableFromShape<T['withData'][Arg]['shape'], Arg>
                  : T['meta'][K];
              }
            : T[K];
        }
      : SetQueryTableAlias<T, Arg>
    : SetQueryTableAlias<T, Arg>
  : Arg extends PickQueryTableMetaResult
  ? {
      [K in keyof T]: K extends 'meta'
        ? {
            [K in keyof T['meta']]: K extends 'hasSelect'
              ? undefined
              : K extends 'as'
              ? AliasOrTable<Arg>
              : K extends 'selectable'
              ? {
                  [K in keyof Arg['result']]: K extends string
                    ? {
                        as: K;
                        column: Arg['result'][K];
                      }
                    : never;
                }
              : T['meta'][K];
          }
        : K extends 'result'
        ? Arg['result']
        : K extends 'shape'
        ? Arg['result']
        : K extends 'then'
        ? QueryThen<GetQueryResult<T, Arg['result']>>
        : T[K];
    }
  : T;

export function queryFrom<T extends FromQuerySelf, Arg extends FromArg<T>>(
  self: T,
  arg: Arg,
  options?: FromArgOptions,
): FromResult<T, Arg> {
  const data = (self as unknown as PickQueryQ).q;
  if (typeof arg === 'string') {
    data.as ||= arg;
  } else if (!isExpression(arg)) {
    const q = arg as Query;
    data.as ||= q.q.as || q.table || 't';
    data.shape = getShapeFromSelect(arg as QueryBase, true) as ColumnsShapeBase;
    data.parsers = q.q.parsers;
  } else {
    data.as ||= 't';
  }

  if (options?.only) {
    (data as SelectQueryData).fromOnly = options.only;
  }

  data.from = arg as Query;

  return self as never;
}

export function queryFromSql<T extends FromQuerySelf>(
  self: T,
  args: SQLQueryArgs,
): T {
  const data = (self as unknown as PickQueryQ).q;
  data.as ||= 't';
  data.from = sqlQueryArgsToExpression(args);
  return self;
}

export class From {
  /**
   * Set the `FROM` value, by default the table name is used.
   *
   * ```ts
   * // accepts sub-query:
   * db.table.from(Otherdb.table.select('foo', 'bar'));
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
   * @param arg - query or name of CTE table
   * @param options - { only: true } for SQL `ONLY` keyword
   */
  from<T extends FromQuerySelf, Arg extends FromArg<T>>(
    this: T,
    arg: Arg,
    options?: FromArgOptions,
  ): FromResult<T, Arg> {
    return queryFrom(
      (this as unknown as Query).clone(),
      arg as never,
      options,
    ) as never;
  }

  /**
   * Set the `FROM` value with custom SQL:
   *
   * ```ts
   * const value = 123;
   * db.table.from`value = ${value}`;
   * db.table.from(db.table.sql`value = ${value}`);
   * ```
   *
   * @param args - SQL expression
   */
  fromSql<T extends FromQuerySelf, Arg extends FromArg<T>>(
    this: T,
    ...args: SQLQueryArgs
  ): FromResult<T, Arg> {
    return queryFromSql(
      (this as unknown as Query).clone(),
      args as never,
    ) as never;
  }
}
