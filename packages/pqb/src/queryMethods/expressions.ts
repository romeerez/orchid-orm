import {
  emptyObject,
  Expression,
  ExpressionData,
  isExpression,
  IsQuery,
  PickQueryColumTypes,
  PickQueryMeta,
  PickQueryMetaResultRelationsWindowsColumnTypes,
  PickQueryShape,
  QueryThen,
  ValExpression,
} from '../core';
import { Column } from '../columns/column';
import { ToSQLCtx } from '../sql/to-sql';
import { QueryData } from '../sql/data';
import { columnToSql, simpleExistingColumnToSQL } from '../sql/common';
import {
  Query,
  QueryMetaHasSelect,
  QueryOrExpressionBooleanOrNullResult,
} from '../query/query';
import { SelectableOrExpressions } from '../common/utils';
import { AggregateOptions, makeFnExpression } from '../common/fn';
import { BooleanQueryColumn } from './aggregate';
import {
  Operators,
  OperatorsBoolean,
  prepareOpArg,
} from '../columns/operators';
import { _clone, getFullColumnTable } from '../query/queryUtils';
import { UnknownColumn } from '../columns';
import { moveMutativeQueryToCte } from '../query/cte/cte.sql';
import { SubQueryForSql } from '../query/to-sql/sub-query-for-sql';

// Expression created by `Query.column('name')`, it will prefix the column with a table name from query's context.
export class ColumnRefExpression<
  T extends Column.Pick.QueryColumn,
> extends Expression<T> {
  result: { value: T };
  q: ExpressionData;

  constructor(value: T, public name: string) {
    super();
    this.result = { value };
    this.q = { expr: this };
    Object.assign(this, value.operators);
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    return simpleExistingColumnToSQL(
      ctx,
      this.name,
      this.result.value,
      quotedAs,
    );
  }
}

export class RefExpression<
  T extends Column.Pick.QueryColumn,
> extends Expression<T> {
  result: { value: T };
  q: QueryData;
  table?: string;

  constructor(value: T, query: Query, public ref: string) {
    super();
    this.result = { value };
    (this.q = query.q).expr = this;
    this.table = query.table;
    Object.assign(this, value.operators);
  }

  makeSQL(ctx: ToSQLCtx): string {
    const as = this.q.as || this.table;
    return columnToSql(ctx, this.q, this.q.shape, this.ref, as && `"${as}"`);
  }
}

export interface OrExpression
  extends Expression<BooleanQueryColumn>,
    OperatorsBoolean {}

type OrExpressionArg = QueryOrExpressionBooleanOrNullResult | undefined;

export class OrExpression extends Expression<BooleanQueryColumn> {
  declare result: { value: BooleanQueryColumn };
  q: ExpressionData;

  constructor(
    q: IsQuery,
    public args: [OrExpressionArg, ...OrExpressionArg[]],
  ) {
    super();
    this.q = { expr: this };

    args.forEach((arg, i) => {
      const val = prepareOpArg(q, arg);
      if (val) args[i] = val as never;
    });
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    const res: string[] = [];
    for (const arg of this.args) {
      if (arg) {
        if (isExpression(arg)) {
          const sql = arg.toSQL(ctx, quotedAs);
          if (sql) res.push(sql);
        } else {
          res.push(
            `(${moveMutativeQueryToCte(
              ctx,
              arg as unknown as SubQueryForSql,
            )})`,
          );
        }
      }
    }

    return `(${res.join(' OR ')})`;
  }
}

Object.assign(OrExpression.prototype, Operators.boolean);

interface QueryReturnsFnAdd<T extends PickQueryColumTypes>
  extends QueryMetaHasSelect {
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

export class ExpressionMethods {
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
    T extends PickQueryMeta,
    K extends keyof T['meta']['selectable'] & string,
  >(
    this: T,
    arg: K,
  ): RefExpression<T['meta']['selectable'][K]['column']> &
    T['meta']['selectable'][K]['column']['operators'] {
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
   * const q = await User.select({
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
   * const q = await User.select({
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
    T extends PickQueryMetaResultRelationsWindowsColumnTypes,
    Type = unknown,
    C extends Column.Pick.QueryColumn = Column.Pick.QueryColumnOfType<Type>,
  >(
    this: T,
    fn: string,
    args: SelectableOrExpressions<T>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsFn<T, C> {
    return makeFnExpression(this, emptyObject as C, fn, args, options) as never;
  }

  or(...args: [OrExpressionArg, ...OrExpressionArg[]]): OrExpression {
    return new OrExpression(this as never, args);
  }
}
