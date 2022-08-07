import { Query, SetQueryReturnsOne } from '../query';
import { ColumnOperators, WhereItem } from '../sql';
import { pushQueryArray } from '../queryDataUtils';
import { RawExpression } from '../common';
import { JSONColumn } from '../columnSchema';

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

type TextColumnName<T extends Query> = {
  [K in keyof T['shape']]: T['shape'][K]['type'] extends string ? K : never;
}[keyof T['shape']];

type JsonColumnName<T extends Query> = {
  [K in keyof T['shape']]: T['shape'][K] extends JSONColumn ? K : never;
}[keyof T['shape']];

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

  whereBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this.clone()._whereBetween(column, values);
  }
  _whereBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this._where({
      [column]: { between: values },
    } as unknown as WhereArg<T>);
  }

  orWhereBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this.clone()._orWhereBetween(column, values);
  }
  _orWhereBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this._or({
      [column]: { between: values },
    } as unknown as WhereArg<T>);
  }

  whereNotBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this.clone()._whereNotBetween(column, values);
  }
  _whereNotBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this._whereNot({
      [column]: { between: values },
    } as unknown as WhereArg<T>);
  }

  orWhereNotBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this.clone()._orWhereNotBetween(column, values);
  }
  _orWhereNotBetween<T extends Query, C extends keyof T['shape']>(
    this: T,
    column: C,
    values: [
      T['shape'][C]['type'] | Query | RawExpression,
      T['shape'][C]['type'] | Query | RawExpression,
    ],
  ): T {
    return this._orNot({
      [column]: { between: values },
    } as unknown as WhereArg<T>);
  }

  whereContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereContains(column, value);
  }
  _whereContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { contains: value },
    } as unknown as WhereArg<T>);
  }

  orWhereContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereContains(column, value);
  }
  _orWhereContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { contains: value },
    } as unknown as WhereArg<T>);
  }

  whereNotContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereNotContains(column, value);
  }
  _whereNotContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { contains: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotContains(column, value);
  }
  _orWhereNotContains<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._orNot({
      [column]: { contains: value },
    } as unknown as WhereArg<T>);
  }

  whereContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereContainsInsensitive(column, value);
  }
  _whereContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { containsInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  orWhereContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereContainsInsensitive(column, value);
  }
  _orWhereContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { containsInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  whereNotContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereNotContainsInsensitive(column, value);
  }
  _whereNotContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { containsInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotContainsInsensitive(column, value);
  }
  _orWhereNotContainsInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._orNot({
      [column]: { containsInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  whereStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereStartsWith(column, value);
  }
  _whereStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { startsWith: value },
    } as unknown as WhereArg<T>);
  }

  orWhereStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereStartsWith(column, value);
  }
  _orWhereStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { startsWith: value },
    } as unknown as WhereArg<T>);
  }

  whereNotStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereNotStartsWith(column, value);
  }
  _whereNotStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { startsWith: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotStartsWith(column, value);
  }
  _orWhereNotStartsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._orNot({
      [column]: { startsWith: value },
    } as unknown as WhereArg<T>);
  }

  whereStartsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereStartsWithInsensitive(column, value);
  }
  _whereStartsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { startsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  orWhereStartsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereStartsWithInsensitive(column, value);
  }
  _orWhereStartsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { startsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  whereNotStartsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereNotStartsWithInsensitive(column, value);
  }
  _whereNotStartsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { startsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotStartsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotStartsWithInsensitive(column, value);
  }
  _orWhereNotStartsWithInsensitive<
    T extends Query,
    C extends TextColumnName<T>,
  >(this: T, column: C, value: string | Query | RawExpression): T {
    return this._orNot({
      [column]: { startsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  whereEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereEndsWith(column, value);
  }
  _whereEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { endsWith: value },
    } as unknown as WhereArg<T>);
  }

  orWhereEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereEndsWith(column, value);
  }
  _orWhereEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { endsWith: value },
    } as unknown as WhereArg<T>);
  }

  whereNotEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereNotEndsWith(column, value);
  }
  _whereNotEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { endsWith: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotEndsWith(column, value);
  }
  _orWhereNotEndsWith<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._orNot({
      [column]: { endsWith: value },
    } as unknown as WhereArg<T>);
  }

  whereEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereEndsWithInsensitive(column, value);
  }
  _whereEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { endsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  orWhereEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereEndsWithInsensitive(column, value);
  }
  _orWhereEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { endsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  whereNotEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._whereNotEndsWithInsensitive(column, value);
  }
  _whereNotEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { endsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotEndsWithInsensitive(column, value);
  }
  _orWhereNotEndsWithInsensitive<T extends Query, C extends TextColumnName<T>>(
    this: T,
    column: C,
    value: string | Query | RawExpression,
  ): T {
    return this._orNot({
      [column]: { endsWithInsensitive: value },
    } as unknown as WhereArg<T>);
  }

  whereJsonPath<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: [path: string, op: string, value: unknown | Query | RawExpression],
  ): T {
    return this.clone()._whereJsonPath(column, value);
  }
  _whereJsonPath<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: [path: string, op: string, value: unknown | Query | RawExpression],
  ): T {
    return this._where({
      [column]: { jsonPath: value },
    } as unknown as WhereArg<T>);
  }

  orWhereJsonPath<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: [path: string, op: string, value: unknown | Query | RawExpression],
  ): T {
    return this.clone()._orWhereJsonPath(column, value);
  }
  _orWhereJsonPath<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: [path: string, op: string, value: unknown | Query | RawExpression],
  ): T {
    return this._or({
      [column]: { jsonPath: value },
    } as unknown as WhereArg<T>);
  }

  whereJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._whereJsonSupersetOf(column, value);
  }
  _whereJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { jsonSupersetOf: value },
    } as unknown as WhereArg<T>);
  }

  orWhereJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._orWhereJsonSupersetOf(column, value);
  }
  _orWhereJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { jsonSupersetOf: value },
    } as unknown as WhereArg<T>);
  }

  whereNotJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._whereNotJsonSupersetOf(column, value);
  }
  _whereNotJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { jsonSupersetOf: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotJsonSupersetOf(column, value);
  }
  _orWhereNotJsonSupersetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._orNot({
      [column]: { jsonSupersetOf: value },
    } as unknown as WhereArg<T>);
  }

  whereJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._whereJsonSubsetOf(column, value);
  }
  _whereJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._where({
      [column]: { jsonSubsetOf: value },
    } as unknown as WhereArg<T>);
  }

  orWhereJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._orWhereJsonSubsetOf(column, value);
  }
  _orWhereJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._or({
      [column]: { jsonSubsetOf: value },
    } as unknown as WhereArg<T>);
  }

  whereNotJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._whereNotJsonSubsetOf(column, value);
  }
  _whereNotJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._whereNot({
      [column]: { jsonSubsetOf: value },
    } as unknown as WhereArg<T>);
  }

  orWhereNotJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this.clone()._orWhereNotJsonSubsetOf(column, value);
  }
  _orWhereNotJsonSubsetOf<T extends Query, C extends JsonColumnName<T>>(
    this: T,
    column: C,
    value: unknown | Query | RawExpression,
  ): T {
    return this._orNot({
      [column]: { jsonSubsetOf: value },
    } as unknown as WhereArg<T>);
  }
}
