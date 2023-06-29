import { Query } from '../query';
import { ColumnOperators, QueryData } from '../sql';
import {
  pushQueryArray,
  pushQueryValue,
  setQueryObjectValue,
} from '../queryDataUtils';
import { JoinArgs, JoinCallback, JoinFirstArg } from './join';
import {
  ColumnsShapeBase,
  emptyObject,
  Expression,
  MaybeArray,
  TemplateLiteralArgs,
} from 'orchid-core';
import { getIsJoinSubQuery } from '../sql/join';
import { getShapeFromSelect } from './select';
import { ColumnsShape } from '../columns';
import { QueryBase } from '../queryBase';
import { RawSQL } from '../sql/rawSql';
import { saveSearchAlias, SearchArg } from './search';

export type WhereArg<T extends QueryBase> =
  | {
      [K in
        | keyof T['selectable']
        | 'NOT'
        | 'OR'
        | 'IN'
        | 'EXISTS'
        | 'SEARCH']?: K extends 'NOT'
        ? MaybeArray<WhereArg<T>>
        : K extends 'OR'
        ? MaybeArray<WhereArg<T>>[]
        : K extends 'IN'
        ? MaybeArray<{
            columns: (keyof T['selectable'])[];
            values: unknown[][] | Query | Expression;
          }>
        : K extends 'SEARCH'
        ? MaybeArray<SearchArg<T, never>>
        : K extends keyof T['selectable']
        ?
            | T['selectable'][K]['column']['type']
            | null
            | ColumnOperators<T['selectable'], K>
            | Expression
        : never;
    }
  | QueryBase
  | Expression
  | ((q: WhereQueryBuilder<T>) => WhereQueryBuilder);

export type WhereArgs<T extends QueryBase> =
  | WhereArg<T>[]
  | TemplateLiteralArgs;

export type WhereInColumn<T extends QueryBase> =
  | keyof T['selectable']
  | [keyof T['selectable'], ...(keyof T['selectable'])[]];

export type WhereInValues<
  T extends QueryBase,
  Column extends WhereInColumn<T>,
> = Column extends keyof T['selectable']
  ? T['selectable'][Column]['column']['type'][] | Query | Expression
  :
      | ({
          [I in keyof Column]: Column[I] extends keyof T['selectable']
            ? T['selectable'][Column[I]]['column']['type']
            : never;
        } & {
          length: Column extends { length: number } ? Column['length'] : never;
        })[]
      | Query
      | Expression;

export type WhereResult<T extends QueryBase> = T & {
  meta: {
    hasWhere: true;
  };
};

export type WhereInArg<T extends Pick<Query, 'selectable'>> = {
  [K in keyof T['selectable']]?:
    | T['selectable'][K]['column']['type'][]
    | Query
    | Expression;
};

const processArg = <T extends QueryBase>(
  q: T,
  arg: WhereArg<T>,
): WhereArg<T> => {
  if ((arg as { NOT: WhereArg<T> }).NOT) {
    return {
      ...arg,
      NOT: processArg(q, (arg as { NOT: WhereArg<T> }).NOT),
    } as WhereArg<T>;
  }

  if ((arg as { SEARCH: SearchArg<T, never> }).SEARCH) {
    let { SEARCH } = arg as {
      SEARCH: SearchArg<T, string>;
    };

    if (!SEARCH.as) {
      const as = saveSearchAlias(q, '@q');

      SEARCH = {
        ...SEARCH,
        as,
      };

      arg = { ...arg, SEARCH } as WhereArg<T>;
    }

    setQueryObjectValue(q, 'sources', SEARCH.as as string, SEARCH);
    if (SEARCH.order) {
      pushQueryValue(q, 'order', SEARCH.as);
    }
  }

  return arg;
};

const processArgs = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereArg<T>[] => {
  for (let i = args.length - 1; i >= 0; i--) {
    if (
      (args[i] as { SEARCH: SearchArg<T, never> }).SEARCH ||
      (args[i] as { NOT: WhereArg<T> }).NOT
    ) {
      args[i] = processArg(q, args[i]);
    }
  }
  return args;
};

export const addWhere = <T extends QueryBase>(
  q: T,
  args: WhereArgs<T>,
): WhereResult<T> => {
  if (Array.isArray(args[0])) {
    return pushQueryValue(
      q,
      'and',
      new RawSQL(args as TemplateLiteralArgs),
    ) as unknown as WhereResult<T>;
  }

  return pushQueryArray(
    q,
    'and',
    processArgs(q, args as WhereArg<T>[]),
  ) as unknown as WhereResult<T>;
};

export const addWhereNot = <T extends QueryBase>(
  q: T,
  args: WhereArgs<T>,
): WhereResult<T> => {
  if (Array.isArray(args[0])) {
    return pushQueryValue(q, 'and', {
      NOT: new RawSQL(args as TemplateLiteralArgs),
    }) as unknown as WhereResult<T>;
  }
  return pushQueryValue(q, 'and', {
    NOT: processArgs(q, args as WhereArg<T>[]),
  }) as unknown as WhereResult<T>;
};

export const addOr = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [processArg(q, item)]),
  ) as unknown as WhereResult<T>;
};

export const addOrNot = <T extends QueryBase>(
  q: T,
  args: WhereArg<T>[],
): WhereResult<T> => {
  return pushQueryArray(
    q,
    'or',
    args.map((item) => [{ NOT: processArg(q, item) }]),
  ) as unknown as WhereResult<T>;
};

export const addWhereIn = <T extends QueryBase>(
  q: T,
  and: boolean,
  arg: unknown,
  values: unknown[] | unknown[][] | Query | Expression | undefined,
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

const existsArgs = (args: [JoinFirstArg<Query>, ...JoinArgs<Query, Query>]) => {
  const q = args[0];

  let isSubQuery;
  if (typeof q === 'object') {
    isSubQuery = getIsJoinSubQuery(q.q, q.baseQuery.q);
    if (isSubQuery) {
      args[0] = q.clone();
      args[0].shape = getShapeFromSelect(q, true) as ColumnsShape;
    }
  } else {
    isSubQuery = false;
  }

  return {
    EXISTS: {
      args,
      isSubQuery,
    },
  } as never;
};

export abstract class Where extends QueryBase {
  where<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
    return this.clone()._where(...args);
  }

  _where<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
    return addWhere(this, args);
  }

  whereNot<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
    return this.clone()._whereNot(...args);
  }

  _whereNot<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
    return addWhereNot(this, args);
  }

  and<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
    return this.where(...args);
  }

  _and<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
    return this._where(...args);
  }

  andNot<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
    return this.whereNot(...args);
  }

  _andNot<T extends Where>(this: T, ...args: WhereArgs<T>): WhereResult<T> {
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
  ): WhereResult<T>;
  whereIn<T extends Where>(this: T, arg: WhereInArg<T>): WhereResult<T>;
  whereIn<T extends Where>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | Expression,
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
    values?: unknown[] | unknown[][] | Query | Expression,
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
    values?: unknown[] | unknown[][] | Query | Expression,
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
    values?: unknown[] | unknown[][] | Query | Expression,
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
    values?: unknown[] | unknown[][] | Query | Expression,
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
    values?: unknown[] | unknown[][] | Query | Expression,
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
    values?: unknown[] | unknown[][] | Query | Expression,
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
    values?: unknown[] | unknown[][] | Query | Expression,
  ): WhereResult<T> {
    return addWhereIn(this, false, arg, values, true);
  }

  whereExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    ...args: JoinArgs<T, Arg>
  ): WhereResult<T>;
  whereExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereExists(arg: any, ...args: any) {
    return this.clone()._whereExists(arg, ...args);
  }
  _whereExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    ...args: JoinArgs<T, Arg>
  ): WhereResult<T>;
  _whereExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereExists(this: Where, ...args: any) {
    return this._where(existsArgs(args));
  }

  orWhereExists<
    T extends Where,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  orWhereExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereExists(arg: any, ...args: any) {
    return this.clone()._orWhereExists(arg, ...args);
  }
  _orWhereExists<
    T extends Where,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  _orWhereExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _orWhereExists(this: Where, ...args: any) {
    return this._or(existsArgs(args));
  }

  whereNotExists<
    T extends Where,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  whereNotExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereNotExists(arg: any, ...args: any) {
    return this.clone()._whereNotExists(arg, ...args);
  }
  _whereNotExists<
    T extends Where,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  _whereNotExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whereNotExists(this: Where, ...args: any) {
    return this._whereNot(existsArgs(args));
  }

  orWhereNotExists<
    T extends Where,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  orWhereNotExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orWhereNotExists(arg: any, ...args: any) {
    return this.clone()._orWhereNotExists(arg, ...args);
  }
  _orWhereNotExists<
    T extends Where,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): WhereResult<T>;
  _orWhereNotExists<T extends Where, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): WhereResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _orWhereNotExists(this: Where, ...args: any) {
    return this._orNot(existsArgs(args));
  }
}

export class WhereQueryBuilder<Q extends QueryBase = QueryBase>
  extends Where
  implements QueryBase
{
  declare selectable: Q['selectable'];
  declare relations: Q['relations'];
  declare result: Q['result'];
  shape: Q['shape'];
  baseQuery: Query;
  withData = emptyObject;
  internal: Q['internal'];

  constructor(
    q: QueryBase,
    { shape, joinedShapes }: Pick<QueryData, 'shape' | 'joinedShapes'>,
  ) {
    super();
    this.internal = q.internal;
    this.table = typeof q === 'object' ? q.table : q;
    this.shape = shape;
    this.q = {
      shape: shape as ColumnsShapeBase,
      joinedShapes,
    } as QueryData;
    this.baseQuery = this as unknown as Query;
    if (typeof q === 'object' && q.q.as) {
      this.q.as = q.q.as;
    }
  }
}
