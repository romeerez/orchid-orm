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
  ...rest:
    | [op: string, rightColumn: keyof Q['selectable']]
    | [rightColumn: keyof Q['selectable']]
) => Q;

const on: On = function (leftColumn, ...rest) {
  return this.clone()._on(leftColumn, ...rest);
};

const _on: On = function (leftColumn, ...rest) {
  return pushQueryValue(this, 'and', {
    item: {
      type: 'on',
      on:
        rest.length === 1
          ? [leftColumn, rest[0]]
          : [leftColumn, rest[0], rest[1]],
    },
  });
};

const onOr: On = function (leftColumn, ...rest) {
  return this.clone()._on(leftColumn, ...rest);
};

const _onOr: On = function (leftColumn, ...rest) {
  return pushQueryValue(this, 'or', [
    {
      item: {
        type: 'on',
        on:
          rest.length === 1
            ? [leftColumn, rest[0]]
            : [leftColumn, rest[0], rest[1]],
      },
    },
  ]);
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

    const resultQuery = fn({
      table: q.table,
      tableAlias: q.query?.as,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selectable: undefined as any,
      ...joinQueryMethods,
    });

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
