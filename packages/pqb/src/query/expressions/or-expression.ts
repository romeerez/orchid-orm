import { Expression, ExpressionData, isExpression } from './expression';
import { BooleanQueryColumn } from '../basic-features/aggregate/aggregate';
import {
  Operators,
  OperatorsBoolean,
  prepareOpArg,
} from '../../columns/operators';
import { QueryOrExpressionBooleanOrNullResult } from '../query';
import { moveMutativeQueryToCte } from '../basic-features/cte/cte.sql';
import { SubQueryForSql } from '../internal-features/sub-query/sub-query-for-sql';
import { ToSQLCtx } from '../sql/to-sql';
import { wrapRootValueSql } from '../internal-features/sub-query/root-query-value';

export interface OrExpression
  extends Expression<BooleanQueryColumn>, OperatorsBoolean {}

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
          const query = arg as unknown as SubQueryForSql;
          const { q } = query;
          // a value of the root query of a callback is a value of the current record
          if (q.rootBase && q.expr) {
            const sql = q.expr.toSQL(ctx, quotedAs);
            res.push(wrapRootValueSql(ctx, query as never, sql, quotedAs));
          } else {
            res.push(`(${moveMutativeQueryToCte(ctx, query)})`);
          }
        }
      }
    }

    return `(${res.join(' OR ')})`;
  }
}

Object.assign(OrExpression.prototype, Operators.boolean);
