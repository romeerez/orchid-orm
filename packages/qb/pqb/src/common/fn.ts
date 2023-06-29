import { Query } from '../query';
import { ColumnTypeBase, emptyObject, Expression, toArray } from 'orchid-core';
import { SelectableOrExpression } from '../utils';
import { OrderItem, ToSqlCtx, WhereItem } from '../sql';
import { addValue, columnToSql, rawOrColumnToSql } from '../sql/common';
import { pushOrderBySql } from '../sql/orderBy';
import { whereToSql } from '../sql/where';
import { windowToSql } from '../sql/window';
import { OrderArg, WhereArg, WindowArgDeclaration } from '../queryMethods';
import { BooleanColumn, BooleanNullable, ColumnType } from '../columns';
import { BaseOperators, Operator } from '../columns/operators';

export type AggregateOptions<T extends Query> = {
  distinct?: boolean;
  order?: OrderArg<T> | OrderArg<T>[];
  filter?: WhereArg<T>;
  filterOr?: WhereArg<T>[];
  withinGroup?: boolean;
  over?: Over<T>;
};

export type Over<T extends Query> =
  | keyof T['windows']
  | WindowArgDeclaration<T>;

export class FnExpression<
  Q extends Query,
  T extends ColumnTypeBase,
> extends Expression<T> {
  constructor(
    public q: Q,
    public fn: string,
    public args: (
      | SelectableOrExpression<Q>
      | { pairs: Record<string, SelectableOrExpression<Q>> }
      | { value: unknown }
    )[],
    public options: AggregateOptions<Q> = emptyObject,
    public _type: T,
  ) {
    super();
  }

  toSQL(ctx: ToSqlCtx, quotedAs?: string): string {
    const sql: string[] = [`${this.fn}(`];

    const { values } = ctx;
    const { options } = this;

    if (options.distinct && !options.withinGroup) sql.push('DISTINCT ');

    sql.push(
      this.args
        .map((arg) => {
          if (typeof arg === 'string') {
            return arg === '*'
              ? '*'
              : columnToSql(this.q.q, this.q.q.shape, arg, quotedAs, true);
          } else if (arg instanceof Expression) {
            return arg.toSQL(ctx, quotedAs);
          } else if ('pairs' in arg) {
            const args: string[] = [];
            const { pairs } = arg;
            for (const key in pairs) {
              args.push(
                // ::text is needed to bypass "could not determine data type of parameter" postgres error
                `${addValue(values, key)}::text, ${rawOrColumnToSql(
                  ctx,
                  this.q.q,
                  pairs[
                    key as keyof typeof pairs
                  ] as unknown as SelectableOrExpression,
                  quotedAs,
                )}`,
              );
            }
            return args.join(', ');
          } else {
            return addValue(values, arg.value);
          }
        })
        .join(', '),
    );

    if (options.withinGroup) sql.push(') WITHIN GROUP (');
    else if (options.order) sql.push(' ');

    if (options.order) {
      pushOrderBySql(
        { ...ctx, sql },
        this.q.q,
        quotedAs,
        toArray(options.order) as OrderItem[],
      );
    }

    sql.push(')');

    if (options.filter || options.filterOr) {
      const whereSql = whereToSql(
        ctx,
        this.q,
        {
          and: options.filter ? ([options.filter] as WhereItem[]) : undefined,
          or: options.filterOr?.map((item) => [item]) as WhereItem[][],
          shape: this.q.q.shape,
          joinedShapes: this.q.q.joinedShapes,
        },
        quotedAs,
      );
      if (whereSql) {
        sql.push(` FILTER (WHERE ${whereSql})`);
      }
    }

    if (options.over) {
      sql.push(
        ` OVER ${windowToSql(ctx, this.q.q, options.over as string, quotedAs)}`,
      );
    }

    return sql.join('');
  }
}

export type ColumnExpression<
  C extends ColumnTypeBase,
  Ops extends BaseOperators = C['operators'],
> = Expression<C> & {
  [K in keyof Ops]: (
    arg: Parameters<Ops[K]>[1],
  ) => ColumnExpression<BooleanNullable>;
};

type FnClass = {
  new (
    q: Query,
    fn: string,
    args: unknown[],
    options: unknown,
    type: ColumnTypeBase,
  ): ColumnExpression<ColumnTypeBase>;
};

const makeColumnFnClass = <T extends ColumnType>(column: T): FnClass => {
  let { _fnClass } = column.constructor as unknown as { _fnClass: FnClass };
  if (!_fnClass) {
    class ColumnFn extends FnExpression<Query, T> {
      _mods: unknown[] = [];

      toSQL(ctx: ToSqlCtx, quotedAs?: string): string {
        let sql = super.toSQL(ctx, quotedAs);

        const mods = this._mods;
        for (let i = 0, len = mods.length; i < len; i += 2) {
          sql = (mods[i] as Operator<unknown>)(sql, mods[i + 1], ctx, quotedAs);
        }

        return sql;
      }
    }

    const ops = column.operators;
    for (const key in ops) {
      const op = ops[key];
      (
        ColumnFn.prototype as unknown as Record<
          string,
          (column: ColumnFn, value: unknown) => unknown
        >
      )[key] = function (this: ColumnFn, value: unknown) {
        this._mods.push(op, value);
        const bool = BooleanColumn.instance;
        const boolClass = makeColumnFnClass(bool);
        const expr = new boolClass(
          this.q,
          this.fn,
          this.args,
          this.options,
          bool,
        );
        (expr as unknown as { _mods: unknown })._mods = this._mods;
        return expr;
      };
    }

    (column.constructor as unknown as { _fnClass: FnClass })._fnClass =
      _fnClass = ColumnFn as unknown as FnClass;
  }

  return _fnClass;
};

export type FnExpressionArg<Q extends Query> =
  | SelectableOrExpression<Q>
  | { pairs: Record<string, SelectableOrExpression<Q>> }
  | { value: unknown };

export const makeColumnFn = <T extends ColumnType, Q extends Query>(
  column: T,
  q: Q,
  fn: string,
  args: FnExpressionArg<Q>[],
  options?: AggregateOptions<Q>,
): ColumnExpression<T> => {
  return new (makeColumnFnClass(column))(
    q,
    fn,
    args,
    options,
    column,
  ) as ColumnExpression<T>;
};
