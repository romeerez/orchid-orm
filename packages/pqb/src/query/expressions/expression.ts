import { EmptyObject, RecordUnknown } from '../../utils';
import { Column } from '../../columns/column';
import { OperatorToSQL } from '../../columns/operators';
import { HasBeforeAndBeforeSet } from '../sub-query/sub-query-for-sql';
import { PickQuerySelectable } from '../pick-query-types';
import { QueryBeforeHook } from '../query-data';
import { ToSqlValues } from '../sql/to-sql';

export type SelectableOrExpression<
  T extends PickQuerySelectable = PickQuerySelectable,
  C extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
> = '*' | keyof T['__selectable'] | Expression<C>;

export type SelectableOrExpressions<
  T extends PickQuerySelectable = PickQuerySelectable,
  C extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
> = ('*' | keyof T['__selectable'] | Expression<C>)[];

export type ExpressionOutput<
  T extends PickQuerySelectable,
  Expr extends SelectableOrExpression<T>,
> = Expr extends keyof T['__selectable']
  ? T['__selectable'][Expr]['column']
  : Expr extends Expression
  ? Expr['result']['value']
  : never;

// The chain array is used to store a sequence of operators and their arguments, one be one.
// For example, expression of numeric type may be chained to `lt`, `gt` and similar functions.
export type ExpressionChain = (OperatorToSQL | unknown)[];

export interface ExpressionData extends HasBeforeAndBeforeSet {
  chain?: ExpressionChain;
  expr?: Expression;
  before?: QueryBeforeHook[];
  dynamicBefore?: boolean;
}

// Base class for the raw SQL and other classes that can produce SQL
export abstract class Expression<
  T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
> {
  // `result` contains an instance of a column type.
  // Starts with underscore to allow having `type` method
  abstract result: { value: T };

  abstract q: ExpressionData;

  // used in update to prevent non-select sub-queries
  declare meta: { kind: 'select' };

  // Produce SQL string by calling `makeSQL` and applying operators from the `q.chain`, push query variables into given `values` array.
  toSQL(ctx: ToSqlValues, quotedAs?: string): string {
    let sql = this.makeSQL(ctx, quotedAs);
    if (this.q.chain) {
      const { chain: chain } = this.q;
      for (let i = 0, len = chain.length; i < len; i += 2) {
        sql = (chain[i] as OperatorToSQL)(
          sql,
          chain[i + 1] as never,
          ctx,
          quotedAs,
        );
      }
    }
    return sql;
  }

  // `makeSQL` should be implemented on subclasses of Expression to return SQL of the expression.
  // Result of `makeSQL` will be chained with operators by `toSQL`.
  abstract makeSQL(ctx: ToSqlValues, quotedAs?: string): string;
}

// Check if the unknown thing is an Expression
export const isExpression = (arg: unknown): arg is Expression =>
  arg instanceof Expression;

// Object representing SQL query.
// Constructed by `toSQL`, passed to adapter.query and adapter.array
export type TemplateLiteralArgs = [
  strings: TemplateStringsArray,
  ...values: unknown[],
];

// Check if arguments are a template literal.
export const isTemplateLiteralArgs = (
  args: unknown[],
): args is TemplateLiteralArgs =>
  Array.isArray(args[0]) && 'raw' in args[0] && Array.isArray(args[0].raw);

// Argument type for `sql` function.
// It can take a template literal, an object `{ raw: string, values?: Record<string, unknown> }`,
// or a function to build SQL lazily.
export type SQLArgs = StaticSQLArgs | [DynamicSQLArg<Column.Pick.QueryColumn>];

// Function for sql method to build SQL lazily (dynamically).
// May be used for computed column to build a different SQL in different executions.
export interface DynamicSQLArg<T extends Column.Pick.QueryColumn> {
  (sql: (...args: StaticSQLArgs) => Expression<T>): Expression<T>;
}

// SQL arguments for a non-lazy SQL expression.
export type StaticSQLArgs =
  | TemplateLiteralArgs
  | [{ raw: string; values?: RawSQLValues }];

// Record of values to pass and store in a RawSql instance.
export type RawSQLValues = RecordUnknown;

// `type` method to be used in both static and dynamic variants of SQL expressions.
export abstract class ExpressionTypeMethod {
  // Define the resulting column type for the raw SQL.
  type<
    T extends {
      q: { expr?: Expression };
      columnTypes: unknown;
    },
    C extends Column.Pick.QueryColumn,
  >(
    this: T,
    fn: (types: T['columnTypes']) => C,
  ): // Omit is optimal
  Omit<T, 'result'> & { result: { value: C } } {
    const column = fn(this.columnTypes) as unknown as Column;
    (this.q.expr as Expression).result.value = column;
    Object.assign(
      'baseQuery' in this ? (this.baseQuery as EmptyObject) : this,
      column.operators,
    );
    return this as never;
  }
}

export const templateLiteralSQLToCode = (sql: TemplateLiteralArgs): string => {
  let code = '`';

  const parts = sql[0];
  let i = 0;
  for (let last = parts.length - 1; i < last; i++) {
    code += parts[i] + `\${${sql[i + 1]}}`;
  }
  code += parts[i];

  return code + '`';
};
