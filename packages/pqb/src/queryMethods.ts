import {
  AliasOrTable,
  EMPTY_OBJECT,
  Expression,
  isRaw,
  raw,
  RawExpression,
  StringKey,
} from './common';
import {
  AddQueryJoinedTable,
  AddQueryWith,
  ColumnsParsers,
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
  WithDataItem,
} from './query';
import { applyMixins, GetTypesOrRaw, PropertyKeyUnionToArray } from './utils';
import {
  toSql,
  HavingArg,
  OrderBy,
  QueryData,
  UnionArg,
  WhereItem,
  WindowArg,
  WithOptions,
} from './sql';
import {
  pushQueryArray,
  pushQueryValue,
  removeFromQuery,
  setQueryObjectValue,
  setQueryValue,
} from './queryDataUtils';
import {
  Then,
  thenAll,
  thenOne,
  thenRows,
  thenValue,
  thenVoid,
} from './thenMethods';
import { Db } from './db';
import {
  ColumnShapeOutput,
  ColumnsShape,
  ColumnType,
  ColumnTypes,
  NumberColumn,
  StringColumn,
} from './columnSchema';
import { SelectMethods } from './selectMethods';

type FromArgs<T extends Query> = [
  first: Query | RawExpression | Exclude<keyof T['withData'], symbol | number>,
  second?: string | { as?: string; only?: boolean },
];

type FromResult<
  T extends Query,
  Args extends FromArgs<T>,
> = Args[1] extends string
  ? SetQueryTableAlias<T, Args[1]>
  : Args[1] extends { as: string }
  ? SetQueryTableAlias<T, Args[1]['as']>
  : Args[0] extends string
  ? SetQueryTableAlias<T, Args[0]>
  : Args[0] extends Query
  ? SetQueryTableAlias<T, AliasOrTable<Args[0]>>
  : T;

type WithArgsOptions = Omit<WithOptions, 'columns'> & {
  columns?: boolean | string[];
};

type WithArgs =
  | [string, ColumnsShape, RawExpression]
  | [string, WithArgsOptions, ColumnsShape, RawExpression]
  | [string, Query | ((qb: Db) => Query)]
  | [string, WithArgsOptions, Query | ((qb: Db) => Query)];

type WithShape<Args extends WithArgs> = Args[1] extends Query
  ? Args[1]['result']
  : Args[1] extends (qb: Db) => Query
  ? ReturnType<Args[1]>['result']
  : Args[2] extends Query
  ? Args[2]['result']
  : Args[2] extends (qb: Db) => Query
  ? ReturnType<Args[2]>['result']
  : Args[1] extends ColumnsShape
  ? Args[1]
  : Args[2] extends ColumnsShape
  ? Args[2]
  : Args[2] extends (t: ColumnTypes) => ColumnsShape
  ? ReturnType<Args[2]>
  : never;

type WithResult<
  T extends Query,
  Args extends WithArgs,
  Shape extends ColumnsShape,
> = AddQueryWith<
  T,
  {
    table: Args[0];
    shape: Shape;
    type: ColumnShapeOutput<Shape>;
  }
>;

type WindowResult<T extends Query, W extends WindowArg<T>> = SetQueryWindows<
  T,
  PropertyKeyUnionToArray<keyof W>
>;

type PickQueryForSelect<T extends Query = Query> = Pick<
  T,
  'table' | 'tableAlias' | 'selectable'
>;

export type JoinQuery<
  T extends Query = Query,
  J extends PickQueryForSelect = PickQueryForSelect,
> = {
  query?: QueryData;
  table: T['table'];
  tableAlias: T['tableAlias'];
  selectable: T['selectable'] & J['selectable'];
} & JoinQueryMethods<T, J>;

type JoinQueryMethods<T extends Query, J extends PickQueryForSelect> = {
  toQuery<Q extends JoinQuery<T, J>>(this: Q): Q & { query: QueryData };
  clone<Q extends JoinQuery<T, J>>(this: Q): Q & { query: QueryData };
  on: On<T, J>;
  _on: On<T, J>;
  onOr: On<T, J>;
  _onOr: On<T, J>;
};

type On<
  T extends Query = Query,
  J extends PickQueryForSelect = PickQueryForSelect,
> = <Q extends JoinQuery<T, J>>(
  this: Q,
  leftColumn: keyof Q['selectable'],
  op: string,
  rightColumn: keyof Q['selectable'],
) => Q;

const on: On = function (leftColumn, op, rightColumn) {
  return this.clone()._on(leftColumn, op, rightColumn);
};

const _on: On = function (leftColumn, op, rightColumn) {
  return pushQueryValue(this, 'and', [leftColumn, op, rightColumn]);
};

const onOr: On = function (leftColumn, op, rightColumn) {
  return this.clone()._on(leftColumn, op, rightColumn);
};

const _onOr: On = function (leftColumn, op, rightColumn) {
  return pushQueryValue(this, 'or', [[leftColumn, op, rightColumn]]);
};

const joinQueryMethods: JoinQueryMethods<Query, PickQueryForSelect> = {
  toQuery<Q extends JoinQuery>(this: Q) {
    return (this.query ? this : this.clone()) as Q & { query: QueryData };
  },
  clone() {
    return { ...this, query: getClonedQueryData(this.query) };
  },
  on,
  _on,
  onOr,
  _onOr,
};

type JoinArgs<
  T extends Query,
  Q extends Query = Query,
  W extends keyof T['withData'] = keyof T['withData'],
  QW extends Query | keyof T['withData'] = Query | keyof T['withData'],
> =
  | [relation: keyof T['relations']]
  | [
      query: Q,
      leftColumn: Selectable<Q>,
      op: string,
      rightColumn: Selectable<T>,
    ]
  | [
      withAlias: W,
      leftColumn: T['withData'][W] extends WithDataItem
        ?
            | StringKey<keyof T['withData'][W]['shape']>
            | `${T['withData'][W]['table']}.${StringKey<
                keyof T['withData'][W]['shape']
              >}`
        : never,
      op: string,
      rightColumn: Selectable<T>,
    ]
  | [query: Q, raw: RawExpression]
  | [withAlias: W, raw: RawExpression]
  | [
      query: QW,
      on: (
        q: JoinQuery<
          T,
          QW extends keyof T['withData']
            ? T['withData'][QW] extends WithDataItem
              ? {
                  table: T['withData'][QW]['table'];
                  tableAlias: undefined;
                  shape: T['withData'][QW]['shape'];
                  selectable: {
                    [K in keyof T['withData'][QW]['shape'] as `${T['withData'][QW]['table']}.${StringKey<K>}`]: {
                      as: StringKey<K>;
                      column: T['withData'][QW]['shape'][K];
                    };
                  };
                }
              : never
            : QW extends Query
            ? QW
            : never
        >,
      ) => JoinQuery,
    ];

type JoinResult<
  T extends Query,
  Args extends JoinArgs<T>,
  A extends Query | keyof T['relations'] = Args[0],
> = AddQueryJoinedTable<
  T,
  A extends Query
    ? A
    : A extends keyof T['relations']
    ? T['relations'][A] extends { query: Query }
      ? T['relations'][A]['query']
      : never
    : A extends keyof T['withData']
    ? T['withData'][A] extends WithDataItem
      ? {
          table: T['withData'][A]['table'];
          tableAlias: undefined;
          result: T['withData'][A]['shape'];
        }
      : never
    : never
>;

const getClonedQueryData = <T extends Query>(
  query?: QueryData<T>,
): QueryData<T> => {
  const cloned = {} as QueryData<T>;

  if (query) {
    for (const key in query) {
      const value = query[key as keyof QueryData];
      if (Array.isArray(value)) {
        (cloned as Record<string, unknown>)[key] = [...value];
      } else {
        (cloned as Record<string, unknown>)[key] = value;
      }
    }
  }

  return cloned;
};

export interface QueryMethods extends SelectMethods {
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

  from<T extends Query, Args extends FromArgs<T>>(
    this: T,
    ...args: Args
  ): FromResult<T, Args> {
    return this.clone()._from(...args) as FromResult<T, Args>;
  }

  _from<T extends Query, Args extends FromArgs<T>>(
    this: T,
    ...args: Args
  ): FromResult<T, Args> {
    let as: string | undefined;
    if (typeof args[1] === 'string') {
      as = args[1];
    } else if (typeof args[1] === 'object' && args[1].as) {
      as = args[1].as;
    } else if (typeof args[0] === 'string') {
      as = args[0];
    } else if (!isRaw(args[0] as RawExpression)) {
      as = (args[0] as Query).query?.as || (args[0] as Query).table;
    }

    if (typeof args[1] === 'object' && 'only' in args[1]) {
      setQueryValue(this, 'fromOnly', args[1].only);
    }

    return setQueryValue(
      as ? this._as(as) : this,
      'from',
      args[0],
    ) as unknown as FromResult<T, Args>;
  }

  with<
    T extends Query,
    Args extends WithArgs,
    Shape extends ColumnsShape = WithShape<Args>,
  >(this: T, ...args: Args): WithResult<T, Args, Shape> {
    return this.clone()._with<T, Args, Shape>(...args);
  }

  _with<
    T extends Query,
    Args extends WithArgs,
    Shape extends ColumnsShape = WithShape<Args>,
  >(this: T, ...args: Args): WithResult<T, Args, Shape> {
    let options =
      (args.length === 3 && !isRaw(args[2])) || args.length === 4
        ? (args[1] as WithArgsOptions | WithOptions)
        : undefined;

    const last = args[args.length - 1] as
      | Query
      | ((qb: Db) => Query)
      | RawExpression;

    const query = typeof last === 'function' ? last(this.queryBuilder) : last;

    const shape =
      args.length === 4 ? (args[2] as ColumnsShape) : (query as Query).shape;

    if (options?.columns === true) {
      options = {
        ...options,
        columns: Object.keys(shape),
      };
    }

    pushQueryValue(this, 'with', [args[0], options || EMPTY_OBJECT, query]);

    return setQueryObjectValue(
      this,
      'withShapes',
      args[0],
      shape,
    ) as unknown as WithResult<T, Args, Shape>;
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

  json<T extends Query>(this: T): SetQueryReturnsValue<T, StringColumn> {
    return this.clone()._json();
  }

  _json<T extends Query>(this: T): SetQueryReturnsValue<T, StringColumn> {
    const q = this._wrap(
      this.selectAs({
        json: raw(
          this.query?.take
            ? `COALESCE(row_to_json("t".*), '{}')`
            : `COALESCE(json_agg(row_to_json("t".*)), '[]')`,
        ),
      }),
    ) as unknown as T;

    return q._value<T, StringColumn>();
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

  exists<T extends Query>(this: T): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._exists();
  }

  _exists<T extends Query>(this: T): SetQueryReturnsValue<T, NumberColumn> {
    const q = setQueryValue(this, 'select', [
      { selectAs: { exists: raw('1') } },
    ]);
    return q._value<T, NumberColumn>();
  }

  join<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return (this.clone() as T)._join(...args) as unknown as JoinResult<T, Args>;
  }

  _join<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    const first = args[0];
    let joinKey: string | undefined;
    let parsers: ColumnsParsers | undefined;

    if (typeof first === 'object') {
      const as = first.tableAlias || first.table;
      if (as) {
        joinKey = as;
        parsers = first.query?.parsers || first.columnsParsers;
      }
    } else {
      joinKey = first as string;

      const relation = (this.relations as Record<string, { query: Query }>)[
        joinKey
      ];
      if (relation) {
        parsers =
          relation.query.query?.parsers || relation.query.columnsParsers;
      } else {
        const shape = this.query?.withShapes?.[first as string];
        if (shape) {
          parsers = {};
          for (const key in shape) {
            const parser = shape[key].parseFn;
            if (parser) {
              parsers[key] = parser;
            }
          }
        }
      }
    }

    if (joinKey && parsers) {
      setQueryObjectValue(this, 'joinedParsers', joinKey, parsers);
    }

    if (typeof args[1] === 'function') {
      const [modelOrWith, fn] = args;

      const resultQuery = fn({
        table: this.table,
        tableAlias: this.query?.as,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        selectable: undefined as any,
        ...joinQueryMethods,
      });

      return pushQueryValue(this, 'join', [
        modelOrWith,
        resultQuery,
      ]) as unknown as JoinResult<T, Args>;
    } else {
      return pushQueryValue(this, 'join', args) as unknown as JoinResult<
        T,
        Args
      >;
    }
  }
}

QueryMethods.prototype.then = thenAll;

applyMixins(QueryMethods, [SelectMethods]);
