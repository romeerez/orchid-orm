import { RecordUnknown } from '../../utils';
import { Column } from '../../columns/column';
import { OperatorToSQL } from '../../columns/operators';
import { HasBeforeAndBeforeSet } from '../internal-features/sub-query/sub-query-for-sql';
import { PickQuerySelectable } from '../pick-query-types';
import { QueryBeforeHook } from '../query-data';
import { ToSqlValues } from '../sql/to-sql';
import type { QueryDataTransform } from '../extra-features/data-transform/transform';
export type SelectableOrExpression<T extends PickQuerySelectable = PickQuerySelectable, C extends Column.Pick.QueryColumn = Column.Pick.QueryColumn> = '*' | keyof T['__selectable'] | Expression<C>;
export type SelectableOrExpressions<T extends PickQuerySelectable = PickQuerySelectable, C extends Column.Pick.QueryColumn = Column.Pick.QueryColumn> = ('*' | keyof T['__selectable'] | Expression<C>)[];
export type ExpressionOutput<T extends PickQuerySelectable, Expr extends SelectableOrExpression<T>> = Expr extends keyof T['__selectable'] ? T['__selectable'][Expr]['column'] : Expr extends Expression ? Expr['result']['value'] : never;
export type ExpressionChain = (OperatorToSQL | unknown)[];
export interface ExpressionData extends HasBeforeAndBeforeSet {
    chain?: ExpressionChain;
    expr?: Expression;
    before?: QueryBeforeHook[];
    dynamicBefore?: boolean;
    getColumn?: Column;
    transform?: QueryDataTransform[];
}
export declare abstract class Expression<T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn> {
    abstract result: {
        value: T;
    };
    abstract q: ExpressionData;
    meta: {
        kind: 'select';
    };
    toSQL(ctx: ToSqlValues, quotedAs?: string): string;
    /**
     * Transform the expression value after loading it.
     *
     * It is meant to transform expressions selected by a query.
     *
     * @param fn - function to transform expression value with
     */
    transform<Self extends {
        result: {
            value: Column.Pick.QueryColumn;
        };
        q: ExpressionData;
    }, Result>(this: Self, fn: (input: Self['result']['value']['__type'], queryData: ExpressionData) => Result): Omit<Self, 'result'> & {
        result: {
            value: Column.Pick.QueryColumnOfType<Result>;
        };
    };
    abstract makeSQL(ctx: ToSqlValues, quotedAs?: string): string;
}
export declare const isExpression: (arg: unknown) => arg is Expression;
export type TemplateLiteralArgs = [
    strings: TemplateStringsArray,
    ...values: unknown[]
];
export declare const isTemplateLiteralArgs: (args: unknown[]) => args is TemplateLiteralArgs;
export type SQLArgs = StaticSQLArgs | [DynamicSQLArg<Column.Pick.QueryColumn>];
export interface DynamicSQLArg<T extends Column.Pick.QueryColumn> {
    (sql: (...args: StaticSQLArgs) => Expression<T>): Expression<T>;
}
export type StaticSQLArgs = TemplateLiteralArgs | [{
    raw: string;
    values?: RawSQLValues;
}];
export type RawSQLValues = RecordUnknown;
export declare abstract class ExpressionTypeMethod {
    type<T extends {
        q: {
            expr?: Expression;
        };
        columnTypes: unknown;
    }, C extends Column.Pick.QueryColumn>(this: T, fn: (types: T['columnTypes']) => C): // Omit is optimal
    Omit<T, 'result'> & {
        result: {
            value: C;
        };
    };
}
export declare const templateLiteralSQLToCode: (sql: TemplateLiteralArgs) => string;
