import { Query, SelectableFromShape, PickQueryQ } from '../query/query';
import { WithConfigs } from '../sql';
import {
  PickQueryTableMetaResult,
  SQLQueryArgs,
  isExpression,
  Expression,
  MaybeArray,
  PickQueryTableMetaResultInputType,
  ColumnsParsers,
  QueryThenByQuery,
  UnionToIntersection,
  WithDataItems,
  PickQueryMetaTableShapeReturnTypeWithData,
  SetQueryTableAlias,
  AliasOrTable,
} from 'orchid-core';
import { getShapeFromSelect } from './select';
import { sqlQueryArgsToExpression } from '../sql/rawSql';
import { addColumnParserToQuery, anyShape, ColumnsShape } from '../columns';
import { _clone } from '../query/queryUtils';

export type FromQuerySelf = PickQueryMetaTableShapeReturnTypeWithData;

export type FromArg<T extends FromQuerySelf> =
  | PickQueryTableMetaResult
  | Expression
  | Exclude<keyof T['withData'], symbol | number>;

export type FromResult<
  T extends FromQuerySelf,
  Arg extends MaybeArray<FromArg<T>>,
> = Arg extends string
  ? T['withData'] extends WithDataItems
    ? {
        [K in keyof T]: K extends 'meta'
          ? {
              [K in keyof T['meta']]: K extends 'as'
                ? string | undefined
                : K extends 'selectable'
                ? SelectableFromShape<T['withData'][Arg]['shape'], Arg>
                : K extends 'kind'
                ? 'select'
                : T['meta'][K];
            }
          : K extends 'result'
          ? T['withData'][Arg]['shape']
          : K extends 'then'
          ? QueryThenByQuery<T, T['withData'][Arg]['shape']>
          : T[K];
      }
    : SetQueryTableAlias<T, Arg>
  : Arg extends PickQueryTableMetaResultInputType
  ? {
      [K in keyof T]: K extends 'meta'
        ? {
            [K in keyof T['meta']]: K extends 'as'
              ? AliasOrTable<Arg>
              : K extends 'selectable'
              ? SelectableFromShape<Arg['result'], AliasOrTable<Arg>>
              : K extends 'kind'
              ? 'select'
              : K extends 'defaultSelect'
              ? keyof Arg['result']
              : T['meta'][K];
          }
        : K extends 'result'
        ? Arg['result']
        : K extends 'shape'
        ? Arg['result']
        : K extends 'inputType'
        ? Arg['inputType']
        : K extends 'then'
        ? QueryThenByQuery<T, Arg['result']>
        : T[K];
    }
  : Arg extends (infer A)[]
  ? {
      [K in keyof T]: K extends 'meta'
        ? {
            [K in keyof T['meta']]: K extends 'selectable'
              ? UnionToIntersection<
                  A extends string
                    ? T['withData'] extends WithDataItems
                      ? {
                          [K in keyof T['withData'][A]['shape'] &
                            string as `${A}.${K}`]: {
                            as: K;
                            column: T['withData'][A]['shape'][K];
                          };
                        }
                      : never
                    : A extends PickQueryTableMetaResult
                    ? {
                        [K in keyof A['result'] &
                          string as `${AliasOrTable<A>}.${K}`]: K extends string
                          ? {
                              as: K;
                              column: A['result'][K];
                            }
                          : never;
                      }
                    : never
                >
              : T['meta'][K];
          }
        : T[K];
    }
  : T;

export function queryFrom<
  T extends FromQuerySelf,
  Arg extends MaybeArray<FromArg<T>>,
>(self: T, arg: Arg): FromResult<T, Arg> {
  const data = (self as unknown as PickQueryQ).q;
  if (typeof arg === 'string') {
    data.as ||= arg;
    const w = data.withShapes?.[arg];
    data.shape = (w?.shape ?? anyShape) as ColumnsShape;
    data.computeds = w?.computeds;
  } else if (isExpression(arg)) {
    data.as ||= 't';
  } else if (Array.isArray(arg)) {
    const { shape } = data;
    let clonedParsers = false;
    // TODO: batchParsers
    for (const item of arg) {
      if (typeof item === 'string') {
        const w = (data.withShapes as WithConfigs)[item];

        Object.assign(shape, w.shape);
        if (w.computeds) data.computeds = { ...data.computeds, ...w.computeds };

        for (const key in w.shape) {
          addColumnParserToQuery(
            self as { parsers?: ColumnsParsers },
            key,
            w.shape[key],
          );
        }
      } else if (!isExpression(item)) {
        Object.assign(shape, getShapeFromSelect(item, true));

        if (!clonedParsers) {
          data.parsers = { ...data.parsers };
          clonedParsers = true;
        }

        Object.assign(data.parsers!, item.q.parsers);
      }
    }
  } else {
    const q = arg as Query;
    data.as ||= q.q.as || q.table || 't';
    data.shape = getShapeFromSelect(q, true) as ColumnsShape;
    data.parsers = q.q.parsers;
    data.batchParsers = q.q.batchParsers;
  }

  data.from = arg as Query;
  data.selectAllColumns = data.scopes = undefined;

  return self as never;
}

export function queryFromSql<T extends FromQuerySelf>(
  self: T,
  args: SQLQueryArgs,
): T {
  const data = (self as unknown as PickQueryQ).q;
  data.as ||= 't';
  data.from = sqlQueryArgsToExpression(args);
  data.selectAllColumns = undefined;
  return self;
}

export class FromMethods {
  /**
   * Set the `FROM` value, by default the table name is used.
   *
   * `from` determines a set of available tables and columns withing the query,
   * and thus it must not follow `select`, use `select` only after `from`.
   *
   * ```ts
   * // accepts sub-query:
   * db.table.from(db.otherTable.select('foo', 'bar'));
   *
   * // accepts alias of `WITH` expression:
   * q.with('withTable', db.table.select('id', 'name'))
   *   .from('withTable')
   *   // `select` is after `from`
   *   .select('id', 'name');
   * ```
   *
   * `from` can accept multiple sources:
   *
   * ```ts
   * db.table
   *   // add a `WITH` statement called `withTable
   *   .with('withTable', db.table.select('one'))
   *   // select from `withTable` and from `otherTable`
   *   .from('withTable', db.otherTable.select('two'))
   *   // source names and column names are properly typed when selecting
   *   .select('withTable.one', 'otherTable.two');
   * ```
   *
   * @param arg - query or name of CTE table
   */
  from<T extends FromQuerySelf, Arg extends MaybeArray<FromArg<T>>>(
    this: T,
    arg: T['meta']['hasSelect'] extends true
      ? '`select` must be placed after `from`'
      : Arg,
  ): FromResult<T, Arg> {
    return queryFrom(_clone(this), arg as never) as never;
  }

  /**
   * Set the `FROM` value with custom SQL:
   *
   * ```ts
   * const value = 123;
   * db.table.fromSql`value = ${value}`;
   * ```
   *
   * @param args - SQL expression
   */
  fromSql<T extends FromQuerySelf>(this: T, ...args: SQLQueryArgs): T {
    return queryFromSql(_clone(this), args as never) as never;
  }

  /**
   * Adds `ONLY` SQL keyword to the `FROM`.
   * When selecting from a parent table that has a table inheritance,
   * setting `only` will make it to select rows only from the parent table.
   *
   * ```ts
   * db.table.only();
   *
   * // disabling `only` after being enabled
   * db.table.only().only(false);
   * ```
   *
   * @param only - can be disabled by passing `false` if was enabled previously.
   */
  only<T>(this: T, only = true): T {
    const q = _clone(this);
    q.q.only = only;
    return q as T;
  }
}
