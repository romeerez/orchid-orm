import { Column } from '../../columns/column';
import { ToSqlValues } from '../sql/to-sql';
import { Expression, ExpressionData, ExpressionTypeMethod } from './expression';
import { type RawSqlBase } from './raw-sql';
export interface SqlJoinExpression<T extends Column.Pick.QueryColumn> extends Expression<T>, ExpressionTypeMethod {
}
export declare class SqlJoinExpression<T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn> extends Expression<T> {
    items: readonly unknown[];
    separator?: RawSqlBase | undefined;
    result: {
        value: T;
    };
    q: ExpressionData;
    constructor(items: readonly unknown[], separator?: RawSqlBase | undefined);
    makeSQL(ctx: ToSqlValues, quotedAs?: string): string;
}
