import { Expression, ExpressionData } from './expression';
import { BooleanQueryColumn } from '../basic-features/aggregate/aggregate';
import { OperatorsBoolean } from '../../columns/operators';
import { QueryOrExpressionBooleanOrNullResult } from '../query';
import { ToSQLCtx } from '../sql/to-sql';
export interface OrExpression extends Expression<BooleanQueryColumn>, OperatorsBoolean {
}
export type OrExpressionArg = QueryOrExpressionBooleanOrNullResult | undefined;
export declare class OrExpression extends Expression<BooleanQueryColumn> {
    args: [OrExpressionArg, ...OrExpressionArg[]];
    result: {
        value: BooleanQueryColumn;
    };
    q: ExpressionData;
    constructor(args: [OrExpressionArg, ...OrExpressionArg[]]);
    makeSQL(ctx: ToSQLCtx, quotedAs?: string): string;
}
