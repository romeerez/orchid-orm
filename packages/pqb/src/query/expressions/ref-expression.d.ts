import { Column } from '../../columns';
import { Expression, ExpressionData } from './expression';
import { Query } from '../query';
import { ToSQLCtx } from '../sql/to-sql';
export declare class RefExpression<T extends Column.Pick.QueryColumn> extends Expression<T> {
    ref: string;
    result: {
        value: T;
    };
    q: ExpressionData;
    table?: string;
    constructor(value: T, query: Query, ref: string);
    makeSQL(ctx: ToSQLCtx): string;
}
