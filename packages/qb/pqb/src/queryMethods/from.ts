import {
  Query,
  GetQueryResult,
  SelectableFromShape,
  SetQueryTableAlias,
  WithDataItems,
  PickQueryQ,
  PickQueryMetaTableShapeReturnTypeWithData,
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
  PickQueryTableMetaResult,
} from 'orchid-core';
import { getShapeFromSelect } from './select';
import { RawSQL } from '../sql/rawSql';
import { QueryBase } from '../query/queryBase';

export type FromQuerySelf = PickQueryMetaTableShapeReturnTypeWithData;

export type FromArgs<T extends FromQuerySelf> =
  | [
      first:
        | PickQueryTableMetaResult
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
  ? T['withData'] extends WithDataItems
    ? Args[0] extends keyof T['withData']
      ? {
          [K in keyof T]: K extends 'meta'
            ? {
                [K in keyof T['meta']]: K extends 'as'
                  ? string | undefined
                  : K extends 'selectable'
                  ? SelectableFromShape<
                      T['withData'][Args[0]]['shape'],
                      Args[0]
                    >
                  : T['meta'][K];
              }
            : T[K];
        }
      : SetQueryTableAlias<T, Args[0]>
    : SetQueryTableAlias<T, Args[0]>
  : Args[0] extends PickQueryTableMetaResult
  ? {
      [K in keyof T]: K extends 'meta'
        ? {
            [K in keyof T['meta']]: K extends 'hasSelect'
              ? undefined
              : K extends 'as'
              ? AliasOrTable<Args[0]>
              : K extends 'selectable'
              ? {
                  [K in keyof Args[0]['result']]: K extends string
                    ? {
                        as: K;
                        column: Args[0]['result'][K];
                      }
                    : never;
                }
              : T['meta'][K];
          }
        : K extends 'result'
        ? Args[0]['result']
        : K extends 'shape'
        ? Args[0]['result']
        : K extends 'then'
        ? QueryThen<GetQueryResult<T['returnType'], Args[0]['result']>>
        : K extends 'catch'
        ? QueryCatch<GetQueryResult<T['returnType'], Args[0]['result']>>
        : T[K];
    }
  : T;

export function queryFrom<T extends FromQuerySelf, Args extends FromArgs<T>>(
  self: T,
  args: Args,
): FromResult<T, Args> {
  if (Array.isArray(args[0])) {
    return queryFrom(self, [
      new RawSQL(args as TemplateLiteralArgs),
    ]) as FromResult<T, Args>;
  }

  const data = (self as unknown as PickQueryQ).q;
  if (typeof args[0] === 'string') {
    data.as ||= args[0];
  } else if (!isExpression(args[0])) {
    const q = args[0] as Query;
    data.as ||= q.q.as || q.table || 't';
    data.shape = getShapeFromSelect(
      args[0] as QueryBase,
      true,
    ) as ColumnsShapeBase;
    data.parsers = q.q.parsers;
  } else {
    data.as ||= 't';
  }

  const options = args[1] as { only?: boolean } | undefined;
  if (options?.only) {
    (data as SelectQueryData).fromOnly = options.only;
  }

  data.from = args[0] as Query;

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
    return queryFrom(
      (this as unknown as Query).clone(),
      args as never,
    ) as never;
  }
}
