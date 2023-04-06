import {
  AddQueryJoinedTable,
  Query,
  QueryBase,
  Selectable,
  SelectableBase,
  WithDataBase,
  WithDataItem,
} from '../query';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import { WhereQueryBuilder } from './where';
import { Relation, RelationsBase } from '../relations';
import { QueryData } from '../sql';
import {
  RawExpression,
  EmptyObject,
  StringKey,
  QueryInternal,
  EmptyTuple,
} from 'orchid-core';
import { _join } from './_join';
import { AliasOrTable } from '../utils';

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

export type JoinFirstArg<T extends QueryBase> =
  | Query
  | keyof T['relations']
  | keyof T['withData'];

export type JoinArgs<
  T extends QueryBase,
  Arg extends JoinFirstArg<T>,
> = Arg extends Query
  ? JoinQueryArgs<T, Arg>
  : Arg extends keyof T['relations']
  ? EmptyTuple
  : Arg extends keyof T['withData']
  ? JoinWithArgs<T, Arg>
  : never;

type JoinSelectable<Q extends Query> =
  | keyof Q['result']
  | `${AliasOrTable<Q>}.${StringKey<keyof Q['result']>}`;

type JoinQueryArgs<T extends QueryBase, Q extends Query> =
  | [
      conditions:
        | Record<JoinSelectable<Q>, Selectable<T> | RawExpression>
        | RawExpression
        | true,
    ]
  | [
      leftColumn: JoinSelectable<Q> | RawExpression,
      rightColumn: Selectable<T> | RawExpression,
    ]
  | [
      leftColumn: JoinSelectable<Q> | RawExpression,
      op: string,
      rightColumn: Selectable<T> | RawExpression,
    ];

type JoinWithArgs<T extends QueryBase, W extends keyof T['withData']> =
  | [
      conditions:
        | Record<WithSelectable<T, W>, Selectable<T> | RawExpression>
        | RawExpression,
    ]
  | [
      leftColumn: WithSelectable<T, W> | RawExpression,
      rightColumn: Selectable<T> | RawExpression,
    ]
  | [
      leftColumn: WithSelectable<T, W> | RawExpression,
      op: string,
      rightColumn: Selectable<T> | RawExpression,
    ];

export type JoinResult<
  T extends Query,
  Arg extends JoinFirstArg<T>,
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
            result: T['withData'][Arg]['shape'];
            meta: EmptyObject;
          }
        : never
      : never
    : never
>;

export type JoinCallback<T extends QueryBase, Arg extends JoinFirstArg<T>> = (
  q: OnQueryBuilder<
    T,
    Arg extends keyof T['withData']
      ? T['withData'][Arg] extends WithDataItem
        ? {
            query: QueryData;
            table: T['withData'][Arg]['table'];
            clone(): QueryBase;
            selectable: {
              [K in keyof T['withData'][Arg]['shape'] as `${T['withData'][Arg]['table']}.${StringKey<K>}`]: {
                as: StringKey<K>;
                column: T['withData'][Arg]['shape'][K];
              };
            };
            shape: T['withData'][Arg]['shape'];
            baseQuery: Query;
            relations: RelationsBase;
            withData: WithDataBase;
            meta: EmptyObject;
            internal: QueryInternal;
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
  Arg extends JoinFirstArg<T>,
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
            result: T['withData'][Arg]['shape'];
            meta: EmptyObject;
          }
        : never
      : never
    : never
>;

const join = <
  T extends Query,
  Arg extends JoinFirstArg<T>,
  Args extends JoinArgs<T, Arg>,
>(
  q: T,
  type: string,
  args: [arg: Arg, ...args: Args] | [arg: Arg, cb: JoinCallback<T, Arg>],
): JoinResult<T, Arg> => {
  return _join(q.clone() as T, type, args) as unknown as JoinResult<T, Arg>;
};

export class Join {
  join<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  join<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  join(this: Query, ...args: any) {
    return join(this, 'JOIN', args);
  }
  _join<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  _join<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _join(this: Query, ...args: any) {
    return _join(this, 'JOIN', args);
  }

  innerJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  innerJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  innerJoin(this: Query, ...args: any) {
    return join(this, 'INNER JOIN', args);
  }
  _innerJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  _innerJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _innerJoin(this: Query, ...args: any) {
    return _join(this, 'INNER JOIN', args);
  }

  leftJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  leftJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leftJoin(this: Query, ...args: any) {
    return join(this, 'LEFT JOIN', args);
  }
  _leftJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  _leftJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _leftJoin(this: Query, ...args: any) {
    return _join(this, 'LEFT JOIN', args);
  }

  leftOuterJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  leftOuterJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leftOuterJoin(this: Query, ...args: any) {
    return join(this, 'LEFT OUTER JOIN', args);
  }
  _leftOuterJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  _leftOuterJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _leftOuterJoin(this: Query, ...args: any) {
    return _join(this, 'LEFT OUTER JOIN', args);
  }

  rightJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  rightJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rightJoin(this: Query, ...args: any) {
    return join(this, 'RIGHT JOIN', args);
  }
  _rightJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  _rightJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _rightJoin(this: Query, ...args: any) {
    return _join(this, 'RIGHT JOIN', args);
  }

  rightOuterJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  rightOuterJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rightOuterJoin(this: Query, ...args: any) {
    return join(this, 'RIGHT OUTER JOIN', args);
  }
  _rightOuterJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  _rightOuterJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _rightOuterJoin(this: Query, ...args: any) {
    return _join(this, 'RIGHT OUTER JOIN', args);
  }

  fullOuterJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  fullOuterJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinCallbackResult<T, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullOuterJoin(this: Query, ...args: any) {
    return join(this, 'FULL OUTER JOIN', args);
  }
  _fullOuterJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, Arg>;
  _fullOuterJoin<T extends Query, Arg extends JoinFirstArg<T>>(
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

export const addQueryOn = <T extends QueryBase>(
  q: T,
  joinFrom: QueryBase,
  joinTo: QueryBase,
  ...args: OnArgs<QueryBase>
): T => {
  const cloned = q.clone() as typeof q;
  setQueryObjectValue(
    cloned,
    'joinedShapes',
    (joinFrom.query.as || joinFrom.table) as string,
    joinFrom.query.shape,
  );
  return pushQueryOn(cloned, joinFrom, joinTo, ...args);
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
    J & {
      selectable: Omit<S['selectable'], keyof S['shape']>;
    }
  >
  implements QueryBase
{
  constructor(
    q: QueryBase | string,
    data: Pick<QueryData, 'shape' | 'joinedShapes'>,
    public joinTo: QueryBase,
  ) {
    super(q, data);
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
