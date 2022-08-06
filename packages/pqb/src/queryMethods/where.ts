import { Query } from '../query';
import { ColumnOperators } from '../sql';
import { pushQueryArray } from '../queryDataUtils';
import { RawExpression } from '../common';

type WhereArg<T extends Query> =
  | Partial<T['type']>
  | {
      [K in keyof T['selectable']]?:
        | ColumnOperators<T['selectable'], K>
        | RawExpression;
    }
  | Query
  | RawExpression
  | {
      on: [
        leftFullColumn: keyof T['selectable'],
        op: string,
        rightFullColumn: keyof T['selectable'],
      ];
    };

export class Where {
  where<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._where(...args);
  }

  _where<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return pushQueryArray(
      this,
      'and',
      args.map((item) => ({ item })),
    );
  }

  whereNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._whereNot(...args);
  }

  _whereNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return pushQueryArray(
      this,
      'and',
      args.map((item) => ({ item, not: true })),
    );
  }

  and<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.where(...args);
  }

  _and<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this._where(...args);
  }

  andNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.whereNot(...args);
  }

  _andNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this._whereNot(...args);
  }

  or<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._or(...args);
  }

  _or<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return pushQueryArray(
      this,
      'or',
      args.map((item) => [{ item }]),
    );
  }

  orNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._orNot(...args);
  }

  _orNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return pushQueryArray(
      this,
      'or',
      args.map((item) => [{ item, not: true }]),
    );
  }

  whereIn<
    T extends Query,
    Column extends
      | keyof T['shape']
      | [keyof T['shape'], ...(keyof T['shape'])[]],
  >(
    this: T,
    column: Column,
    values: Column extends keyof T['shape']
      ? T['shape'][Column]['type'][] | Query | RawExpression
      :
          | ({
              [I in keyof Column]: Column[I] extends keyof T['shape']
                ? T['shape'][Column[I]]['type']
                : never;
            } & {
              length: Column extends { length: number }
                ? Column['length']
                : never;
            })[]
          | Query
          | RawExpression,
  ): T;
  whereIn<T extends Query>(
    this: T,
    arg: {
      [K in keyof T['shape']]?: T['shape'][K]['type'][] | Query | RawExpression;
    },
  ): T;
  whereIn<T extends Query>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereIn(arg as any, values as any);
  }

  _whereIn<
    T extends Query,
    Column extends
      | keyof T['shape']
      | [keyof T['shape'], ...(keyof T['shape'])[]],
  >(
    this: T,
    column: Column,
    values: Column extends keyof T['shape']
      ? T['shape'][Column]['type'][] | Query | RawExpression
      :
          | ({
              [I in keyof Column]: Column[I] extends keyof T['shape']
                ? T['shape'][Column[I]]['type']
                : never;
            } & {
              length: Column extends { length: number }
                ? Column['length']
                : never;
            })[]
          | Query
          | RawExpression,
  ): T;
  _whereIn<T extends Query>(
    this: T,
    arg: {
      [K in keyof T['shape']]?: T['shape'][K]['type'][] | Query | RawExpression;
    },
  ): T;
  _whereIn<T extends Query, Columns extends (keyof T['shape'])[]>(
    this: T,
    columns: Columns,
    values:
      | ({ [I in keyof Columns]: T['shape'][Columns[I]]['type'] } & {
          length: Columns['length'];
        })
      | Query
      | RawExpression,
  ): T;
  _whereIn<T extends Query>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    if (values) {
      if (Array.isArray(arg)) {
        return this._where({
          in: {
            columns: arg,
            values,
          },
        });
      }

      return this._where({
        [arg as string]: { in: values },
      } as unknown as WhereArg<T>);
    }

    const obj: Record<string, { in: unknown[] }> = {};
    for (const key in arg as Record<string, unknown[]>) {
      obj[key] = { in: (arg as Record<string, unknown[]>)[key] };
    }

    return this._where(obj as unknown as WhereArg<T>);
  }
}
