import { toSql } from './sql/toSql';
import { AliasOrTable, Column, Expression, raw, RawExpression } from './common';
import { AllColumns, Query } from './query';
import { GetTypesOrRaw, Spread, PropertyKeyUnionToArray } from './utils';
import {
  HavingArg,
  OrderBy,
  QueryData,
  UnionArg,
  WhereItem,
  WindowArg,
} from './sql/types';
import { Output } from './schema';

type QueryDataArrays<T extends Query> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof QueryData<T>]: QueryData<T>[K] extends Array<any>
    ? QueryData<T>[K]
    : never;
};

export const removeFromQuery = <T extends Query>(
  q: { query?: QueryData<T> },
  key: keyof QueryData<T>,
) => {
  if (q.query) delete q.query[key];
};

export const setQueryValue = <T extends Query, K extends keyof QueryData<T>>(
  self: T,
  key: K,
  value: QueryData<T>[K],
): T => {
  const q = self.toQuery();
  q.query[key] = value;
  return q;
};

export const pushQueryArray = <T extends Query, K extends keyof QueryData<T>>(
  self: T,
  key: K,
  value: QueryData<T>[K],
): T => {
  const q = self.toQuery();
  if (!q.query[key]) q.query[key] = value;
  else (q.query[key] as unknown[]).push(...(value as unknown[]));
  return q;
};

export const pushQueryValue = <
  T extends Query,
  K extends keyof QueryDataArrays<T>,
>(
  self: T,
  key: K,
  value: QueryDataArrays<T>[K][number],
): T => {
  const q = self.toQuery();
  if (!q.query[key]) q.query[key] = [value] as QueryData<T>[K];
  else (q.query[key] as unknown[]).push(value);
  return q;
};

export type QueryReturnType = 'all' | 'one' | 'rows' | 'value' | 'void';

export type JoinedTablesBase = Record<string, Query>;

export type SetQuery<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Query = any,
  Result = T['result'],
  ReturnType extends QueryReturnType = T['returnType'],
  TableAlias extends string | undefined = T['tableAlias'],
  JoinedTables extends JoinedTablesBase = T['joinedTables'],
  Windows extends PropertyKey[] = T['windows'],
  R = FinalizeQueryResult<T, Result>,
> = Omit<
  T,
  'result' | 'returnType' | 'tableAlias' | 'joinedTables' | 'then' | 'windows'
> & {
  result: Result;
  returnType: ReturnType;
  tableAlias: TableAlias;
  joinedTables: JoinedTables;
  then: ReturnType extends 'all'
    ? Then<R[]>
    : ReturnType extends 'one'
    ? Then<R>
    : ReturnType extends 'value'
    ? Then<R>
    : ReturnType extends 'rows'
    ? Then<R[keyof R]>
    : ReturnType extends 'void'
    ? Then<void>
    : never;
  windows: Windows;
};

export type FinalizeQueryResult<
  T extends Query,
  Result,
> = Result extends AllColumns
  ? Output<Pick<T['shape'], T['defaultSelectColumns'][number]>>
  : Result;

export type AddQuerySelect<T extends Query, ResultArg> = SetQuery<
  T,
  T['result'] extends AllColumns ? ResultArg : Spread<[T['result'], ResultArg]>
>;

export type SetQueryReturns<
  T extends Query,
  R extends QueryReturnType,
> = SetQuery<T, T['result'], R>;

export type SetQueryReturnsValue<T extends Query, R> = SetQuery<T, R, 'value'>;

// export type SetQueryTableAlias<
//   T extends Query,
//   TableAlias extends string,
// > = SetQuery<T, T['result'], T['returnType'], TableAlias>;

export type SetQueryTableAlias<
  T extends Query,
  TableAlias extends string,
> = Omit<T, 'tableAlias'> & { tableAlias: TableAlias };

export type SetQueryJoinedTables<
  T extends Query,
  JoinedTables extends JoinedTablesBase,
> = Omit<T, 'joinedTables'> & { joinedTables: JoinedTables };

export type AddQueryJoinedTable<
  T extends Query,
  J extends Query,
> = SetQueryJoinedTables<
  T,
  Spread<[T['joinedTables'], Record<AliasOrTable<J>, J>]>
>;

export type SetQueryWindows<
  T extends Query,
  W extends PropertyKey[],
> = SetQuery<
  T,
  T['result'],
  T['returnType'],
  T['tableAlias'],
  T['joinedTables'],
  W
>;

type Result<T extends Query> = T['result'] extends AllColumns
  ? T['type']
  : T['result'];

export type Then<Res> = <T extends Query>(
  this: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (value: Res) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
) => Promise<Res | never>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const thenAll: Then<any[]> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then((result) => result.rows)
    .then(resolve, reject);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const thenOne: Then<any> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then((result) => result.rows[0])
    .then(resolve, reject);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const thenRows: Then<any[][]> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => result.rows)
    .then(resolve, reject);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const thenValue: Then<any> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => result.rows[0]?.[0])
    .then(resolve, reject);
};

const thenVoid: Then<void> = function (resolve, reject) {
  return this.adapter.query(this.toSql()).then(() => resolve?.(), reject);
};

type JoinCallbackQuery<T extends Query, J extends Query> = AddQueryJoinedTable<
  J,
  T
> &
  JoinCallbackMethods<T>;

type JoinCallbackMethods<J extends Query> = {
  on: On<J>;
  _on: On<J>;
  onOr: On<J>;
  _onOr: On<J>;
};

type On<J extends Query> = <T extends Query & JoinCallbackMethods<J>>(
  this: T,
  leftColumn: Column<T>,
  op: string,
  rightColumn: Column<T>,
) => T;

const on: On<Query> = function (leftColumn, op, rightColumn) {
  return this._on(leftColumn, op, rightColumn);
};

const _on: On<Query> = function (leftColumn, op, rightColumn) {
  return pushQueryValue(this, 'and', [leftColumn, op, rightColumn]);
};

const onOr: On<Query> = function (leftColumn, op, rightColumn) {
  return this._on(leftColumn, op, rightColumn);
};

const _onOr: On<Query> = function (leftColumn, op, rightColumn) {
  return pushQueryArray(this, 'or', [[leftColumn, op, rightColumn]]);
};

const joinCallbackMethods: JoinCallbackMethods<Query> = {
  on,
  _on,
  onOr,
  _onOr,
};

export type JoinArg<
  T extends Query,
  Q extends Query,
  Rel extends keyof T['relations'] | undefined,
> =
  | [relation: Rel]
  | [query: Q, leftColumn: Column<Q>, op: string, rightColumn: Column<T>]
  | [query: Q, raw: RawExpression]
  | [query: Q, on: (q: JoinCallbackQuery<T, Q>) => Query];

export class QueryMethods {
  // then!: Then<Output<S>[]>;
  then!: Then<any>;
  windows!: PropertyKey[];
  private __model?: Query;

  all<T extends Query>(this: T): SetQueryReturns<T, 'all'> {
    return this.then === thenAll
      ? (this.toQuery() as unknown as SetQueryReturns<T, 'all'>)
      : this.clone()._all();
  }

  _all<T extends Query>(this: T): SetQueryReturns<T, 'all'> {
    const q = this.toQuery();
    q.then = thenAll;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturns<T, 'all'>;
  }

  take<T extends Query>(this: T): SetQueryReturns<T, 'one'> {
    return this.then === thenOne
      ? (this as unknown as SetQueryReturns<T, 'one'>)
      : this.clone()._take();
  }

  _take<T extends Query>(this: T): SetQueryReturns<T, 'one'> {
    const q = this.toQuery();
    q.then = thenOne;
    setQueryValue(q, 'take', true);
    return q as unknown as SetQueryReturns<T, 'one'>;
  }

  rows<T extends Query>(this: T): SetQueryReturns<T, 'rows'> {
    return this.then === thenRows
      ? (this as unknown as SetQueryReturns<T, 'rows'>)
      : this.clone()._rows();
  }

  _rows<T extends Query>(this: T): SetQueryReturns<T, 'rows'> {
    const q = this.toQuery();
    q.then = thenRows;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturns<T, 'rows'>;
  }

  value<T extends Query, V>(this: T): SetQueryReturnsValue<T, V> {
    return this.then === thenValue
      ? (this as unknown as SetQueryReturnsValue<T, V>)
      : this.clone()._value<T, V>();
  }

  _value<T extends Query, V>(this: T): SetQueryReturnsValue<T, V> {
    const q = this.toQuery();
    q.then = thenValue;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturnsValue<T, V>;
  }

  exec<T extends Query>(this: T): SetQueryReturns<T, 'void'> {
    return this.then === thenVoid
      ? (this as unknown as SetQueryReturns<T, 'void'>)
      : this.clone()._exec();
  }

  _exec<T extends Query>(this: T): SetQueryReturns<T, 'void'> {
    const q = this.toQuery();
    q.then = thenVoid;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturns<T, 'void'>;
  }

  toQuery<T extends Query>(this: T): T & { query: QueryData<T> } {
    if (this.query) return this as T & { query: QueryData<T> };
    const q = this.clone();
    return q as T & { query: QueryData<T> };
  }

  clone<T extends Query>(this: T): T & { query: QueryData<T> } {
    let cloned;
    if (this.__model) {
      cloned = Object.create(this.__model);
      cloned.__model = this.__model;
    } else {
      cloned = Object.create(this);
      cloned.__model = this;
    }

    cloned.then = this.then;
    cloned.query = {};

    if (this.query) {
      for (const key in this.query) {
        const value = this.query[key as keyof QueryData<T>];
        if (Array.isArray(value)) {
          (cloned.query as Record<string, unknown>)[key] = [...value];
        } else {
          (cloned.query as Record<string, unknown>)[key] = value;
        }
      }
    }

    return cloned as unknown as T & { query: QueryData<T> };
  }

  toSql(this: Query): string {
    return toSql(this);
  }

  asType<T extends Query>(this: T): <S>() => SetQuery<T, S> {
    return <S>() => this as unknown as SetQuery<T, S>;
  }

  select<T extends Query, K extends Column<T>[]>(
    this: T,
    ...columns: K
  ): AddQuerySelect<T, Pick<T['type'], K[number]>> {
    return this.clone()._select(...columns);
  }

  _select<T extends Query, K extends Column<T>[]>(
    this: T,
    ...columns: K
  ): AddQuerySelect<T, Pick<T['type'], K[number]>> {
    if (!columns.length) return this;
    return pushQueryArray(this, 'select', columns);
  }

  selectAs<
    T extends Query,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    S extends Record<string, Column<T> | Query | RawExpression<any>>,
  >(
    this: T,
    select: S,
  ): AddQuerySelect<
    T,
    {
      [K in keyof S]: S[K] extends keyof T['type']
        ? T['type'][S[K]]
        : S[K] extends RawExpression<infer Type>
        ? Type
        : S[K] extends Query
        ? Result<S[K]>
        : never;
    }
  > {
    return this.clone()._selectAs(select) as any;
  }

  _selectAs<
    T extends Query,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    S extends Record<string, keyof T['type'] | Query | RawExpression<any>>,
  >(
    this: T,
    select: S,
  ): AddQuerySelect<
    T,
    {
      [K in keyof S]: S[K] extends keyof T['type']
        ? T['type'][S[K]]
        : S[K] extends RawExpression<infer Type>
        ? Type
        : S[K] extends Query
        ? Result<S[K]>
        : never;
    }
  > {
    return pushQueryValue(this, 'select', { selectAs: select });
  }

  distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return this.clone()._distinct(...columns);
  }

  _distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return pushQueryArray(this, 'distinct', columns as string[]);
  }

  and<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this.where(...args);
  }

  _and<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this._where(...args);
  }

  where<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this.clone()._where(...args);
  }

  _where<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return pushQueryArray(this, 'and', args);
  }

  or<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this.clone()._or(...args);
  }

  _or<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return pushQueryArray(
      this,
      'or',
      args.map((arg) => [arg]),
    );
  }

  find<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['primaryTypes']>
  ): SetQueryReturns<T, 'one'> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.clone()._find as any)(...(args as unknown[]));
  }

  _find<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['primaryTypes']>
  ): SetQueryReturns<T, 'one'> {
    const conditions: Partial<Output<T['shape']>> = {};
    this.primaryKeys.forEach((key: string, i: number) => {
      conditions[key as keyof Output<T['shape']>] = args[i];
    });
    return this._where(conditions)._take();
  }

  findBy<T extends Query>(
    this: T,
    ...args: WhereItem<T>[]
  ): SetQueryReturns<T, 'one'> {
    return this.clone()._findBy(...args);
  }

  _findBy<T extends Query>(
    this: T,
    ...args: WhereItem<T>[]
  ): SetQueryReturns<T, 'one'> {
    return this._where(...args).take();
  }

  as<T extends Query, TableAlias extends string>(
    this: T,
    tableAlias: TableAlias,
  ): SetQueryTableAlias<T, TableAlias> {
    return this.clone()._as(tableAlias);
  }

  _as<T extends Query, TableAlias extends string>(
    this: T,
    tableAlias: TableAlias,
  ): SetQueryTableAlias<T, TableAlias> {
    return setQueryValue(
      this,
      'as',
      tableAlias,
    ) as unknown as SetQueryTableAlias<T, TableAlias>;
  }

  from<
    T extends Query,
    Args extends [queryOrRaw: Query | RawExpression, as?: string | false],
  >(
    this: T,
    ...args: Args
  ): SetQueryTableAlias<
    Args[0] extends Query ? Args[0] : T,
    Args[1] extends string ? Args[1] : 't'
  > {
    return this.clone()._from(...args);
  }

  _from<
    T extends Query,
    Args extends [queryOrRaw: Query | RawExpression, as?: string | false],
  >(
    this: T,
    ...args: Args
  ): SetQueryTableAlias<
    Args[0] extends Query ? Args[0] : T,
    Args[1] extends string ? Args[1] : 't'
  > {
    return setQueryValue(
      args[1] === false ? this : this._as(args[1] || 't'),
      'from',
      args[0],
    ) as unknown as SetQueryTableAlias<
      Args[0] extends Query ? Args[0] : T,
      Args[1] extends string ? Args[1] : 't'
    >;
  }

  group<T extends Query>(
    this: T,
    ...columns: (keyof T['type'] | RawExpression)[]
  ): T {
    return this.clone()._group(...columns);
  }

  _group<T extends Query>(
    this: T,
    ...columns: (keyof T['type'] | RawExpression)[]
  ): T {
    return pushQueryArray(this, 'group', columns as string[]);
  }

  having<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return this.clone()._having(...args);
  }

  _having<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return pushQueryArray(this, 'having', args);
  }

  window<T extends Query, W extends WindowArg<T>>(
    this: T,
    arg: W,
  ): SetQueryWindows<T, PropertyKeyUnionToArray<keyof W>> {
    return this.clone()._window(arg);
  }

  _window<T extends Query, W extends WindowArg<T>>(
    this: T,
    arg: W,
  ): SetQueryWindows<T, PropertyKeyUnionToArray<keyof W>> {
    return pushQueryValue(this, 'window', arg) as unknown as SetQueryWindows<
      T,
      PropertyKeyUnionToArray<keyof W>
    >;
  }

  json<T extends Query>(this: T): SetQueryReturnsValue<T, string> {
    return this.clone()._json();
  }

  _json<T extends Query>(this: T): SetQueryReturnsValue<T, string> {
    const innerSql = `(${this.toSql()})`;

    const q = this._selectAs({
      json: raw(
        this.query?.take
          ? `COALESCE(row_to_json("t".*), '{}')`
          : `COALESCE(json_agg(row_to_json("t".*)), '[]')`,
      ),
    }).from(raw(innerSql));

    return q._value<typeof q, string>() as unknown as SetQueryReturnsValue<
      T,
      string
    >;
  }

  union<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._union(...args);
  }

  _union<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'UNION' as const })),
    );
  }

  unionAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._unionAll(...args);
  }

  _unionAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'UNION ALL' as const })),
    );
  }

  intersect<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._intersect(...args);
  }

  _intersect<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'INTERSECT' as const })),
    );
  }

  intersectAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._intersectAll(...args);
  }

  _intersectAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'INTERSECT ALL' as const })),
    );
  }

  except<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._except(...args);
  }

  _except<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'EXCEPT' as const })),
    );
  }

  exceptAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._exceptAll(...args);
  }

  _exceptAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'EXCEPT ALL' as const })),
    );
  }

  order<T extends Query>(this: T, ...args: OrderBy<T>[]): T {
    return this.clone()._order(...args);
  }

  _order<T extends Query>(this: T, ...args: OrderBy<T>[]): T {
    return pushQueryArray(this, 'order', args);
  }

  limit<T extends Query>(this: T, arg: number): T {
    return this.clone()._limit(arg);
  }

  _limit<T extends Query>(this: T, arg: number): T {
    return setQueryValue(this, 'limit', arg);
  }

  offset<T extends Query>(this: T, arg: number): T {
    return this.clone()._offset(arg);
  }

  _offset<T extends Query>(this: T, arg: number): T {
    return setQueryValue(this, 'offset', arg);
  }

  for<T extends Query>(this: T, ...args: RawExpression[]): T {
    return this.clone()._for(...args);
  }

  _for<T extends Query>(this: T, ...args: RawExpression[]): T {
    return pushQueryArray(this, 'for', args);
  }

  exists<T extends Query>(this: T): SetQueryReturnsValue<T, { exists: 1 }> {
    return this.clone()._exists();
  }

  _exists<T extends Query>(this: T): SetQueryReturnsValue<T, { exists: 1 }> {
    const q = setQueryValue(this, 'select', [
      { selectAs: { exists: raw('1') } },
    ]);
    return q._value<T, { exists: 1 }>();
  }

  join<
    T extends Query,
    Q extends Query,
    Rel extends keyof T['relations'] | undefined = undefined,
  >(
    this: T,
    ...args: JoinArg<T, Q, Rel>
  ): AddQueryJoinedTable<
    T,
    Rel extends keyof T['relations'] ? T['relations'][Rel]['query'] : Q
  > {
    return this.clone()._join(...args) as any;
  }

  _join<
    T extends Query,
    Q extends Query,
    Rel extends keyof T['relations'] | undefined = undefined,
  >(
    this: T,
    ...args: JoinArg<T, Q, Rel>
  ): AddQueryJoinedTable<
    T,
    Rel extends keyof T['relations'] ? T['relations'][Rel]['query'] : Q
  > {
    if (typeof args[0] === 'object' && typeof args[1] === 'function') {
      const [model, arg] = args;
      const q = model.clone();
      const clone = q.clone;
      q.clone = function <T extends Query>(
        this: T,
      ): T & { query: QueryData<T> } {
        const cloned = clone.call(q);
        Object.assign(cloned, joinCallbackMethods);
        return cloned as T & { query: QueryData<T> };
      };
      Object.assign(q, joinCallbackMethods);

      const resultQuery = arg(q as unknown as JoinCallbackQuery<T, Q>);
      return pushQueryValue(this, 'join', [model, resultQuery]) as any;
    } else {
      return pushQueryValue(this, 'join', args) as any;
    }
  }
}

QueryMethods.prototype.then = thenAll;
