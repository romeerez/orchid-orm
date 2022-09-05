import {
  AddQueryJoinedTable,
  ColumnsParsers,
  Query,
  QueryBase,
  Relation,
  Selectable,
  SelectableBase,
  WithDataItem,
} from '../query';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import { RawExpression, StringKey } from '../common';
import { WhereQueryBuilder } from './where';

type WithSelectable<
  T extends QueryBase,
  W extends keyof T['withData'],
> = T['withData'][W] extends WithDataItem
  ?
      | StringKey<keyof T['withData'][W]['shape']>
      | `${T['withData'][W]['table']}.${StringKey<
          keyof T['withData'][W]['shape']
        >}`
  : never;

export type JoinArgs<
  T extends QueryBase,
  Q extends Query = Query,
  W extends keyof T['withData'] = keyof T['withData'],
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

export type JoinCallbackArg<T extends QueryBase> =
  | Query
  | keyof T['withData']
  | keyof T['relations'];

export type JoinCallback<
  T extends QueryBase,
  Arg extends JoinCallbackArg<T>,
> = (
  q: OnQueryBuilder<
    T,
    Arg extends keyof T['withData']
      ? T['withData'][Arg] extends WithDataItem
        ? {
            table: T['withData'][Arg]['table'];
            tableAlias: undefined;
            shape: T['withData'][Arg]['shape'];
            selectable: {
              [K in keyof T['withData'][Arg]['shape'] as `${T['withData'][Arg]['table']}.${StringKey<K>}`]: {
                as: StringKey<K>;
                column: T['withData'][Arg]['shape'][K];
              };
            };
          }
        : never
      : Arg extends keyof T['relations']
      ? T['relations'][Arg]['model']
      : Arg extends Query
      ? Arg
      : never
  >,
) => OnQueryBuilder;

type JoinCallbackResult<
  T extends Query,
  Arg extends JoinCallbackArg<T>,
> = AddQueryJoinedTable<
  T,
  Arg extends Query
    ? Arg
    : Arg extends keyof T['relations']
    ? T['relations'][Arg]['model']
    : Arg extends keyof T['withData']
    ? T['withData'][Arg] extends WithDataItem
      ? {
          table: T['withData'][Arg]['table'];
          tableAlias: undefined;
          result: T['withData'][Arg]['shape'];
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

const _join = <
  T extends Query,
  Arg extends JoinCallbackArg<T>,
  Args extends JoinArgs<T>,
>(
  q: T,
  type: string,
  args: Args | [arg: Arg, cb: JoinCallback<T, Arg>],
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

    const relation = (q.relations as Record<string, Relation>)[joinKey];
    if (relation) {
      parsers = relation.model.query?.parsers || relation.model.columnsParsers;
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

    const resultQuery = fn(
      new OnQueryBuilder(q, modelOrWith as QueryBase | string),
    );

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
  ): JoinResult<T, Args>;
  join<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  join(this: Query, ...args: any) {
    return join(this, 'JOIN', args);
  }
  _join<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  _join<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _join(this: Query, ...args: any) {
    return _join(this, 'JOIN', args);
  }

  innerJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  innerJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  innerJoin(this: Query, ...args: any) {
    return join(this, 'INNER JOIN', args);
  }
  _innerJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  _innerJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _innerJoin(this: Query, ...args: any) {
    return _join(this, 'INNER JOIN', args);
  }

  leftJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  leftJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leftJoin(this: Query, ...args: any) {
    return join(this, 'LEFT JOIN', args);
  }
  _leftJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  _leftJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _leftJoin(this: Query, ...args: any) {
    return _join(this, 'LEFT JOIN', args);
  }

  leftOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  leftOuterJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leftOuterJoin(this: Query, ...args: any) {
    return join(this, 'LEFT OUTER JOIN', args);
  }
  _leftOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  _leftOuterJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _leftOuterJoin(this: Query, ...args: any) {
    return _join(this, 'LEFT OUTER JOIN', args);
  }

  rightJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  rightJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rightJoin(this: Query, ...args: any) {
    return join(this, 'RIGHT JOIN', args);
  }
  _rightJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  _rightJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _rightJoin(this: Query, ...args: any) {
    return _join(this, 'RIGHT JOIN', args);
  }

  rightOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  rightOuterJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rightOuterJoin(this: Query, ...args: any) {
    return join(this, 'RIGHT OUTER JOIN', args);
  }
  _rightOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  _rightOuterJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _rightOuterJoin(this: Query, ...args: any) {
    return _join(this, 'RIGHT OUTER JOIN', args);
  }

  fullOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  fullOuterJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullOuterJoin(this: Query, ...args: any) {
    return join(this, 'FULL OUTER JOIN', args);
  }
  _fullOuterJoin<T extends Query, Args extends JoinArgs<T>>(
    this: T,
    ...args: Args
  ): JoinResult<T, Args>;
  _fullOuterJoin<T extends Query, Arg extends JoinCallbackArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _fullOuterJoin(this: Query, ...args: any) {
    return _join(this, 'FULL OUTER JOIN', args);
  }
}

type PickQueryForSelect<T extends QueryBase = QueryBase> = Pick<
  T,
  'table' | 'tableAlias' | 'selectable'
>;

type OnArgs<Q extends { selectable: SelectableBase }> =
  | [leftColumn: keyof Q['selectable'], rightColumn: keyof Q['selectable']]
  | [
      leftColumn: keyof Q['selectable'],
      op: string,
      rightColumn: keyof Q['selectable'],
    ];

const makeOnItem = (
  joinTo: QueryBase | string,
  joinFrom: QueryBase | string,
  args: OnArgs<QueryBase>,
) => {
  return {
    item: {
      type: 'on',
      joinTo,
      joinFrom,
      on: args,
    },
  };
};

export const pushQueryOn = <T extends QueryBase>(
  q: T,
  joinFrom: QueryBase | string,
  joinTo: QueryBase | string,
  ...args: OnArgs<QueryBase>
): T => {
  return pushQueryValue(q, 'and', makeOnItem(joinFrom, joinTo, args));
};

export const pushQueryOrOn: typeof pushQueryOn = (
  q,
  joinFrom,
  joinTo,
  ...args
) => {
  return pushQueryValue(q, 'or', [makeOnItem(joinFrom, joinTo, args)]);
};

export const addQueryOn: typeof pushQueryOrOn = (
  q,
  joinFrom,
  joinTo,
  ...args
) => {
  return pushQueryOn(q.clone() as typeof q, joinFrom, joinTo, ...args);
};

export const addQueryOrOn: typeof pushQueryOrOn = (
  q,
  joinFrom,
  joinTo,
  ...args
) => {
  return pushQueryOrOn(q.clone() as typeof q, joinFrom, joinTo, ...args);
};

export class OnQueryBuilder<
    S extends QueryBase = QueryBase,
    J extends PickQueryForSelect = PickQueryForSelect,
  >
  extends WhereQueryBuilder<S>
  implements QueryBase
{
  selectable!: S['selectable'] & J['selectable'];

  constructor(
    q: Pick<QueryBase, 'query' | 'table'>,
    public joinTo: QueryBase | string,
  ) {
    super(q.table, q.query?.as);
  }

  on<T extends this>(this: T, ...args: OnArgs<T>): T {
    return this.clone()._on(...args);
  }

  _on<T extends this>(this: T, ...args: OnArgs<T>): T {
    return pushQueryOn(this, this.joinTo, this, ...args);
  }

  orOn<T extends this>(this: T, ...args: OnArgs<T>): T {
    return this.clone()._orOn(...args);
  }

  _orOn<T extends this>(this: T, ...args: OnArgs<T>): T {
    return pushQueryOrOn(this, this.joinTo, this, ...args);
  }
}
