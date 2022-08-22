import { Query, QueryBase } from '../query';
import { ColumnOperators, WhereItem } from '../sql';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { RawExpression } from '../common';

export type WhereArg<T extends Pick<Query, 'selectable'>> =
  | {
      [K in keyof T['selectable']]?:
        | T['selectable'][K]['column']['type']
        | ColumnOperators<T['selectable'], K>
        | RawExpression;
    }
  | QueryBase
  | RawExpression;

export type WhereInColumn<T extends Pick<Query, 'selectable'>> =
  | keyof T['selectable']
  | [keyof T['selectable'], ...(keyof T['selectable'])[]];

export type WhereInValues<
  T extends Pick<Query, 'selectable'>,
  Column extends WhereInColumn<T>,
> = Column extends keyof T['selectable']
  ? T['selectable'][Column]['column']['type'][] | Query | RawExpression
  :
      | ({
          [I in keyof Column]: Column[I] extends keyof T['selectable']
            ? T['selectable'][Column[I]]['column']['type']
            : never;
        } & {
          length: Column extends { length: number } ? Column['length'] : never;
        })[]
      | Query
      | RawExpression;

export type WhereInArg<T extends Pick<Query, 'selectable'>> = {
  [K in keyof T['selectable']]?:
    | T['selectable'][K]['column']['type'][]
    | Query
    | RawExpression;
};

export const serializeWhereItem = (item: WhereArg<Query>): WhereItem => {
  if ('type' in item && typeof item.type === 'string') {
    return item as unknown as WhereItem;
  }
  return {
    type: 'object',
    data: item,
  };
};

export const applyIn = <T extends QueryBase>(
  q: T,
  and: boolean,
  arg: unknown,
  values: unknown[] | unknown[][] | Query | RawExpression | undefined,
  not?: boolean,
): T => {
  const op = not ? 'notIn' : 'in';
  let item;

  if (values) {
    if (Array.isArray(arg)) {
      item = {
        type: op,
        columns: arg,
        values,
      };
    } else {
      item = {
        type: 'object',
        data: { [arg as string]: { [op]: values } },
      };
    }
  } else {
    const obj: Record<string, { in: unknown[] }> = {};
    for (const key in arg as Record<string, unknown[]>) {
      obj[key] = { [op as 'in']: (arg as Record<string, unknown[]>)[key] };
    }
    item = {
      type: 'object',
      data: obj,
    };
  }

  if (and) {
    pushQueryValue(q, 'and', { item });
  } else {
    pushQueryValue(q, 'or', [{ item }]);
  }

  return q;
};

export const addWhere = <T extends QueryBase>(
  q: T,
  args: WhereArg<Query>[],
): T => {
  return pushQueryArray(
    q,
    'and',
    args.map((item) => ({ item: serializeWhereItem(item) })),
  );
};

export const addWhereNot = <T extends QueryBase>(
  q: T,
  args: WhereArg<Query>[],
): T => {
  return pushQueryArray(
    q,
    'and',
    args.map((item) => ({ item: serializeWhereItem(item), not: true })),
  );
};

export const addOr = <T extends QueryBase>(
  q: T,
  args: WhereArg<Query>[],
): T => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ item: serializeWhereItem(item) }]),
  );
};

export const addOrNot = <T extends QueryBase>(
  q: T,
  args: WhereArg<Query>[],
): T => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ item: serializeWhereItem(item), not: true }]),
  );
};

export class Where {
  where<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._where(...args);
  }

  _where<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return addWhere(this, args);
  }

  whereNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._whereNot(...args);
  }

  _whereNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return addWhereNot(this, args);
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
    return addOr(this, args);
  }

  orNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._orNot(...args);
  }

  _orNot<T extends Query>(this: T, ...args: WhereArg<T>[]): T {
    return addOrNot(this, args);
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
    return applyIn(this, true, arg, values);
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
    return applyIn(this, false, arg, values);
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
    return applyIn(this, true, arg, values, true);
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
    return applyIn(this, false, arg, values, true);
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