import { OrderItem } from '../order/order.sql';
import { QueryData } from '../../query-data';
import { ToSQLCtx } from '../../sql/to-sql';
import { Expression, SelectableOrExpression } from '../../expressions/expression';
export interface WindowItem {
    [K: string]: WindowDeclaration | Expression;
}
export interface WindowDeclaration {
    partitionBy?: SelectableOrExpression | SelectableOrExpression[];
    order?: OrderItem;
}
export declare const windowToSql: (ctx: ToSQLCtx, data: QueryData, window: string | WindowDeclaration | Expression, quotedAs?: string) => string;
