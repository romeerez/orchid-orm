import { Expression, QueryColumn } from 'orchid-core';
import {
  SelectAs,
  SelectItem,
  SelectQueryData,
  ToSQLCtx,
  ToSQLQuery,
} from '../sql';
import { selectAllSql, selectedObjectToSQL } from '../sql/select';
import { columnToSql, columnToSqlWithAs } from '../sql/common';

/**
 * Expression that can turn a {@link SelectItem} (except {@link SelectAs}) into SQL.
 * Used by `get` to have an expression that can be chained with operators.
 */
export class SelectItemExpression<
  T extends QueryColumn = QueryColumn,
> extends Expression<T> {
  constructor(
    public q: ToSQLQuery,
    public item: Exclude<SelectItem, SelectAs>,
    public _type: T,
  ) {
    super();
  }

  // `makeSQL` acts similarly to how select args are handled,
  // except that it will use non-aliasing `columnToSql` when `ctx.aliasValue` is true,
  // it is needed for relation sub-queries that returns a single column.
  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    return typeof this.item === 'string'
      ? this.item === '*'
        ? selectAllSql(this.q, this.q.q as SelectQueryData, quotedAs)
        : ctx.aliasValue
        ? columnToSql(ctx, this.q.q, this.q.q.shape, this.item, quotedAs, true)
        : columnToSqlWithAs(ctx, this.q.q, this.item, quotedAs, true)
      : selectedObjectToSQL(ctx, this.q, quotedAs, this.item);
  }
}
