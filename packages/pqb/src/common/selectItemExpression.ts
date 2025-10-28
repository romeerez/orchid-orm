import { Expression, QueryColumn } from '../core';
import { QueryData, ToSQLCtx, ToSQLQuery } from '../sql';
import { selectAllSql } from '../sql/select';
import { columnToSql } from '../sql/common';

/**
 * Expression that can turn a {@link SelectItem} (except {@link SelectAs}) into SQL.
 * Used by `get` to have an expression that can be chained with operators.
 */
export class SelectItemExpression<
  T extends QueryColumn = QueryColumn,
> extends Expression<T> {
  result: { value: T };
  q: QueryData;

  constructor(
    public query: ToSQLQuery,
    public item: string | Expression,
    value?: T,
  ) {
    super();
    this.result = { value: value as T };
    this.q = query.q;
    if (value) Object.assign(this, value.operators);
  }

  // `makeSQL` acts similarly to how select args are handled
  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    return typeof this.item === 'string'
      ? this.item === '*'
        ? selectAllSql(this.q, quotedAs)
        : columnToSql(ctx, this.q, this.q.shape, this.item, quotedAs, true)
      : this.item.toSQL(ctx, quotedAs);
  }
}
