import { Query } from '../query';
import { ColumnType } from '../columns';
import { ColumnTypesBase, RawExpression } from 'orchid-core';

type SqlArgs<T extends Query> = SqlColumnArgs<T> | SqlNoColumnArgs;

type SqlColumnArgs<T extends Query> =
  | [column: ColumnFn<T>, params?: { raw?: string; values?: Values }];

type SqlColumnArgsWithSQL<T extends Query> =
  | [column: ColumnFn<T>, params: { raw: string }];

type SqlNoColumnArgs =
  | [params: { raw: string; values?: Values }]
  | [params: { values: Values }]
  | TemplateLiteralArgs;

type Values = Record<string, unknown>;

type ColumnFn<T extends Query> = (types: T['columnTypes']) => ColumnType;

type TemplateLiteralArgs = [
  strings: TemplateStringsArray,
  ...values: unknown[],
];

type SqlFn<C extends ColumnType> = (
  ...args: TemplateLiteralArgs
) => RawExpression<C>;

type SqlResult<
  T extends Query,
  Args extends SqlArgs<T>,
> = Args extends SqlColumnArgs<T>
  ? Args extends SqlColumnArgsWithSQL<T>
    ? RawExpression<ReturnType<Args[0]>>
    : SqlFn<ReturnType<Args[0]>>
  : Args extends [{ raw: string }] | TemplateLiteralArgs
  ? RawExpression
  : SqlFn<ColumnType>;

type RawArgs<CT extends ColumnTypesBase, C extends ColumnType> =
  | [column: (types: CT) => C, sql: string, values?: Record<string, unknown>]
  | [sql: string, values?: Record<string, unknown>];

export class RawSqlMethods {
  sql<T extends Query, Args extends SqlArgs<T>>(
    this: T,
    ...args: Args
  ): SqlResult<T, Args> {
    const arg = args[0];

    if (typeof arg === 'object') {
      if (Array.isArray(arg)) {
        return {
          __raw: args,
        } as unknown as SqlResult<T, Args>;
      }

      const obj = arg as { raw?: string; values?: Values };
      if (obj.raw) {
        return {
          __raw: obj.raw,
          __values: obj.values,
        } as unknown as SqlResult<T, Args>;
      }

      return ((...args: unknown[]) => {
        return {
          __raw: args,
          __values: obj.values,
        } as unknown as RawExpression;
      }) as SqlResult<T, Args>;
    }

    const column = (arg as ColumnFn<T>)(this.columnTypes);
    const second = args[1] as { raw?: string; values?: Values } | undefined;

    if (second?.raw) {
      return {
        __column: column,
        __raw: second.raw,
        __values: second.values,
      } as unknown as SqlResult<T, Args>;
    }

    return ((...args: unknown[]) => {
      return {
        __column: column,
        __raw: args,
        __values: second?.values,
      } as unknown as RawExpression;
    }) as SqlResult<T, Args>;
  }

  /**
   * @deprecated use `sql` method instead, `raw` will be removed
   */
  raw<T extends Query, C extends ColumnType>(
    this: T,
    ...args: RawArgs<T['columnTypes'], C>
  ): RawExpression<C> {
    if (typeof args[0] === 'string') {
      return {
        __raw: args[0],
        __values: args[1],
      } as RawExpression<C>;
    } else {
      return {
        __column: args[0](this.columnTypes),
        __raw: args[1],
        __values: args[2],
      } as RawExpression<C>;
    }
  }
}
