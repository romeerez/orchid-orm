import { Query, SetQueryReturnsOne } from '../query';
import { ColumnOperators, WhereItem } from '../sql';
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
  | RawExpression;

type WhereInColumn<T extends Query> =
  | keyof T['shape']
  | [keyof T['shape'], ...(keyof T['shape'])[]];

type WhereInValues<
  T extends Query,
  Column extends WhereInColumn<T>,
> = Column extends keyof T['shape']
  ? T['shape'][Column]['type'][] | Query | RawExpression
  :
      | ({
          [I in keyof Column]: Column[I] extends keyof T['shape']
            ? T['shape'][Column[I]]['type']
            : never;
        } & {
          length: Column extends { length: number } ? Column['length'] : never;
        })[]
      | Query
      | RawExpression;

type WhereInArg<T extends Query> = {
  [K in keyof T['shape']]?: T['shape'][K]['type'][] | Query | RawExpression;
};

const serializeWhereItem = (item: WhereArg<Query>): WhereItem => {
  if ('type' in item && typeof item.type === 'string') {
    return item as unknown as WhereItem;
  }
  return {
    type: 'object',
    data: item,
  };
};

const applyWhereIn = <T extends Query>(
  q: T,
  method: '_where' | '_or',
  arg: unknown,
  values: unknown[] | unknown[][] | Query | RawExpression | undefined,
  not?: boolean,
) => {
  const op = not ? 'notIn' : 'in';

  if (values) {
    if (Array.isArray(arg)) {
      return q[method]({
        type: op,
        columns: arg,
        values,
      });
    }

    return q[method]({
      [arg as string]: { [op]: values },
    } as unknown as WhereArg<T>);
  }

  const obj: Record<string, { in: unknown[] }> = {};
  for (const key in arg as Record<string, unknown[]>) {
    obj[key] = { [op as 'in']: (arg as Record<string, unknown[]>)[key] };
  }

  return q[method](obj as unknown as WhereArg<T>);
};

export class Where {
  where<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._where(...args);
  }

  _where<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return pushQueryArray(
      this,
      'and',
      args.map((item) => ({ item: serializeWhereItem(item) })),
    );
  }

  findBy<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOne<T> {
    return this.clone()._findBy(...args);
  }

  _findBy<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOne<T> {
    return this._where(...args).take();
  }

  whereNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._whereNot(...args);
  }

  _whereNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return pushQueryArray(
      this,
      'and',
      args.map((item) => ({ item: serializeWhereItem(item), not: true })),
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
      args.map((item) => [{ item: serializeWhereItem(item) }]),
    );
  }

  orNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._orNot(...args);
  }

  _orNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return pushQueryArray(
      this,
      'or',
      args.map((item) => [{ item: serializeWhereItem(item), not: true }]),
    );
  }

  whereIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  whereIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  whereIn<T extends Query>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereIn(arg as any, values as any);
  }

  _whereIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _whereIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  _whereIn<T extends Query>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyWhereIn(this, '_where', arg, values);
  }

  orWhereIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  orWhereIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  orWhereIn<T extends Query>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereIn(arg as any, values as any);
  }

  _orWhereIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _orWhereIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  _orWhereIn<T extends Query>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyWhereIn(this, '_or', arg, values);
  }

  whereNotIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  whereNotIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  whereNotIn<T extends Query>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereNotIn(arg as any, values as any);
  }

  _whereNotIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _whereNotIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  _whereNotIn<T extends Query>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyWhereIn(this, '_where', arg, values, true);
  }

  orWhereNotIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  orWhereNotIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  orWhereNotIn<T extends Query>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereNotIn(arg as any, values as any);
  }

  _orWhereNotIn<T extends Query, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _orWhereNotIn<T extends Query>(this: T, arg: WhereInArg<T>): T;
  _orWhereNotIn<T extends Query>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyWhereIn(this, '_or', arg, values, true);
  }

  whereNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this.clone()._whereNull(column);
  }
  _whereNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this._where({ [column]: null } as unknown as WhereArg<T>);
  }

  orWhereNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this.clone()._orWhereNull(column);
  }
  _orWhereNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this._or({ [column]: null } as unknown as WhereArg<T>);
  }

  whereNotNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this.clone()._whereNotNull(column);
  }
  _whereNotNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this._whereNot({ [column]: null } as unknown as WhereArg<T>);
  }

  orWhereNotNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this.clone()._orWhereNotNull(column);
  }
  _orWhereNotNull<T extends Query>(this: T, column: keyof T['shape']): T {
    return this._orNot({ [column]: null } as unknown as WhereArg<T>);
  }

  whereExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this.clone()._whereExists(query);
  }
  _whereExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this._where({ type: 'exists', query });
  }

  orWhereExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this.clone()._orWhereExists(query);
  }
  _orWhereExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this._or({ type: 'exists', query });
  }

  whereNotExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this.clone()._whereNotExists(query);
  }
  _whereNotExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this._whereNot({ type: 'exists', query });
  }

  orWhereNotExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this.clone()._orWhereNotExists(query);
  }
  _orWhereNotExists<T extends Query>(this: T, query: Query | RawExpression): T {
    return this._orNot({ type: 'exists', query });
  }
}
