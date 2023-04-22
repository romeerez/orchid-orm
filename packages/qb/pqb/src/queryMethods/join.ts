import {
  Query,
  QueryBase,
  QueryThen,
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
  NullableColumn,
} from 'orchid-core';
import { _join } from './_join';
import { AliasOrTable } from '../utils';
import { ColumnsObject, ColumnsShape } from '../columns';

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
  RequireJoined extends boolean,
  RequireMain extends boolean,
  Arg extends JoinFirstArg<T>,
  J extends Pick<Query, 'result' | 'table' | 'meta'> = Arg extends Query
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
    : never,
  Result extends ColumnsShape = RequireJoined extends true
    ? J['result']
    : { [K in keyof J['result']]: NullableColumn<J['result'][K]> },
  As extends string = AliasOrTable<J>,
  Selectable extends SelectableBase = {
    [K in keyof Result as `${As}.${StringKey<K>}`]: {
      as: K;
      column: Result[K];
    };
  } & {
    [K in As]: {
      as: K;
      column: RequireJoined extends true
        ? ColumnsObject<J['result']>
        : NullableColumn<ColumnsObject<J['result']>>;
    };
  },
> = RequireMain extends true
  ? {
      [K in keyof T]: K extends 'selectable'
        ? T['selectable'] & Selectable
        : T[K];
    }
  : OptionalMain<T, Selectable>;

type OptionalMain<
  T extends Query,
  Selectable extends SelectableBase,
  Result extends ColumnsShape = {
    [K in keyof T['result']]: NullableColumn<T['result'][K]>;
  },
> = {
  [K in keyof T]: K extends 'selectable'
    ? {
        [K in keyof T['selectable']]: {
          as: T['selectable'][K]['as'];
          column: NullableColumn<T['selectable'][K]['column']>;
        };
      } & Selectable
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<T['returnType'], Result>
    : T[K];
};

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

const join = <
  T extends Query,
  RequireJoined extends boolean,
  RequireMain extends boolean,
  Arg extends JoinFirstArg<T>,
  Args extends JoinArgs<T, Arg>,
>(
  q: T,
  require: RequireJoined,
  type: string,
  args: [arg: Arg, ...args: Args] | [arg: Arg, cb: JoinCallback<T, Arg>],
): JoinResult<T, RequireJoined, RequireMain, Arg> => {
  return _join(q.clone() as T, require, type, args) as unknown as JoinResult<
    T,
    RequireJoined,
    RequireMain,
    Arg
  >;
};

export class Join {
  join<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, true, true, Arg>;
  join<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, true, true, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  join(this: Query, ...args: any) {
    return join(this, true, 'JOIN', args);
  }
  _join<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, true, true, Arg>;
  _join<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, true, true, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _join(this: Query, ...args: any) {
    return _join(this, true, 'JOIN', args);
  }

  leftJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, false, true, Arg>;
  leftJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, false, true, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leftJoin(this: Query, ...args: any) {
    return join(this, false, 'LEFT JOIN', args);
  }
  _leftJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, false, true, Arg>;
  _leftJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, false, true, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _leftJoin(this: Query, ...args: any) {
    return _join(this, false, 'LEFT JOIN', args);
  }

  rightJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, true, false, Arg>;
  rightJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, true, false, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rightJoin(this: Query, ...args: any) {
    return join(this, true, 'RIGHT JOIN', args);
  }
  _rightJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, true, false, Arg>;
  _rightJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, true, false, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _rightJoin(this: Query, ...args: any) {
    return _join(this, true, 'RIGHT JOIN', args);
  }

  // TODO: full join should make all columns optional
  fullJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, false, false, Arg>;
  fullJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, false, false, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullJoin(this: Query, ...args: any) {
    return join(this, false, 'FULL JOIN', args);
  }
  _fullJoin<
    T extends Query,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(this: T, arg: Arg, ...args: Args): JoinResult<T, false, false, Arg>;
  _fullJoin<T extends Query, Arg extends JoinFirstArg<T>>(
    this: T,
    arg: Arg,
    cb: JoinCallback<T, Arg>,
  ): JoinResult<T, false, false, Arg>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _fullJoin(this: Query, ...args: any) {
    return _join(this, false, 'FULL JOIN', args);
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
    q: QueryBase,
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
