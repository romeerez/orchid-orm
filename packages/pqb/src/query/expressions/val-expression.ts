import { addValue, emptyObject } from '../../utils';
import { Column } from '../../columns';
import { Expression, ExpressionData } from './expression';
import { ToSqlValues } from '../sql/to-sql';

export class ValExpression extends Expression {
  // TODO: move unknown column to core and use it here
  result = { value: emptyObject as Column };
  q: ExpressionData;

  constructor(public value: unknown) {
    super();
    this.q = { expr: this };
  }

  makeSQL(ctx: ToSqlValues): string {
    return addValue(ctx.values, this.value);
  }
}
