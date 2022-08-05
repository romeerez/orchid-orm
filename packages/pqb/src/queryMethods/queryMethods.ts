import { Expression, raw, RawExpression } from '../common';
import {
  Query,
  QueryWithData,
  Selectable,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsRows,
  SetQueryReturnsValue,
  SetQueryReturnsVoid,
  SetQueryTableAlias,
  SetQueryWindows,
} from '../query';
import {
  applyMixins,
  getClonedQueryData,
  GetTypesOrRaw,
  PropertyKeyUnionToArray,
} from '../utils';
import { HavingArg, OrderBy, toSql, WhereItem, WindowArg } from '../sql';
import {
  pushQueryArray,
  pushQueryValue,
  removeFromQuery,
  setQueryValue,
} from '../queryDataUtils';
import { Then, thenAll, thenOne, thenRows, thenValue, thenVoid } from './then';
import { ColumnShapeOutput, ColumnType, NumberColumn } from '../columnSchema';
import { Aggregate } from './aggregate';
import { Select } from './select';
import { From } from './from';
import { Join } from './join';
import { With } from './with';
import { Union } from './union';
import { Json } from './json';
import { Insert } from './insert';
import { Update } from './update';
import { Delete } from './delete';
import { Transaction } from './transaction';

type WindowResult<T extends Query, W extends WindowArg<T>> = SetQueryWindows<
  T,
  PropertyKeyUnionToArray<keyof W>
>;

export interface QueryMethods
  extends Aggregate,
    Select,
    From,
    Join,
    With,
    Union,
    Json,
    Insert,
    Update,
    Delete,
    Transaction {
  then: Then<unknown>;
}

export class QueryMethods {
  windows!: PropertyKey[];
  private __model?: Query;

  all<T extends Query>(this: T): SetQueryReturnsAll<T> {
    return this.then === thenAll
      ? (this.toQuery() as unknown as SetQueryReturnsAll<T>)
      : this.clone()._all();
  }

  _all<T extends Query>(this: T): SetQueryReturnsAll<T> {
    const q = this.toQuery();
    q.then = thenAll;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturnsAll<T>;
  }

  take<T extends Query>(this: T): SetQueryReturnsOne<T> {
    return this.then === thenOne
      ? (this as unknown as SetQueryReturnsOne<T>)
      : this.clone()._take();
  }

  _take<T extends Query>(this: T): SetQueryReturnsOne<T> {
    const q = this.toQuery();
    q.then = thenOne;
    setQueryValue(q, 'take', true);
    return q as unknown as SetQueryReturnsOne<T>;
  }

  rows<T extends Query>(this: T): SetQueryReturnsRows<T> {
    return this.then === thenRows
      ? (this as unknown as SetQueryReturnsRows<T>)
      : this.clone()._rows();
  }

  _rows<T extends Query>(this: T): SetQueryReturnsRows<T> {
    const q = this.toQuery();
    q.then = thenRows;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturnsRows<T>;
  }

  value<T extends Query, V extends ColumnType>(
    this: T,
  ): SetQueryReturnsValue<T, V> {
    return this.then === thenValue
      ? (this as unknown as SetQueryReturnsValue<T, V>)
      : this.clone()._value<T, V>();
  }

  _value<T extends Query, V extends ColumnType>(
    this: T,
  ): SetQueryReturnsValue<T, V> {
    const q = this.toQuery();
    q.then = thenValue;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturnsValue<T, V>;
  }

  exec<T extends Query>(this: T): SetQueryReturnsVoid<T> {
    return this.then === thenVoid
      ? (this as unknown as SetQueryReturnsVoid<T>)
      : this.clone()._exec();
  }

  _exec<T extends Query>(this: T): SetQueryReturnsVoid<T> {
    const q = this.toQuery();
    q.then = thenVoid;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturnsVoid<T>;
  }

  toQuery<T extends Query>(this: T): QueryWithData<T> {
    if (this.query) return this as QueryWithData<T>;
    const q = this.clone();
    return q as QueryWithData<T>;
  }

  clone<T extends Query>(this: T): QueryWithData<T> {
    let cloned;
    if (this.__model) {
      cloned = Object.create(this.__model);
      cloned.__model = this.__model;
    } else {
      cloned = Object.create(this);
      cloned.__model = this;
    }

    cloned.then = this.then;
    cloned.query = getClonedQueryData<Query>(this.query);

    return cloned as unknown as QueryWithData<T>;
  }

  toSql(this: Query): string {
    return toSql(this);
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
    ...args: GetTypesOrRaw<T['schema']['primaryTypes']>
  ): SetQueryReturnsOne<T> {
    return this.clone()._find(...args);
  }

  _find<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['schema']['primaryTypes']>
  ): SetQueryReturnsOne<T> {
    const conditions: Partial<ColumnShapeOutput<T['shape']>> = {};
    this.schema.primaryKeys.forEach((key: string, i: number) => {
      conditions[key as keyof ColumnShapeOutput<T['shape']>] = args[i];
    });
    return this._where(conditions)._take();
  }

  findBy<T extends Query>(
    this: T,
    ...args: WhereItem<T>[]
  ): SetQueryReturnsOne<T> {
    return this.clone()._findBy(...args);
  }

  _findBy<T extends Query>(
    this: T,
    ...args: WhereItem<T>[]
  ): SetQueryReturnsOne<T> {
    return this._where(...args).take();
  }

  as<T extends Query, TableAlias extends string>(
    this: T,
    tableAlias: TableAlias,
  ): SetQueryTableAlias<T, TableAlias> {
    return this.clone()._as(tableAlias) as unknown as SetQueryTableAlias<
      T,
      TableAlias
    >;
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

  withSchema<T extends Query>(this: T, schema: string): T {
    return this.clone()._withSchema(schema);
  }

  _withSchema<T extends Query>(this: T, schema: string): T {
    return setQueryValue(this, 'schema', schema);
  }

  group<T extends Query>(
    this: T,
    ...columns: (Selectable<T> | RawExpression)[]
  ): T {
    return this.clone()._group(...columns);
  }

  _group<T extends Query>(
    this: T,
    ...columns: (Selectable<T> | RawExpression)[]
  ): T {
    return pushQueryArray(this, 'group', columns);
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
  ): WindowResult<T, W> {
    return this.clone()._window(arg);
  }

  _window<T extends Query, W extends WindowArg<T>>(
    this: T,
    arg: W,
  ): WindowResult<T, W> {
    return pushQueryValue(this, 'window', arg) as unknown as WindowResult<T, W>;
  }

  wrap<T extends Query, Q extends Query, As extends string = 't'>(
    this: T,
    query: Q,
    as?: As,
  ): SetQueryTableAlias<Q, As> {
    return this.clone()._wrap(query, as);
  }

  _wrap<T extends Query, Q extends Query, As extends string = 't'>(
    this: T,
    query: Q,
    as?: As,
  ): SetQueryTableAlias<Q, As> {
    return query
      ._as(as ?? 't')
      ._from(raw(`(${this.toSql()})`)) as unknown as SetQueryTableAlias<Q, As>;
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

  forUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): T {
    return this.clone()._forUpdate(tableNames);
  }

  _forUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): T {
    return setQueryValue(this, 'for', { type: 'UPDATE', tableNames });
  }

  forNoKeyUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): T {
    return this.clone()._forNoKeyUpdate(tableNames);
  }

  _forNoKeyUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): T {
    return setQueryValue(this, 'for', { type: 'NO KEY UPDATE', tableNames });
  }

  forShare<T extends Query>(this: T, tableNames?: string[] | RawExpression): T {
    return this.clone()._forShare(tableNames);
  }

  _forShare<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): T {
    return setQueryValue(this, 'for', { type: 'SHARE', tableNames });
  }

  forKeyShare<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): T {
    return this.clone()._forKeyShare(tableNames);
  }

  _forKeyShare<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): T {
    return setQueryValue(this, 'for', { type: 'KEY SHARE', tableNames });
  }

  exists<T extends Query>(this: T): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._exists();
  }

  _exists<T extends Query>(this: T): SetQueryReturnsValue<T, NumberColumn> {
    const q = setQueryValue(this, 'select', [
      { selectAs: { exists: raw('1') } },
    ]);
    return q._value<T, NumberColumn>();
  }
}

QueryMethods.prototype.then = thenAll;

applyMixins(QueryMethods, [
  Aggregate,
  Select,
  From,
  Join,
  With,
  Union,
  Json,
  Insert,
  Update,
  Delete,
  Transaction,
]);
