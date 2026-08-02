import { Column } from '../../columns/column';
import { Expression, ExpressionData } from './expression';
import { ToSQLCtx, ToSQLQuery } from '../sql/to-sql';
/**
 * Expression that can turn a {@link SelectItem} (except {@link SelectAs}) into SQL.
 * Used by `get` to have an expression that can be chained with operators.
 */
export declare class SelectItemExpression<T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn> extends Expression<T> {
    query: ToSQLQuery;
    item: string | Expression;
    result: {
        value: T;
    };
    q: ExpressionData;
    constructor(query: ToSQLQuery, item: string | Expression, value?: T);
    makeSQL(ctx: ToSQLCtx, quotedAs?: string): string;
}
