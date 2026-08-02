import { Expression, ExpressionData } from './expression';
import { Column } from '../../columns/column';
/**
 * Expression for a SQL identifier reference.
 * Used to safely quote identifiers in raw SQL queries.
 */
export declare class SqlRefExpression extends Expression {
    name: string;
    result: {
        value: Column.Pick.QueryColumn;
    };
    q: ExpressionData;
    constructor(name: string);
    makeSQL(): string;
}
