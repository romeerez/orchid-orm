import { Expression, ExpressionData } from '../core';
import { QueryData, ToSQLCtx, ToSQLQuery } from '../sql';
import { selectAllSql } from '../sql/select';
import { columnToSql } from '../sql/common';
import { Column } from '../columns/column';

/**
 * Expression that can turn a {@link SelectItem} (except {@link SelectAs}) into SQL.
 * Used by `get` to have an expression that can be chained with operators.
 */
export class SelectItemExpression<
  T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
> extends Expression<T> {
  result: { value: T };
  q: ExpressionData;

  constructor(
    public query: ToSQLQuery,
    public item: string | Expression,
    value?: T,
  ) {
    super();
    this.result = { value: value as T };
    this.q = query.q as ExpressionData;
    if (value) Object.assign(this, value.operators);
  }

  // `makeSQL` acts similarly to how select args are handled
  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    const q = this.q as QueryData;
    return typeof this.item === 'string'
      ? this.item === '*'
        ? selectAllSql(q, quotedAs).join(', ')
        : columnToSql(ctx, q, q.shape, this.item, quotedAs, true)
      : this.item.toSQL(ctx, quotedAs);
  }
}
