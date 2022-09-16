import { Expression, raw, RawExpression } from '../common';
import {
  Query,
  Selectable,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsPluck,
  SetQueryReturnsRows,
  SetQueryReturnsValueOrUndefined,
  SetQueryReturnsValue,
  SetQueryReturnsVoid,
  SetQueryTableAlias,
  SetQueryWindows,
  QueryBase,
  SetQueryReturnsOneOrUndefined,
} from '../query';
import {
  applyMixins,
  getClonedQueryData,
  GetTypesOrRaw,
  PropertyKeyUnionToArray,
} from '../utils';
import {
  SelectItem,
  SelectQueryData,
  SortDir,
  Sql,
  toSql,
  TruncateQueryData,
} from '../sql';
import {
  pushQueryArray,
  pushQueryValue,
  removeFromQuery,
} from '../queryDataUtils';
import { Then } from './then';
import { ColumnType, NumberColumn } from '../columnSchema';
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
import { addWhere, Where, WhereArg, WhereResult } from './where';
import { Clear } from './clear';
import { Having } from './having';
import { Window } from './window';
import { QueryLog } from './log';
import { QueryCallbacks } from './callbacks';

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
  | keyof T['selectable']
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
    Window,
    Then,
    QueryLog,
    QueryCallbacks {}

export class QueryMethods {
  windows!: PropertyKey[];
  __model?: Query;

  all<T extends Query>(this: T): SetQueryReturnsAll<T> {
    return this.returnType === 'all'
      ? (this as unknown as SetQueryReturnsAll<T>)
      : this.clone()._all();
  }

  _all<T extends Query>(this: T): SetQueryReturnsAll<T> {
    this.returnType = 'all';
    removeFromQuery(this, 'take');
    return this as unknown as SetQueryReturnsAll<T>;
  }

  take<T extends Query>(this: T): SetQueryReturnsOne<T> {
    return this.returnType === 'oneOrThrow'
      ? (this as unknown as SetQueryReturnsOne<T>)
      : this.clone()._take();
  }

  _take<T extends Query>(this: T): SetQueryReturnsOne<T> {
    this.returnType = 'oneOrThrow';
    this.query.take = true;
    return this as unknown as SetQueryReturnsOne<T>;
  }

  takeOptional<T extends Query>(this: T): SetQueryReturnsOneOrUndefined<T> {
    return this.returnType === 'one'
      ? (this as unknown as SetQueryReturnsOneOrUndefined<T>)
      : this.clone()._takeOptional();
  }

  _takeOptional<T extends Query>(this: T): SetQueryReturnsOneOrUndefined<T> {
    this.returnType = 'one';
    this.query.take = true;
    return this as unknown as SetQueryReturnsOneOrUndefined<T>;
  }

  rows<T extends Query>(this: T): SetQueryReturnsRows<T> {
    return this.returnType === 'rows'
      ? (this as unknown as SetQueryReturnsRows<T>)
      : this.clone()._rows();
  }

  _rows<T extends Query>(this: T): SetQueryReturnsRows<T> {
    this.returnType = 'rows';
    removeFromQuery(this, 'take');
    return this as unknown as SetQueryReturnsRows<T>;
  }

  pluck<T extends Query, S extends Expression<T>>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    return this.returnType === 'pluck'
      ? (this as unknown as SetQueryReturnsPluck<T, S>)
      : this.clone()._pluck(select);
  }

  _pluck<T extends Query, S extends Expression<T>>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    this.returnType = 'pluck';
    removeFromQuery(this, 'take');
    (this.query as SelectQueryData).select = [select as SelectItem];
    addParserForSelectItem(this, this.query.as || this.table, 'pluck', select);
    return this as unknown as SetQueryReturnsPluck<T, S>;
  }

  value<T extends Query, V extends ColumnType>(
    this: T,
    columnType?: V,
  ): SetQueryReturnsValue<T, V> {
    return this.returnType === 'valueOrThrow'
      ? (this as unknown as SetQueryReturnsValue<T, V>)
      : this.clone()._value<T, V>(columnType);
  }

  _value<T extends Query, V extends ColumnType>(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _columnType?: V,
  ): SetQueryReturnsValue<T, V> {
    this.returnType = 'valueOrThrow';
    removeFromQuery(this, 'take');
    return this as unknown as SetQueryReturnsValue<T, V>;
  }

  valueOptional<T extends Query, V extends ColumnType>(
    this: T,
    columnType?: V,
  ): SetQueryReturnsValueOrUndefined<T, V> {
    return this.returnType === 'value'
      ? (this as unknown as SetQueryReturnsValueOrUndefined<T, V>)
      : this.clone()._valueOptional<T, V>(columnType);
  }

  _valueOptional<T extends Query, V extends ColumnType>(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _columnType?: V,
  ): SetQueryReturnsValueOrUndefined<T, V> {
    this.returnType = 'value';
    removeFromQuery(this, 'take');
    return this as unknown as SetQueryReturnsValueOrUndefined<T, V>;
  }

  exec<T extends Query>(this: T): SetQueryReturnsVoid<T> {
    return this.returnType === 'void'
      ? (this as unknown as SetQueryReturnsVoid<T>)
      : this.clone()._exec();
  }

  _exec<T extends Query>(this: T): SetQueryReturnsVoid<T> {
    this.returnType = 'void';
    removeFromQuery(this, 'take');
    return this as unknown as SetQueryReturnsVoid<T>;
  }

  clone<T extends QueryBase>(this: T): T {
    const cloned = Object.create(this);
    if (!this.__model) {
      cloned.__model = this;
    }

    cloned.query = getClonedQueryData(this.query);

    return cloned;
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
  ): SetQueryReturnsOne<WhereResult<T>> {
    return this.clone()._find(...args);
  }

  _find<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['schema']['primaryTypes']>
  ): SetQueryReturnsOne<WhereResult<T>> {
    const conditions: Partial<T['type']> = {};
    this.schema.primaryKeys.forEach((key: string, i: number) => {
      conditions[key as keyof T['type']] = args[i];
    });
    return this._where(conditions as WhereArg<T>)._take();
  }

  findOptional<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['schema']['primaryTypes']>
  ): SetQueryReturnsOneOrUndefined<WhereResult<T>> {
    return this.clone()._findOptional(...args);
  }

  _findOptional<T extends Query>(
    this: T,
    ...args: GetTypesOrRaw<T['schema']['primaryTypes']>
  ): SetQueryReturnsOneOrUndefined<WhereResult<T>> {
    return this._find(
      ...args,
    ).takeOptional() as unknown as SetQueryReturnsOneOrUndefined<
      WhereResult<T>
    >;
  }

  findBy<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOne<WhereResult<T>> {
    return this.clone()._findBy(...args);
  }

  _findBy<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOne<WhereResult<T>> {
    return addWhere(this, args).take();
  }

  findByOptional<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOneOrUndefined<WhereResult<T>> {
    return this.clone()._findByOptional(...args);
  }

  _findByOptional<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOneOrUndefined<WhereResult<T>> {
    return addWhere(this, args).takeOptional();
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
    this.query.as = tableAlias;
    return this as unknown as SetQueryTableAlias<T, TableAlias>;
  }

  withSchema<T extends Query>(this: T, schema: string): T {
    return this.clone()._withSchema(schema);
  }

  _withSchema<T extends Query>(this: T, schema: string): T {
    this.query.schema = schema;
    return this;
  }

  group<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return this.clone()._group(...columns);
  }

  _group<T extends Query>(this: T, ...columns: Expression<T>[]): T {
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
    (this.query as SelectQueryData).limit = arg;
    return this;
  }

  offset<T extends Query>(this: T, arg: number): T {
    return this.clone()._offset(arg);
  }

  _offset<T extends Query>(this: T, arg: number): T {
    (this.query as SelectQueryData).offset = arg;
    return this;
  }

  exists<T extends Query>(
    this: T,
  ): SetQueryReturnsValueOrUndefined<T, NumberColumn> {
    return this.clone()._exists();
  }

  _exists<T extends Query>(
    this: T,
  ): SetQueryReturnsValueOrUndefined<T, NumberColumn> {
    (this.query as SelectQueryData).select = [
      { selectAs: { exists: raw('1') } },
    ];
    return this._valueOptional<T, NumberColumn>();
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
    const q = this.query as TruncateQueryData;
    q.type = 'truncate';
    if (options?.restartIdentity) {
      q.restartIdentity = true;
    }
    if (options?.cascade) {
      q.cascade = true;
    }
    return this._exec();
  }
}

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
  Then,
  QueryLog,
  QueryCallbacks,
]);
