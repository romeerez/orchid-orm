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
  WhereBetweenValues,
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

class OnQueryBuilder<
  T extends Query = Query,
  J extends PickQueryForSelect = PickQueryForSelect,
> {
  query?: QueryData;
  selectable!: T['selectable'] & J['selectable'];
  private __model?: this;

  constructor(public table: T['table'], public tableAlias: T['tableAlias']) {}

  toQuery<Q extends this>(this: Q): Q & { query: QueryData } {
    return (this.query ? this : this.clone()) as Q & { query: QueryData };
  }

  clone<Q extends this>(this: Q): Q & { query: QueryData } {
    const cloned = Object.create(this);
    if (!this.__model) {
      cloned.__model = this;
    }

    cloned.query = getClonedQueryData<Query>(this.query);

    return cloned as unknown as Q & { query: QueryData };
  }

  on<Q extends this>(this: Q, ...args: OnArgs<Q>): Q {
    return this.clone()._on(...args);
  }

  _on<Q extends this>(this: Q, ...args: OnArgs<Q>): Q {
    return pushQueryValue(this, 'and', {
      item: {
        type: 'on',
        on: args,
      },
    });
  }

  orOn<Q extends this>(this: Q, ...args: OnArgs<Q>): Q {
    return this.clone()._orOn(...args);
  }

  _orOn<Q extends this>(this: Q, ...args: OnArgs<Q>): Q {
    return pushQueryValue(this, 'or', [
      {
        item: {
          type: 'on',
          on: args,
        },
      },
    ]);
  }

  onIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return this.clone()._onIn(columns, values);
  }

  _onIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return applyIn(this, true, columns, values);
  }

  orOnIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return this.clone()._orOnIn(columns, values);
  }

  _orOnIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return applyIn(this, false, columns, values);
  }

  onNotIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return this.clone()._onNotIn(columns, values);
  }

  _onNotIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return applyIn(this, true, columns, values, true);
  }

  orOnNotIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return this.clone()._orOnNotIn(columns, values);
  }

  _orOnNotIn<Q extends this, Column extends WhereInColumn<Q>>(
    this: Q,
    columns: Column,
    values: WhereInValues<Q, Column>,
  ): Q {
    return applyIn(this, false, columns, values, true);
  }

  onNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return this.clone()._onNull(column);
  }

  _onNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return addWhere(this, [{ [column]: null }]);
  }

  orOnNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return this.clone()._orOnNull(column);
  }

  _orOnNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return addOr(this, [{ [column]: null }]);
  }

  onNotNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return this.clone()._onNotNull(column);
  }

  _onNotNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return addWhereNot(this, [{ [column]: null }]);
  }

  orOnNotNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return this.clone()._orOnNotNull(column);
  }

  _orOnNotNull<Q extends this>(this: Q, column: keyof Q['selectable']): Q {
    return addOrNot(this, [{ [column]: null }]);
  }

  onExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return this.clone()._onExists(query);
  }

  _onExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return addWhere(this, [{ type: 'exists', query }]);
  }

  orOnExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return this.clone()._orOnExists(query);
  }

  _orOnExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return addOr(this, [{ type: 'exists', query }]);
  }

  onNotExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return this.clone()._onNotExists(query);
  }

  _onNotExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return addWhereNot(this, [{ type: 'exists', query }]);
  }

  orOnNotExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return this.clone()._orOnNotExists(query);
  }

  _orOnNotExists<Q extends this>(this: Q, query: Query | RawExpression): Q {
    return addOrNot(this, [{ type: 'exists', query }]);
  }

  onBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return this.clone()._onBetween(column, values);
  }

  _onBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return addWhere(this, [{ [column]: { between: values } }]);
  }

  orOnBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return this.clone()._orOnBetween(column, values);
  }

  _orOnBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return addOr(this, [{ [column]: { between: values } }]);
  }

  onNotBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return this.clone()._onNotBetween(column, values);
  }

  _onNotBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return addWhereNot(this, [{ [column]: { between: values } }]);
  }

  orOnNotBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return this.clone()._orOnNotBetween(column, values);
  }

  _orOnNotBetween<Q extends this, C extends keyof Q['selectable']>(
    this: Q,
    column: C,
    values: WhereBetweenValues<Q, C>,
  ): Q {
    return addOrNot(this, [{ [column]: { between: values } }]);
  }

  onJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return this.clone()._onJsonPathEquals(...args);
  }

  _onJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return addWhere(this, [{ type: 'onJsonPathEquals', data: args }]);
  }

  orOnJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return this.clone()._orOnJsonPathEquals(...args);
  }

  _orOnJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return addOr(this, [{ type: 'onJsonPathEquals', data: args }]);
  }

  onNotJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return this.clone()._onNotJsonPathEquals(...args);
  }

  _onNotJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return addWhereNot(this, [{ type: 'onJsonPathEquals', data: args }]);
  }

  orOnNotJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return this.clone()._orOnNotJsonPathEquals(...args);
  }

  _orOnNotJsonPathEquals<
    Q extends this,
    LeftColumn extends keyof Q['selectable'],
    RightColumn extends keyof Q['selectable'],
  >(
    this: Q,
    ...args: [
      leftColumn: LeftColumn,
      leftPath: string,
      rightColumn: RightColumn,
      rightPath: string,
    ]
  ): Q {
    return addOrNot(this, [{ type: 'onJsonPathEquals', data: args }]);
  }
}
