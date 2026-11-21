import { IsQuery, Query, SelectableFromShape } from '../../query';
import { sqlQueryArgsToExpression } from '../../expressions/raw-sql';
import {
  anyShape,
  Column,
  ColumnsShape,
  setColumnData,
} from '../../../columns';
import {
  prepareSubQueryForSql,
  SubQueryForSql,
} from '../../internal-features/sub-query/sub-query-for-sql';
import {
  PickQueryAs,
  PickQueryHasSelect,
  PickQueryResultAs,
  PickQuerySelectableResultInputTypeAs,
  PickQueryQ,
  PickQueryReturnType,
  PickQuerySelectable,
  PickQueryShape,
  PickQueryWithData,
  PickQueryColumTypes,
  PickQueryTable,
} from '../../pick-query-types';
import { MaybeArray, UnionToIntersection } from '../../../utils';
import { getQueryAs, SetQueryTableAlias } from '../as/as';
import {
  ColumnsParsers,
  getQueryParsers,
} from '../../query-columns/query-column-parsers';
import { Expression, isExpression } from '../../expressions/expression';
import { _clone } from '../clone/clone';
import { getOutputShape, getShapeFromSelect } from '../select/select.utils';
import { WithDataItems } from '../cte/cte.sql';
import { SQLQueryArgs } from '../../db-sql-query';
import { JoinedParsers, WithConfig, WithConfigs } from '../../query-data';
import { QueryThenByQuery } from '../../then/then';
import { FromSqlWithColumns } from './from-expression.sql';

export interface FromQuerySelf
  extends
    PickQuerySelectable,
    PickQueryShape,
    PickQueryReturnType,
    PickQueryWithData,
    PickQueryAs,
    PickQueryHasSelect {}

export type FromArg<T extends FromQuerySelf> =
  | IsQuery
  | Exclude<keyof T['withData'], symbol | number>;

export type FromResult<
  T extends FromQuerySelf,
  Arg extends MaybeArray<FromArg<T>>,
> = Arg extends string
  ? T['withData'] extends WithDataItems
    ? {
        [K in keyof T]: K extends '__selectable'
          ? SelectableFromShape<T['withData'][Arg]['shape'], Arg>
          : K extends 'result'
            ? T['withData'][Arg]['shape']
            : K extends 'then'
              ? QueryThenByQuery<T, T['withData'][Arg]['shape']>
              : T[K];
      }
    : SetQueryTableAlias<T, Arg>
  : Arg extends PickQuerySelectableResultInputTypeAs
    ? {
        [K in keyof T]: K extends '__defaultSelect'
          ? keyof Arg['result']
          : K extends '__selectable'
            ? SelectableFromShape<Arg['result'], Arg['__as']>
            : K extends '__as'
              ? Arg['__as']
              : K extends 'result'
                ? Arg['result']
                : K extends 'shape'
                  ? Arg['result']
                  : K extends '__inputType'
                    ? Arg['__inputType']
                    : K extends 'then'
                      ? QueryThenByQuery<T, Arg['result']>
                      : T[K];
      }
    : Arg extends (infer A)[]
      ? {
          [K in keyof T]: K extends '__selectable'
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
                  : A extends PickQueryResultAs
                    ? {
                        [K in keyof A['result'] &
                          string as `${A['__as']}.${K}`]: K extends string
                          ? {
                              as: K;
                              column: A['result'][K];
                            }
                          : never;
                      }
                    : never
              >
            : T[K];
        }
      : T;

const addWithParsers = (w: WithConfig, parsers: ColumnsParsers) => {
  for (const key in w.shape) {
    const { _parse } = w.shape[key] as Column;
    if (_parse) parsers[key] = _parse;
  }
};

export function queryFrom<
  T extends FromQuerySelf,
  Arg extends MaybeArray<FromArg<T>>,
>(self: T, arg: Arg): FromResult<T, Arg> {
  const data = (self as unknown as PickQueryQ).q;
  if (typeof arg === 'string') {
    data.as ||= arg;
    const w = data.withShapes?.[arg];
    data.selectShape = data.selectAllShape = (w?.shape ??
      anyShape) as ColumnsShape;
    data.runtimeComputeds = w?.computeds;

    const parsers: ColumnsParsers = {};
    data.defaultParsers = parsers;
    if (w) addWithParsers(w, parsers);

    const i = arg.indexOf('.');
    if (i !== -1) {
      data.schema = arg.slice(0, i);
      arg = arg.slice(i + 1) as Arg;
    } else if (w) {
      data.schema = undefined;
    }
  } else if (Array.isArray(arg)) {
    const shape = { ...data.selectShape };

    const joinedParsers: JoinedParsers = {};

    // TODO: batchParsers
    for (const item of arg) {
      if (typeof item === 'string') {
        const w = (data.withShapes as WithConfigs)[item];

        Object.assign(shape, w.shape);
        if (w.computeds)
          data.runtimeComputeds = { ...data.runtimeComputeds, ...w.computeds };

        const parsers: ColumnsParsers = {};
        joinedParsers[item] = parsers;
        addWithParsers(w, parsers);
      } else if (!isExpression(item)) {
        const sub = prepareSubQueryForSql(self as unknown as Query, item);
        Object.assign(shape, getShapeFromSelect(sub, true));

        const key = getQueryAs(sub);
        joinedParsers[key] = getQueryParsers(sub as unknown as Query);
      }
    }

    // several sources keep the select-all columns of the table, a preceding `fromSql` or `from` must not leak into them
    data.selectAllShape = (self as unknown as Query).baseQuery.q.selectAllShape;
    data.joinedParsers = joinedParsers;
  } else {
    const q = prepareSubQueryForSql(self as never, arg as never);
    data.as ||= q.q.as || q.table || 't';
    data.selectShape = data.selectAllShape = getOutputShape(q) as ColumnsShape;
    data.defaultParsers = getQueryParsers(q as unknown as Query);
    data.batchParsers = q.q.batchParsers;
  }

  data.from = arg as SubQueryForSql;
  data.selectAllColumns = data.scopes = data.fromShape = undefined;

  return self as never;
}

export type FromSqlResult<
  T extends FromQuerySelf,
  Shape extends Column.QueryColumns,
> = {
  [K in keyof T]: K extends '__defaultSelect'
    ? keyof Shape
    : K extends '__selectable'
      ? SelectableFromShape<Shape, T['__as']>
      : K extends 'result' | 'shape'
        ? Shape
        : K extends 'then'
          ? QueryThenByQuery<T, Shape>
          : T[K];
};

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

function queryFromSqlWithShape(
  self: FromQuerySelf & PickQueryColumTypes,
  shapeFn: (t: unknown) => Column.Shape.QueryInit,
  sql: Expression,
) {
  const data = (self as unknown as PickQueryQ).q;
  const declared = shapeFn(self.columnTypes);

  // the columns are named by their keys: a `name()` would refer to a column the SQL doesn't have
  const shape: ColumnsShape = {};
  const parsers: ColumnsParsers = {};
  for (const key in declared) {
    const column = declared[key] as unknown as Column;
    shape[key] = column.data.name
      ? setColumnData(column, 'name', undefined)
      : column;
    if (column._parse) parsers[key] = column._parse;
  }

  // default to the table name, so the SQL alias matches `__as` in the type of the query
  data.as ||= (self as unknown as PickQueryTable).table || 't';
  data.from = new FromSqlWithColumns(sql, Object.keys(shape));
  data.selectShape = data.selectAllShape = shape;
  data.defaultParsers = parsers;

  data.selectAllColumns =
    data.scopes =
    data.fromShape =
    data.runtimeComputeds =
      undefined;

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
    arg: T['__hasSelect'] extends true
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
   * To get a typed query that works as a table, declare the columns of the SQL result.
   * The declared columns name the result columns by position, and their types parse the values and provide column operators.
   * The SQL is rendered inline as a sub-query, so the query can be used wherever a table query is accepted: `join`, `whereExists`, `whereIn`, a sub-query in `select`, etc.
   * Conditions of the query can reference an outer table, as in `whereExists` or a sub-query in `select`, but the SQL itself is not `LATERAL` and cannot reference other tables of the same `FROM`.
   *
   * ```ts
   * import { sql } from './base-table';
   *
   * const score = db.$qb
   *   .fromSql(
   *     (t) => ({
   *       authorId: t.integer(),
   *       points: t.integer(),
   *     }),
   *     sql`SELECT author_id, sum(points)::int FROM vote GROUP BY author_id`,
   *   )
   *   .as('score');
   *
   * // SELECT * FROM (SELECT ...) "score"("authorId", "points") WHERE "score"."points" > $1
   * score.where({ points: { gt: 5 } });
   *
   * db.author.join(score, 'score.authorId', 'id').select('name', 'score.points');
   * db.author.whereExists(score, 'score.authorId', 'id');
   * ```
   */
  fromSql<T extends FromQuerySelf>(this: T, ...args: SQLQueryArgs): T;
  fromSql<
    T extends FromQuerySelf & PickQueryColumTypes,
    Shape extends Column.Shape.QueryInit,
  >(
    this: T,
    shape: T['__hasSelect'] extends true
      ? '`select` must be placed after `fromSql`'
      : (t: T['columnTypes']) => Shape,
    sql: Expression,
  ): FromSqlResult<T, Shape>;
  fromSql(this: FromQuerySelf & PickQueryColumTypes, ...args: unknown[]) {
    return typeof args[0] === 'function'
      ? queryFromSqlWithShape(_clone(this), args[0] as never, args[1] as never)
      : queryFromSql(_clone(this), args as never);
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
