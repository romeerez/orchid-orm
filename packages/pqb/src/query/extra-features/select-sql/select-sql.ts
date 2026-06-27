import { Column } from '../../../columns/column';
import { ColumnRefExpression } from '../../expressions/column-ref-expression';
import { Expression } from '../../expressions/expression';

export interface ColumnDataSelectSqlProp {
  // Selected-output SQL expression used when a column is selected.
  selectSql?: Expression;

  // Callback to build selected-output SQL after table column metadata is known.
  selectSqlFn?: SelectSqlCallback;
}

export interface SelectSqlCallback {
  (column: ColumnRefExpression<Column.Pick.QueryColumn>): Expression;
}

export type SelectSqlColumn<
  T extends Column.Pick.DataAndDataType,
  Expr extends Expression,
> = unknown extends Expr['result']['value']['__outputType']
  ? T
  : {
      [K in keyof T]: K extends '__outputType'
        ? Expr['result']['value']['__outputType']
        : T[K];
    };

export const applyColumnSelectSql = (column: Column): void => {
  const { selectSqlFn } = column.data;
  if (selectSqlFn) {
    column.data.selectSql = selectSqlFn(
      new ColumnRefExpression(
        column as Column & Column.Pick.QueryColumn,
        column.data.key,
      ),
    );
  }
};
