import { ColumnType, ColumnTypesBase } from '../columns';
import { Query } from '../query';
import { RawExpression } from '../raw';

type RawArgs<CT extends ColumnTypesBase, C extends ColumnType> =
  | [column: (types: CT) => C, sql: string, values?: Record<string, unknown>]
  | [sql: string, values?: Record<string, unknown>];

export class RawMethods {
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
