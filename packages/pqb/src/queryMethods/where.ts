import {
  Query,
  QueryBase,
  RelationsBase,
  SelectableBase,
  WithDataBase,
} from '../query';
import { ColumnOperators, QueryData, WhereItem } from '../sql';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { RawExpression } from '../common';
import { getClonedQueryData } from '../utils';
import { JoinArgs } from './join';

export type WhereArg<T extends QueryBase> =
  | {
      [K in keyof T['selectable']]?:
        | T['selectable'][K]['column']['type']
        | ColumnOperators<T['selectable'], K>
        | RawExpression;
    }
  | QueryBase
  | RawExpression
  | ((q: WhereQueryBuilder<T>) => WhereQueryBuilder);

export type WhereInColumn<T extends QueryBase> =
  | keyof T['selectable']
  | [keyof T['selectable'], ...(keyof T['selectable'])[]];

export type WhereInValues<
  T extends QueryBase,
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

export const serializeWhereItem = <T extends QueryBase>(
  q: T,
  item: WhereArg<T>,
): WhereItem => {
  if ('type' in item && typeof item.type === 'string') {
    return item as unknown as WhereItem;
  }

  if (typeof item === 'function') {
    const qb = item(new WhereQueryBuilder(q.table, q.tableAlias));

    return {
      type: 'nested',
      and: qb.query?.and,
      or: qb.query?.or,
    };
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

export const addWhere = <T extends Where>(q: T, args: WhereArg<T>[]): T => {
  return pushQueryArray(
    q,
    'and',
    args.map((item) => ({ item: serializeWhereItem(q, item) })),
  );
};

export const addWhereNot = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): T => {
  return pushQueryArray(
    q,
    'and',
    args.map((item) => ({ item: serializeWhereItem(q, item), not: true })),
  );
};

export const addOr = <T extends QueryBase>(q: T, args: WhereArg<T>[]): T => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ item: serializeWhereItem(q, item) }]),
  );
};

export const addOrNot = <T extends QueryBase>(q: T, args: WhereArg<T>[]): T => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ item: serializeWhereItem(q, item), not: true }]),
  );
};

const getWhereExistsArgs = <T extends Where, Args extends JoinArgs<T>>(
  q: T,
  args: Args,
) => {
  if (typeof args[1] === 'function') {
    const [modelOrWith, fn] = args;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OnQueryBuilder } = require('./join');
    const resultQuery = fn(new OnQueryBuilder(q.table, q.query?.as));

    return [modelOrWith, { type: 'query', query: resultQuery }];
  } else {
    return args.length === 2
      ? [args[0], { type: 'objectOrRaw', data: args[1] }]
      : args;
  }
};

export abstract class Where implements QueryBase {
  abstract clone<T extends this>(this: T): T & { query: QueryData };
  abstract toQuery<T extends this>(this: T): T & { query: QueryData };
  abstract selectable: SelectableBase;
  abstract relations: RelationsBase;
  abstract withData: WithDataBase;

  query?: QueryData;
  table?: string;
  tableAlias?: string;

  where<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._where(...args);
  }

  _where<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return addWhere(this, args);
  }

  whereNot<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._whereNot(...args);
  }

  _whereNot<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return addWhereNot(this, args);
  }

  and<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this.where(...args);
  }

  _and<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this._where(...args);
  }

  andNot<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this.whereNot(...args);
  }

  _andNot<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this._whereNot(...args);
  }

  or<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._or(...args);
  }

  _or<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return addOr(this, args);
  }

  orNot<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._orNot(...args);
  }

  _orNot<T extends Where>(this: T, ...args: WhereArg<T>[]): T {
    return addOrNot(this, args);
  }

  whereIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  whereIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  whereIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereIn(arg as any, values as any);
  }

  _whereIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _whereIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  _whereIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, true, arg, values);
  }

  orWhereIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  orWhereIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  orWhereIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereIn(arg as any, values as any);
  }

  _orWhereIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _orWhereIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  _orWhereIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, false, arg, values);
  }

  whereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  whereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  whereNotIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereNotIn(arg as any, values as any);
  }

  _whereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _whereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  _whereNotIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, true, arg, values, true);
  }

  orWhereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  orWhereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  orWhereNotIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereNotIn(arg as any, values as any);
  }

  _orWhereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _orWhereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): T;
  _orWhereNotIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, false, arg, values, true);
  }

  whereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return (this.clone() as T)._whereExists(...args);
  }
  _whereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return this._where({
      type: 'exists',
      args: getWhereExistsArgs(this, args),
    });
  }

  orWhereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return (this.clone() as T)._orWhereExists(...args);
  }
  _orWhereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return this._or({ type: 'exists', args: getWhereExistsArgs(this, args) });
  }

  whereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return (this.clone() as T)._whereNotExists(...args);
  }
  _whereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return this._whereNot({
      type: 'exists',
      args: getWhereExistsArgs(this, args),
    });
  }

  orWhereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return (this.clone() as T)._orWhereNotExists(...args);
  }
  _orWhereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T {
    return this._orNot({
      type: 'exists',
      args: getWhereExistsArgs(this, args),
    });
  }
}

export class WhereQueryBuilder<Q extends QueryBase = QueryBase>
  extends Where
  implements QueryBase
{
  query?: QueryData;
  selectable!: Q['selectable'];
  __model?: this;
  relations = {};
  withData = {};

  constructor(public table: Q['table'], public tableAlias: Q['tableAlias']) {
    super();
  }

  toQuery<T extends this>(this: T): T & { query: QueryData } {
    return (this.query ? this : this.clone()) as T & { query: QueryData };
  }

  clone<T extends this>(this: T): T & { query: QueryData } {
    const cloned = Object.create(this);
    if (!this.__model) {
      cloned.__model = this;
    }

    cloned.query = getClonedQueryData(this.query);

    return cloned as unknown as T & { query: QueryData };
  }
}
