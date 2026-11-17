import { Expression, ExpressionData } from '../../expressions/expression';
import { UnknownColumn } from '../../../columns';
import { ToSqlValues } from '../../sql/to-sql';
import { quoteIdentifier } from '../../../utils';

/**
 * Raw SQL source of `fromSql` with declared columns.
 * It is rendered as a sub-query, and the declared columns name its result columns by position.
 */
export class FromSqlWithColumns extends Expression {
  q: ExpressionData;
  result = { value: UnknownColumn.instance };

  constructor(
    public sql: Expression,
    public columns: string[],
  ) {
    super();
    this.q = { expr: this };
  }

  makeSQL(ctx: ToSqlValues, quotedAs?: string): string {
    return `(${this.sql.toSQL(ctx, quotedAs)})`;
  }
}

/**
 * Renders an expression source of `FROM` or `JOIN` with its alias.
 */
export const fromExpressionToSql = (
  ctx: ToSqlValues,
  from: Expression,
  quotedAs: string | undefined,
): string => {
  const sql = `${from.toSQL(ctx, quotedAs)} ${quotedAs}`;
  return from instanceof FromSqlWithColumns && from.columns.length
    ? `${sql}(${from.columns.map(quoteIdentifier).join(', ')})`
    : sql;
};
