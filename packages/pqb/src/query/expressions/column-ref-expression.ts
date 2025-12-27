import { Column } from '../../columns';
import { Expression, ExpressionData } from './expression';
import { simpleExistingColumnToSQL } from '../sql/column-to-sql';
import { ToSQLCtx } from '../sql/to-sql';

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
