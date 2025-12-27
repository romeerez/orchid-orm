import { Expression, ExpressionData, isExpression } from './expression';
import { BooleanQueryColumn } from '../basic-features/aggregate/aggregate';
import {
  Operators,
  OperatorsBoolean,
  prepareOpArg,
} from '../../columns/operators';
import { QueryOrExpressionBooleanOrNullResult } from '../query';
import { moveMutativeQueryToCte } from '../basic-features/cte/cte.sql';
import { SubQueryForSql } from '../sub-query/sub-query-for-sql';
import { ToSQLCtx } from '../sql/to-sql';

export interface OrExpression
  extends Expression<BooleanQueryColumn>,
    OperatorsBoolean {}

export type OrExpressionArg = QueryOrExpressionBooleanOrNullResult | undefined;

export class OrExpression extends Expression<BooleanQueryColumn> {
  declare result: { value: BooleanQueryColumn };
  q: ExpressionData;

  constructor(public args: [OrExpressionArg, ...OrExpressionArg[]]) {
    super();
    this.q = { expr: this };

    args.forEach((arg, i) => {
      const val = prepareOpArg(this, arg);
      if (val) args[i] = val as never;
    });
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    const res: string[] = [];
    for (const arg of this.args) {
      if (arg) {
        if (isExpression(arg)) {
          const sql = arg.toSQL(ctx, quotedAs);
          if (sql) res.push(sql);
        } else {
          res.push(
            `(${moveMutativeQueryToCte(
              ctx,
              arg as unknown as SubQueryForSql,
            )})`,
          );
        }
      }
    }

    return `(${res.join(' OR ')})`;
  }
}

Object.assign(OrExpression.prototype, Operators.boolean);
