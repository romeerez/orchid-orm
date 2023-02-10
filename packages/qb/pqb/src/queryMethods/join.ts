import {
  AddQueryJoinedTable,
  ColumnsParsers,
  Query,
  QueryBase,
  Selectable,
  SelectableBase,
  WithDataBase,
  WithDataItem,
} from '../query';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import { RawExpression } from '../raw';
import { WhereQueryBuilder } from './where';
import { Relation, RelationsBase } from '../relations';
import { QueryData } from '../sql';
import { ColumnsShape } from '../columns';
import { StringKey } from '../utils';

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
  R extends keyof T['relations'] = keyof T['relations'],
  W extends keyof T['withData'] = keyof T['withData'],
> =
  | [relation: R]
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
    : T['relations'] extends Record<string, Relation>
    ? A extends keyof T['relations']
      ? T['relations'][A]['table']
      : A extends keyof T['withData']
      ? T['withData'][A] extends WithDataItem
        ? {
            table: T['withData'][A]['table'];
            tableAlias: undefined;
            result: T['withData'][A]['shape'];
          }
        : never
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
            query: QueryData;
            table: T['withData'][Arg]['table'];
            tableAlias: undefined;
            clone(): QueryBase;
            selectable: {
              [K in keyof T['withData'][Arg]['shape'] as `${T['withData'][Arg]['table']}.${StringKey<K>}`]: {
                as: StringKey<K>;
                column: T['withData'][Arg]['shape'][K];
              };
            };
            shape: T['withData'][Arg]['shape'];
            __table: Query;
            relations: RelationsBase;
            withData: WithDataBase;
          }
        : never
      : Arg extends Query
      ? Arg
      : T['relations'] extends Record<string, Relation>
      ? Arg extends keyof T['relations']
        ? T['relations'][Arg]['table']
        : never
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
    : T['relations'] extends Record<string, Relation>
    ? Arg extends keyof T['relations']
      ? T['relations'][Arg]['table']
      : Arg extends keyof T['withData']
      ? T['withData'][Arg] extends WithDataItem
        ? {
            table: T['withData'][Arg]['table'];
            tableAlias: undefined;
            result: T['withData'][Arg]['shape'];
          }
        : never
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
      parsers = first.query.parsers || first.columnsParsers;
    }
  } else {
    joinKey = first as string;

    const relation = (q.relations as Record<string, Relation>)[joinKey];
    if (relation) {
      parsers = relation.query.query.parsers || relation.query.columnsParsers;
    } else {
      const shape = q.query.withShapes?.[first as string];
      if (shape) {
        parsers = {} as ColumnsParsers;
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

  return pushQueryValue(q, 'join', {
    type,
    args,
  }) as unknown as JoinResult<T, Args>;
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
    ON: {
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
  ...on: OnArgs<QueryBase>
): T => {
  return pushQueryValue(q, 'and', makeOnItem(joinFrom, joinTo, on));
};

export const pushQueryOrOn: typeof pushQueryOn = (
  q,
  joinFrom,
  joinTo,
  ...on
) => {
  return pushQueryValue(q, 'or', [makeOnItem(joinFrom, joinTo, on)]);
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

type OnJsonPathEqualsArgs<T extends QueryBase> = [
  leftColumn: keyof T['selectable'],
  leftPath: string,
  rightColumn: keyof T['selectable'],
  rightPath: string,
];

export class OnQueryBuilder<
    S extends QueryBase = QueryBase,
    J extends QueryBase = QueryBase,
  >
  extends WhereQueryBuilder<
    Omit<J, 'selectable'> & {
      selectable: Omit<S['selectable'], keyof S['shape']> & J['selectable'];
    }
  >
  implements QueryBase
{
  constructor(
    q: QueryBase | string,
    shape: ColumnsShape,
    public joinTo: QueryBase,
  ) {
    super(q, shape);
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

  onJsonPathEquals<T extends this>(
    this: T,
    ...args: OnJsonPathEqualsArgs<T>
  ): T {
    return this.clone()._onJsonPathEquals(...args);
  }
  _onJsonPathEquals<T extends this>(
    this: T,
    ...args: OnJsonPathEqualsArgs<T>
  ): T {
    return pushQueryValue(this, 'and', { ON: args });
  }
}
