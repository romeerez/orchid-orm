import { Expression, ExpressionData } from './expression';
import { Column } from '../../columns/column';

/**
 * Expression for a SQL identifier reference.
 * Used to safely quote identifiers in raw SQL queries.
 */
export class SqlRefExpression extends Expression {
  result = { value: {} as Column.Pick.QueryColumn };
  q: ExpressionData = { expr: this };

  constructor(public name: string) {
    super();
  }

  makeSQL() {
    // Quote a SQL identifier (table name, column name, schema name, etc.).
    // Handle dots to support qualified names like "schema.table" → "schema"."table".
    // Escape double quotes by doubling them.
    return `"${this.name.replaceAll('"', '""').replaceAll('.', '"."')}"`;
  }
}
