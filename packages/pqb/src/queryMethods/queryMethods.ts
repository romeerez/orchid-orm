import { Expression, raw, RawExpression } from '../common';
import {
  Query,
  QueryWithData,
  Selectable,
  SetQueryReturnsAll,
  SetQueryReturnsOneOrUndefined,
  SetQueryReturnsOne,
  SetQueryReturnsPluck,
  SetQueryReturnsRows,
  SetQueryReturnsValueOrUndefined,
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
import { SortDir, Sql, toSql } from '../sql';
import {
  pushQueryArray,
  pushQueryValue,
  removeFromQuery,
  setQueryValue,
} from '../queryDataUtils';
import {
  Then,
  thenAll,
  thenOne,
  thenOneOrThrow,
  thenPluck,
  thenRows,
  thenValue,
  thenValueOrThrow,
  thenVoid,
} from './then';
import { ColumnShapeOutput, ColumnType, NumberColumn } from '../columnSchema';
import { Aggregate } from './aggregate';
import { addParserForSelectItem, Select } from './select';
import { From } from './from';
import { Join } from './join';
import { With } from './with';
import { Union } from './union';
import { Json } from './json';
import { Insert } from './insert';
import { Update } from './update';
import { Delete } from './delete';
import { Transaction } from './transaction';
import { For } from './for';
import { ColumnInfoMethods } from './columnInfo';
import { Where } from './where';
import { Clear } from './clear';
import { Having } from './having';
import { Window } from './window';

export type WindowArg<T extends Query> = Record<
  string,
  WindowArgDeclaration<T> | RawExpression
>;

export type WindowArgDeclaration<T extends Query = Query> = {
  partitionBy?: Expression<T> | Expression<T>[];
  order?: OrderArg<T>;
};

type WindowResult<T extends Query, W extends WindowArg<T>> = SetQueryWindows<
  T,
  PropertyKeyUnionToArray<keyof W>
>;

export type OrderArg<T extends Query> =
  | {
      [K in Selectable<T>]?:
        | SortDir
        | { dir: SortDir; nulls: 'FIRST' | 'LAST' };
    }
  | RawExpression;

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
    Transaction,
    For,
    ColumnInfoMethods,
    Where,
    Clear,
    Having,
    Window {
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

  take<T extends Query>(this: T): SetQueryReturnsOneOrUndefined<T> {
    return this.then === thenOne
      ? (this as unknown as SetQueryReturnsOneOrUndefined<T>)
      : this.clone()._take();
  }

  _take<T extends Query>(this: T): SetQueryReturnsOneOrUndefined<T> {
    const q = this.toQuery();
    q.then = thenOne;
    setQueryValue(q, 'take', true);
    return q as unknown as SetQueryReturnsOneOrUndefined<T>;
  }

  takeOrThrow<T extends Query>(this: T): SetQueryReturnsOne<T> {
    return this.then === thenOneOrThrow
      ? (this as unknown as SetQueryReturnsOne<T>)
      : this.clone()._takeOrThrow();
  }

  _takeOrThrow<T extends Query>(this: T): SetQueryReturnsOne<T> {
    const q = this.toQuery();
    q.then = thenOneOrThrow;
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

  pluck<T extends Query, S extends keyof T['selectable'] | RawExpression>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    return this.then === thenPluck
      ? (this as unknown as SetQueryReturnsPluck<T, S>)
      : this.clone()._pluck(select);
  }

  _pluck<T extends Query, S extends keyof T['selectable'] | RawExpression>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    const q = this.toQuery();
    q.then = thenPluck;
    removeFromQuery(q, 'take');
    setQueryValue(q, 'select', [select]);
    addParserForSelectItem(q, q.query.as || q.table, 'pluck', select);
    return q as unknown as SetQueryReturnsPluck<T, S>;
  }

  value<T extends Query, V extends ColumnType>(
    this: T,
    columnType?: V,
  ): SetQueryReturnsValueOrUndefined<T, V> {
    return this.then === thenValue
      ? (this as unknown as SetQueryReturnsValueOrUndefined<T, V>)
      : this.clone()._value<T, V>(columnType);
  }

  _value<T extends Query, V extends ColumnType>(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _columnType?: V,
  ): SetQueryReturnsValueOrUndefined<T, V> {
    const q = this.toQuery();
    q.then = thenValue;
    removeFromQuery(q, 'take');
    return q as unknown as SetQueryReturnsValueOrUndefined<T, V>;
  }

  valueOrThrow<T extends Query, V extends ColumnType>(
    this: T,
    columnType?: V,
  ): SetQueryReturnsValue<T, V> {
    return this.then === thenValueOrThrow
      ? (this as unknown as SetQueryReturnsValue<T, V>)
      : this.clone()._valueOrThrow<T, V>(columnType);
  }

  _valueOrThrow<T extends Query, V extends ColumnType>(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _columnType?: V,
  ): SetQueryReturnsValue<T, V> {
    const q = this.toQuery();
    q.then = thenValueOrThrow;
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
    const cloned = Object.create(this);
    if (!this.__model) {
      cloned.__model = this;
    }

    cloned.query = getClonedQueryData<Query>(this.query);

    return cloned as unknown as QueryWithData<T>;
  }

  toSql(this: Query, values?: unknown[]): Sql {
    return toSql(this, values);
  }

  distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return this.clone()._distinct(...columns);
  }

  _distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return pushQueryArray(this, 'distinct', columns as string[]);
  }

  find<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['schema']['primaryTypes']>
  ): SetQueryReturnsOneOrUndefined<T> {
    return this.clone()._find(...args);
  }

  _find<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['schema']['primaryTypes']>
  ): SetQueryReturnsOneOrUndefined<T> {
    const conditions: Partial<ColumnShapeOutput<T['shape']>> = {};
    this.schema.primaryKeys.forEach((key: string, i: number) => {
      conditions[key as keyof ColumnShapeOutput<T['shape']>] = args[i];
    });
    return this._where(conditions)._take();
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
    const sql = this.toSql();

    return query
      ._as(as ?? 't')
      ._from(
        raw(`(${sql.text})`, ...sql.values),
      ) as unknown as SetQueryTableAlias<Q, As>;
  }

  order<T extends Query>(this: T, ...args: OrderArg<T>[]): T {
    return this.clone()._order(...args);
  }

  _order<T extends Query>(this: T, ...args: OrderArg<T>[]): T {
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

  exists<T extends Query>(
    this: T,
  ): SetQueryReturnsValueOrUndefined<T, NumberColumn> {
    return this.clone()._exists();
  }

  _exists<T extends Query>(
    this: T,
  ): SetQueryReturnsValueOrUndefined<T, NumberColumn> {
    const q = setQueryValue(this, 'select', [
      { selectAs: { exists: raw('1') } },
    ]);
    return q._value<T, NumberColumn>();
  }

  truncate<T extends Query>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): SetQueryReturnsVoid<T> {
    return this.clone()._truncate(options);
  }

  _truncate<T extends Query>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): SetQueryReturnsVoid<T> {
    setQueryValue(this, 'type', 'truncate');
    if (options?.restartIdentity) {
      setQueryValue(this, 'restartIdentity', true);
    }
    if (options?.cascade) {
      setQueryValue(this, 'cascade', true);
    }
    return this._exec();
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
  For,
  ColumnInfoMethods,
  Where,
  Clear,
  Having,
  Window,
]);
