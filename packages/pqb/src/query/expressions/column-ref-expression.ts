import { Column } from '../../columns/column';
import { Expression, ExpressionData } from './expression';
import { simpleColumnToSQL } from '../sql/column-to-sql';
import { ToSQLCtx } from '../sql/to-sql';
import { emptyObject } from '../../utils';

// Expression created by `Query.column('name')`, it will prefix the column with a table name from query's context.
export class ColumnRefExpression<
  T extends Column.Pick.QueryColumn,
> extends Expression<T> {
  result: { value: T };
  q: ExpressionData;

  constructor(
    value: T,
    public name: string,
  ) {
    super();
    this.result = { value };
    this.q = { expr: this };
    Object.assign(this, value.operators);
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    return simpleColumnToSQL(
      ctx,
      emptyObject,
      emptyObject,
      this.name,
      this.result.value,
      quotedAs,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
  }
}
