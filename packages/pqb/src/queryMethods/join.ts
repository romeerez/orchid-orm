import {
  AddQueryJoinedTable,
  ColumnsParsers,
  Query,
  Selectable,
  WithDataItem,
} from '../query';
import { QueryData } from '../sql';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import { RawExpression, StringKey } from '../common';
import { getClonedQueryData } from '../utils';
import {
  addOr,
  addOrNot,
  addWhere,
  addWhereNot,
  applyIn,
  WhereArg,
  WhereInArg,
  WhereInColumn,
  WhereInValues,
} from './where';

type WithSelectable<
  T extends Query,
  W extends keyof T['withData'],
> = T['withData'][W] extends WithDataItem
  ?
      | StringKey<keyof T['withData'][W]['shape']>
      | `${T['withData'][W]['table']}.${StringKey<
          keyof T['withData'][W]['shape']
        >}`
  : never;

type JoinArgs<
  T extends Query,
  Q extends Query = Query,
  W extends keyof T['withData'] = keyof T['withData'],
  QW extends Query | keyof T['withData'] = Query | keyof T['withData'],
> =
  | [relation: keyof T['relations']]
  | [
      query: Q,
      conditions:
        | Record<Selectable<Q>, Selectable<T> | RawExpression>
        | RawExpression,
    ]
  | [
      withAlias: W,
      conditions:
        | Record<WithSelectable<T, W>, Selectable<T> | RawExpression>
        | RawExpression,
    ]
  | [
      query: Q,
      leftColumn: Selectable<Q> | RawExpression,
      rightColumn: Selectable<T> | RawExpression,
    ]
  | [
      withAlias: W,
      leftColumn: WithSelectable<T, W> | RawExpression,
      rightColumn: Selectable<T> | RawExpression,
    ]
  | [
      query: Q,
      leftColumn: Selectable<Q> | RawExpression,
      op: string,
      rightColumn: Selectable<T> | RawExpression,
    ]
  | [
      withAlias: W,
      leftColumn: WithSelectable<T, W> | RawExpression,
      op: string,
      rightColumn: Selectable<T> | RawExpression,
    ]
  | [
      query: QW,
      on: (
        q: OnQueryBuilder<
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
      ) => OnQueryBuilder,
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

const join = <T extends Query, Args extends JoinArgs<T>>(
  q: T,
  type: string,
  args: Args,
): JoinResult<T, Args> => {
  return _join(q.clone() as T, type, args) as unknown as JoinResult<T, Args>;
};

const _join = <T extends Query, Args extends JoinArgs<T>>(
  q: T,
  type: string,
  args: Args,
): JoinResult<T, Args> => {
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

    const relation = (q.relations as Record<string, { query: Query }>)[joinKey];
    if (relation) {
      parsers = relation.query.query?.parsers || relation.query.columnsParsers;
    } else {
      const shape = q.query?.withShapes?.[first as string];
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
    setQueryObjectValue(q, 'joinedParsers', joinKey, parsers);
  }

  if (typeof args[1] === 'function') {
    const [modelOrWith, fn] = args;

    const resultQuery = fn(new OnQueryBuilder(q.table, q.query?.as));

    return pushQueryValue(q, 'join', {
      type,
      args: [modelOrWith, { type: 'query', query: resultQuery }],
    }) as unknown as JoinResult<T, Args>;
  } else {
    const items =
      args.length === 2
        ? [args[0], { type: 'objectOrRaw', data: args[1] }]
        : args;

    return pushQueryValue(q, 'join', {
      type,
      args: items,
    }) as unknown as JoinResult<T, Args>;
  }
};

export class Join {
  join<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return join(this, 'JOIN', args);
  }

  _join<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return _join(this, 'JOIN', args);
  }

  innerJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return join(this, 'INNER JOIN', args);
  }

  _innerJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return _join(this, 'INNER JOIN', args);
  }

  leftJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return join(this, 'LEFT JOIN', args);
  }

  _leftJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return _join(this, 'LEFT JOIN', args);
  }

  leftOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return join(this, 'LEFT OUTER JOIN', args);
  }

  _leftOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return _join(this, 'LEFT OUTER JOIN', args);
  }

  rightJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return join(this, 'RIGHT JOIN', args);
  }

  _rightJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return _join(this, 'RIGHT JOIN', args);
  }

  rightOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return join(this, 'RIGHT OUTER JOIN', args);
  }

  _rightOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return _join(this, 'RIGHT OUTER JOIN', args);
  }

  fullOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return join(this, 'FULL OUTER JOIN', args);
  }

  _fullOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args> {
    return _join(this, 'FULL OUTER JOIN', args);
  }
}

type PickQueryForSelect<T extends Query = Query> = Pick<
  T,
  'table' | 'tableAlias' | 'selectable'
>;

type OnArgs<Q extends OnQueryBuilder> =
  | [leftColumn: keyof Q['selectable'], rightColumn: keyof Q['selectable']]
  | [
      leftColumn: keyof Q['selectable'],
      op: string,
      rightColumn: keyof Q['selectable'],
    ];

export class OnQueryBuilder<
  S extends Query = Query,
  J extends PickQueryForSelect = PickQueryForSelect,
> {
  query?: QueryData;
  selectable!: S['selectable'] & J['selectable'];
  private __model?: this;

  constructor(public table: S['table'], public tableAlias: S['tableAlias']) {}

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

  on<T extends this>(this: T, ...args: OnArgs<T>): T {
    return this.clone()._on(...args);
  }

  _on<T extends this>(this: T, ...args: OnArgs<T>): T {
    return pushQueryValue(this, 'and', {
      item: {
        type: 'on',
        on: args,
      },
    });
  }

  orOn<T extends this>(this: T, ...args: OnArgs<T>): T {
    return this.clone()._orOn(...args);
  }

  _orOn<T extends this>(this: T, ...args: OnArgs<T>): T {
    return pushQueryValue(this, 'or', [
      {
        item: {
          type: 'on',
          on: args,
        },
      },
    ]);
  }

  where<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._where(...args);
  }

  _where<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return addWhere(this, args);
  }

  whereNot<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._whereNot(...args);
  }

  _whereNot<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return addWhereNot(this, args);
  }

  and<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this.where(...args);
  }

  _and<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this._where(...args);
  }

  andNot<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this.whereNot(...args);
  }

  _andNot<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this._whereNot(...args);
  }

  or<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._or(...args);
  }

  _or<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return addOr(this, args);
  }

  orNot<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return this.clone()._orNot(...args);
  }

  _orNot<T extends this>(this: T, ...args: WhereArg<T>[]): T {
    return addOrNot(this, args);
  }

  whereIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  whereIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  whereIn<T extends this>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereIn(arg as any, values as any);
  }

  _whereIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _whereIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  _whereIn<T extends this>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, true, arg, values);
  }

  orWhereIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  orWhereIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  orWhereIn<T extends this>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereIn(arg as any, values as any);
  }

  _orWhereIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _orWhereIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  _orWhereIn<T extends this>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, false, arg, values);
  }

  whereNotIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  whereNotIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  whereNotIn<T extends this>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._whereNotIn(arg as any, values as any);
  }

  _whereNotIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _whereNotIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  _whereNotIn<T extends this>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, true, arg, values, true);
  }

  orWhereNotIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  orWhereNotIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  orWhereNotIn<T extends this>(
    this: T,
    arg: unknown | unknown[],
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._orWhereNotIn(arg as any, values as any);
  }

  _orWhereNotIn<T extends this, Column extends WhereInColumn<T>>(
    this: T,
    column: Column,
    values: WhereInValues<T, Column>,
  ): T;
  _orWhereNotIn<T extends this>(this: T, arg: WhereInArg<T>): T;
  _orWhereNotIn<T extends this>(
    this: T,
    arg: unknown,
    values?: unknown[] | unknown[][] | Query | RawExpression,
  ): T {
    return applyIn(this, false, arg, values, true);
  }

  whereExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this.clone()._whereExists(query);
  }
  _whereExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this._where({ type: 'exists', query });
  }

  orWhereExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this.clone()._orWhereExists(query);
  }
  _orWhereExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this._or({ type: 'exists', query });
  }

  whereNotExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this.clone()._whereNotExists(query);
  }
  _whereNotExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this._whereNot({ type: 'exists', query });
  }

  orWhereNotExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this.clone()._orWhereNotExists(query);
  }
  _orWhereNotExists<T extends this>(this: T, query: Query | RawExpression): T {
    return this._orNot({ type: 'exists', query });
  }
}
