import {
  PickQueryColumTypes,
  PickQueryHasSelect,
  PickQueryMetaSelectableResultRelationsWindowsColumnTypes,
  PickQuerySelectable,
  PickQueryShape,
} from '../pick-query-types';
import { ColumnRefExpression } from './column-ref-expression';
import { Column, UnknownColumn } from '../../columns';
import { RefExpression } from './ref-expression';
import { _clone } from '../basic-features/clone/clone';
import { getFullColumnTable } from '../query.utils';
import { ValExpression } from './val-expression';
import { SelectableOrExpressions } from './expression';
import { AggregateOptions, makeFnExpression } from './fn-expression';
import { emptyObject } from '../../utils';
import { OrExpression, OrExpressionArg } from './or-expression';

import { QueryThen } from '../then/then';

interface QueryReturnsFnAdd<T extends PickQueryColumTypes>
  extends PickQueryHasSelect {
  type<C extends Column.Pick.QueryColumn>(
    fn: (types: T['columnTypes']) => C,
  ): {
    [K in keyof T]: K extends 'result'
      ? { value: C }
      : K extends 'returnType'
      ? 'valueOrThrow'
      : K extends 'then'
      ? QueryThen<C['outputType']>
      : T[K];
  } & C['operators'];
}

type SetQueryReturnsFn<
  T extends PickQueryColumTypes,
  C extends Column.Pick.OutputType,
> = {
  [K in keyof T]: K extends 'result'
    ? { value: C }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<C['outputType']>
    : T[K];
} & QueryReturnsFnAdd<T>;

export class QueryExpressions {
  /**
   * `column` references a table column, this can be used in raw SQL or when building a column expression.
   * Only for referencing a column in the query's table. For referencing joined table's columns, see [ref](#ref).
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * await db.table.select({
   *   // select `("table"."id" = 1 OR "table"."name" = 'name') AS "one"`,
   *   // returns a boolean
   *   one: (q) =>
   *     sql<boolean>`${q.column('id')} = ${1} OR ${q.column('name')} = ${'name'}`,
   *
   *   // selects the same as above, but by building a query
   *   two: (q) => q.column('id').equals(1).or(q.column('name').equals('name')),
   * });
   * ```
   *
   * @param name - column name
   */
  column<T extends PickQueryShape, K extends keyof T['shape']>(
    this: T,
    name: K,
  ): ColumnRefExpression<T['shape'][K]> & T['shape'][K]['operators'] {
    const column = (this.shape as { [K: PropertyKey]: Column })[name];
    return new ColumnRefExpression(
      (column || UnknownColumn.instance) as T['shape'][K],
      name as string,
    ) as never;
  }

  /**
   * `ref` is similar to [column](#column), but it also allows to reference a column of joined table,
   * and other dynamically defined columns.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * await db.table.join('otherTable').select({
   *   // select `("otherTable"."id" = 1 OR "otherTable"."name" = 'name') AS "one"`,
   *   // returns a boolean
   *   one: (q) =>
   *     sql<boolean>`${q.ref('otherTable.id')} = ${1} OR ${q.ref(
   *       'otherTable.name',
   *     )} = ${'name'}`,
   *
   *   // selects the same as above, but by building a query
   *   two: (q) =>
   *     q
   *       .ref('otherTable.id')
   *       .equals(1)
   *       .or(q.ref('otherTable.name').equals('name')),
   * });
   * ```
   *
   * @param arg - any available column name, such as of a joined table
   */
  ref<
    T extends PickQuerySelectable,
    K extends keyof T['__selectable'] & string,
  >(
    this: T,
    arg: K,
  ): RefExpression<T['__selectable'][K]['column']> &
    T['__selectable'][K]['column']['operators'] {
    const q = _clone(this);

    const { shape } = q.q;
    let column: Column.Pick.QueryColumn | undefined;

    const index = arg.indexOf('.');
    if (index !== -1) {
      const as = q.q.as || q.table;
      const table = getFullColumnTable(q, arg, index, as);
      const col = arg.slice(index + 1);
      if (table === as) {
        column = shape[col];
      } else {
        column = q.q.joinedShapes?.[table][col];
      }
    } else {
      column = shape[arg];
    }

    return new RefExpression(column || UnknownColumn.instance, q, arg) as never;
  }

  val(value: unknown): ValExpression {
    return new ValExpression(value);
  }

  /**
   * `fn` allows to call an arbitrary SQL function.
   *
   * For example, calling `sqrt` function to get a square root from some numeric column:
   *
   * ```ts
   * const q = await db.table.select({
   *   sqrt: (q) => q.fn<number>('sqrt', ['numericColumn']),
   * }).take();
   *
   * q.sqrt; // has type `number` just as provided
   * ```
   *
   * If this is an aggregate function, you can specify aggregation options (see [Aggregate](/guide/aggregate.html)) via third parameter.
   *
   * Use `type` method to specify a column type so that its operators such as `lt` and `gt` become available:
   *
   * ```ts
   * const q = await db.table.select({
   *   // Produces `sqrt("numericColumn") > 5`
   *   sqrtIsGreaterThan5: (q) =>
   *     q
   *       .fn('sqrt', ['numericColumn'])
   *       .type((t) => t.float())
   *       .gt(5),
   * }).take();
   *
   * // Return type is boolean | null
   * // todo: it should be just boolean if the column is not nullable, but for now it's always nullable
   * q.sqrtIsGreaterThan5;
   * ```
   *
   * @param fn
   * @param args
   * @param options
   */
  fn<
    T extends PickQueryMetaSelectableResultRelationsWindowsColumnTypes,
    Type = unknown,
    C extends Column.Pick.QueryColumn = Column.Pick.QueryColumnOfType<Type>,
  >(
    this: T,
    fn: string,
    args: SelectableOrExpressions<T>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsFn<T, C> {
    return makeFnExpression(
      this,
      emptyObject as C,
      fn,
      args as never,
      options,
    ) as never;
  }

  or(...args: [OrExpressionArg, ...OrExpressionArg[]]): OrExpression {
    return new OrExpression(args);
  }
}
