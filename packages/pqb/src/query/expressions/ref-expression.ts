import { Column } from '../../columns';
import { Expression, ExpressionData } from './expression';
import { Query } from '../query';
import { columnToSql } from '../sql/column-to-sql';
import { ToSQLCtx } from '../sql/to-sql';
import { QueryData } from '../query-data';

export class RefExpression<
  T extends Column.Pick.QueryColumn,
> extends Expression<T> {
  result: { value: T };
  q: ExpressionData;
  table?: string;

  constructor(value: T, query: Query, public ref: string) {
    super();
    this.result = { value };
    this.q = query.q as ExpressionData;
    this.q.expr = this;
    this.table = query.table;
    Object.assign(this, value.operators);
  }

  makeSQL(ctx: ToSQLCtx): string {
    const q = this.q as QueryData;
    const as = q.as || this.table;
    return columnToSql(ctx, q, q.shape, this.ref, as && `"${as}"`);
  }
}
