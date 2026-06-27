import { Column } from '../../columns/column';
import { emptyObject } from '../../utils';
import { ToSqlValues } from '../sql/to-sql';
import { Expression, ExpressionData, ExpressionTypeMethod } from './expression';
import { type RawSqlBase } from './raw-sql';

export interface SqlJoinExpression<T extends Column.Pick.QueryColumn>
  extends Expression<T>, ExpressionTypeMethod {}

export class SqlJoinExpression<
  T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
> extends Expression<T> {
  result = { value: emptyObject as T };
  q: ExpressionData = { expr: this };

  constructor(
    public items: readonly unknown[],
    public separator?: RawSqlBase,
  ) {
    super();
  }

  makeSQL(ctx: ToSqlValues, quotedAs?: string): string {
    let sql = '';

    for (let i = 0; i < this.items.length; i++) {
      if (i > 0) {
        sql += this.separator ? this.separator.toSQL(ctx, quotedAs) : ', ';
      }

      const item = this.items[i];
      if (item instanceof Expression) {
        sql += item.toSQL(ctx, quotedAs);
      } else {
        ctx.values.push(item);
        sql += `$${ctx.values.length}`;
      }
    }

    return sql;
  }
}

SqlJoinExpression.prototype.type = ExpressionTypeMethod.prototype.type;
