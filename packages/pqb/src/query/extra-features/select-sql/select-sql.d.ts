import { Column } from '../../../columns/column';
import { ColumnRefExpression } from '../../expressions/column-ref-expression';
import { Expression } from '../../expressions/expression';
export interface ColumnDataSelectSqlProp {
    selectSql?: Expression;
    selectSqlFn?: SelectSqlCallback;
}
export interface SelectSqlCallback {
    (column: ColumnRefExpression<Column.Pick.QueryColumn>): Expression;
}
export type SelectSqlColumn<T extends Column.Pick.DataAndDataType, Expr extends Expression> = unknown extends Expr['result']['value']['__outputType'] ? T : {
    [K in keyof T]: K extends '__outputType' ? Expr['result']['value']['__outputType'] : T[K];
};
export declare const applyColumnSelectSql: (column: Column) => void;
