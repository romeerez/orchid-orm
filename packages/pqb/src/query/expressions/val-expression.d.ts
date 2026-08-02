import { Column } from '../../columns';
import { Expression, ExpressionData } from './expression';
import { ToSqlValues } from '../sql/to-sql';
export declare class ValExpression extends Expression {
    value: unknown;
    result: {
        value: Column;
    };
    q: ExpressionData;
    constructor(value: unknown);
    makeSQL(ctx: ToSqlValues): string;
}
