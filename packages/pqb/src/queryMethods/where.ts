import { Query, QueryBase, SelectableBase, WithDataBase } from '../query';
import { ColumnOperators, QueryData } from '../sql';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { RawExpression } from '../common';
import { getClonedQueryData, MaybeArray } from '../utils';
import { JoinArgs, JoinCallback, JoinCallbackArg } from './join';
import { RelationsBase } from '../relations';

export type WhereArg<T extends QueryBase> =
  | (Omit<
      {
        [K in keyof T['selectable']]?:
          | T['selectable'][K]['column']['type']
          | ColumnOperators<T['selectable'], K>
          | RawExpression;
      },
      'NOT' | 'OR' | 'IN' | 'EXISTS'
    > & {
      NOT?: MaybeArray<WhereArg<T>>;
      OR?: MaybeArray<WhereArg<T>>[];
      IN?: MaybeArray<{
        columns: (keyof T['selectable'])[];
        values: unknown[][] | Query | RawExpression;
      }>;
      EXISTS?: MaybeArray<JoinArgs<T> | JoinCallbackArg<T>>;
    })
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

export const addWhere = <T extends Where>(q: T, args: WhereArg<T>[]): T => {
  return pushQueryArray(q, 'and', args) as T;
};

export const addWhereNot = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): T => {
  return pushQueryValue(q, 'and', {
    NOT: args,
  });
};

export const addOr = <T extends QueryBase>(q: T, args: WhereArg<T>[]): T => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [item]),
  );
};

export const addOrNot = <T extends QueryBase>(q: T, args: WhereArg<T>[]): T => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ NOT: item }]),
  );
};

export const addWhereIn = <T extends QueryBase>(
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
        columns: arg,
        values,
      };
      if (not) item = { NOT: item };
    } else {
      item = {
        type: 'object',
        data: { [arg as string]: { [op]: values } },
      };
    }
  } else {
    item = {} as Record<string, { in: unknown[] }>;
    for (const key in arg as Record<string, unknown[]>) {
      item[key] = { [op as 'in']: (arg as Record<string, unknown[]>)[key] };
    }
  }

  if (and) {
    pushQueryValue(q, 'and', item);
  } else {
    pushQueryValue(q, 'or', [item]);
  }

  return q;
};

export abstract class Where implements QueryBase {
  abstract clone<T extends this>(this: T): T;
  abstract selectable: SelectableBase;
  abstract relations: RelationsBase;
  abstract withData: WithDataBase;

  query = {} as QueryData;
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
    return addWhereIn(this, true, arg, values);
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
    return addWhereIn(this, false, arg, values);
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
    return addWhereIn(this, true, arg, values, true);
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
    return addWhereIn(this, false, arg, values, true);
  }

  whereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  whereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereExists(...args: any) {
    return this.clone()._whereExists(...args);
  }
  _whereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  _whereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereExists(this: Where, ...args: any) {
    return this._where({ EXISTS: args });
  }

  orWhereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  orWhereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereExists(...args: any) {
    return this.clone()._orWhereExists(...args);
  }
  _orWhereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  _orWhereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _orWhereExists(this: Where, ...args: any) {
    return this._or({ EXISTS: args });
  }

  whereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  whereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereNotExists(...args: any) {
    return this.clone()._whereNotExists(...args);
  }
  _whereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  _whereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereNotExists(this: Where, ...args: any) {
    return this._whereNot({ EXISTS: args });
  }

  orWhereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  orWhereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereNotExists(...args: any) {
    return this.clone()._orWhereNotExists(...args);
  }
  _orWhereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): T;
  _orWhereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _orWhereNotExists(this: Where, ...args: any) {
    return this._orNot({ EXISTS: args });
  }
}

export class WhereQueryBuilder<Q extends QueryBase = QueryBase>
  extends Where
  implements QueryBase
{
  query = {} as QueryData;
  selectable!: Q['selectable'];
  __model?: this;
  relations = {};
  withData = {};

  constructor(public table: Q['table'], public tableAlias: Q['tableAlias']) {
    super();
  }

  clone<T extends this>(this: T): T {
    const cloned = Object.create(this);
    if (!this.__model) {
      cloned.__model = this;
    }

    cloned.query = getClonedQueryData(this.query);

    return cloned as unknown as T;
  }
}
