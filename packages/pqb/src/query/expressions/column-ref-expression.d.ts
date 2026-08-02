import { Column } from '../../columns/column';
import { Expression, ExpressionData } from './expression';
import { ToSQLCtx } from '../sql/to-sql';
export declare class ColumnRefExpression<T extends Column.Pick.QueryColumn> extends Expression<T> {
    name: string;
    result: {
        value: T;
    };
    q: ExpressionData;
    constructor(value: T, name: string);
    makeSQL(ctx: ToSQLCtx, quotedAs?: string): string;
}
