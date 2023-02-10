import { Query, QueryBase, SelectableBase, WithDataBase } from '../query';
import { ColumnOperators, QueryData } from '../sql';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { getClonedQueryData, MaybeArray } from '../utils';
import { JoinArgs, JoinCallback, JoinCallbackArg } from './join';
import { RelationsBase } from '../relations';
import { ColumnsShape } from '../columns';
import { RawExpression } from '../raw';

export type WhereArg<T extends QueryBase> =
  | (Omit<
      {
        [K in keyof T['selectable']]?:
          | T['selectable'][K]['column']['type']
          | null
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

export type WhereResult<T extends QueryBase> = T & {
  hasWhere: true;
};

export type WhereInArg<T extends Pick<Query, 'selectable'>> = {
  [K in keyof T['selectable']]?:
    | T['selectable'][K]['column']['type'][]
    | Query
    | RawExpression;
};

export const addWhere = <T extends Where>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryArray(q, 'and', args) as unknown as WhereResult<T>;
};

export const addWhereNot = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryValue(q, 'and', {
    NOT: args,
  }) as unknown as WhereResult<T>;
};

export const addOr = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [item]),
  ) as unknown as WhereResult<T>;
};

export const addOrNot = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ NOT: item }]),
  ) as unknown as WhereResult<T>;
};

export const addWhereIn = <T extends QueryBase>(
  q: T,
  and: boolean,
  arg: unknown,
  values: unknown[] | unknown[][] | Query | RawExpression | undefined,
  not?: boolean,
): WhereResult<T> => {
  const op = not ? 'notIn' : 'in';

  let item;
  if (values) {
    if (Array.isArray(arg)) {
      item = {
        IN: {
          columns: arg,
          values,
        },
      };
      if (not) item = { NOT: item };
    } else {
      item = { [arg as string]: { [op]: values } };
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

  return q as unknown as WhereResult<T>;
};

export abstract class Where implements QueryBase {
  abstract clone<T extends this>(this: T): T;
  abstract selectable: SelectableBase;
  abstract shape: ColumnsShape;
  abstract relations: RelationsBase;
  abstract withData: WithDataBase;
  abstract __table: Query;

  query = {} as QueryData;
  table?: string;
  tableAlias?: string;

  where<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this.clone()._where(...args);
  }

  _where<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return addWhere(this, args);
  }

  whereNot<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this.clone()._whereNot(...args);
  }

  _whereNot<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return addWhereNot(this, args);
  }

  and<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this.where(...args);
  }

  _and<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this._where(...args);
  }

  andNot<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this.whereNot(...args);
  }

  _andNot<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this._whereNot(...args);
  }

  or<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this.clone()._or(...args);
  }

  _or<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return addOr(this, args);
  }

  orNot<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
    return this.clone()._orNot(...args);
  }

  _orNot<T extends Where>(this: T, ...args: WhereArg<T>[]): WhereResult<T> {
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
  ): WhereResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereIn(
      arg as any,
      values as any,
    ) as unknown as WhereResult<T>;
  }

  _whereIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _whereIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  _whereIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): WhereResult<T> {
    return addWhereIn(this, true, arg, values);
  }

  orWhereIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  orWhereIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  orWhereIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): WhereResult<T> {
    return this.clone()._orWhereIn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      arg as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values as any,
    ) as unknown as WhereResult<T>;
  }

  _orWhereIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _orWhereIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  _orWhereIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): WhereResult<T> {
    return addWhereIn(this, false, arg, values);
  }

  whereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  whereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  whereNotIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): WhereResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereNotIn(arg as any, values as any);
  }

  _whereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _whereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  _whereNotIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): WhereResult<T> {
    return addWhereIn(this, true, arg, values, true);
  }

  orWhereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  orWhereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  orWhereNotIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): WhereResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereNotIn(arg as any, values as any);
  }

  _orWhereNotIn<T extends Where, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): WhereResult<T>;
  _orWhereNotIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  _orWhereNotIn<T extends Where>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): WhereResult<T> {
    return addWhereIn(this, false, arg, values, true);
  }

  whereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  whereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereExists(...args: any) {
    return this.clone()._whereExists(...args);
  }
  _whereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  _whereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereExists(this: Where, ...args: any) {
    return this._where({ EXISTS: args });
  }

  orWhereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  orWhereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereExists(...args: any) {
    return this.clone()._orWhereExists(...args);
  }
  _orWhereExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  _orWhereExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _orWhereExists(this: Where, ...args: any) {
    return this._or({ EXISTS: args });
  }

  whereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  whereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereNotExists(...args: any) {
    return this.clone()._whereNotExists(...args);
  }
  _whereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  _whereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereNotExists(this: Where, ...args: any) {
    return this._whereNot({ EXISTS: args });
  }

  orWhereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  orWhereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereNotExists(...args: any) {
    return this.clone()._orWhereNotExists(...args);
  }
  _orWhereNotExists<T extends Where, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): WhereResult<T>;
  _orWhereNotExists<T extends Where, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
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
  shape: Q['shape'];
  relations!: Q['relations'];
  __table: Query;
  withData = {};

  constructor(q: QueryBase | string, shape: ColumnsShape) {
    super();
    this.table = typeof q === 'object' ? q.table : q;
    this.shape = shape;
    this.__table = this as unknown as Query;
    if (typeof q === 'object' && q.query.as) {
      this.query.as = q.query.as;
    }
  }

  clone<T extends this>(this: T): T {
    const cloned = Object.create(this.__table);
    cloned.query = getClonedQueryData(this.query);
    return cloned as unknown as T;
  }
}
