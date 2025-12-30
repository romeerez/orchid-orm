import { IsQuery, Query, SelectableFromShape } from '../../query';
import { Column } from '../../../columns/column';
import { addColumnParserToQuery, ColumnsShape } from '../../../columns';
import {
  PickQueryMeta,
  PickQueryMetaColumnTypes,
  PickQueryMetaResult,
  PickQueryMetaResultAs,
  PickQueryMetaResultRelationsWithDataReturnType,
  PickQueryMetaResultRelationsWithDataReturnTypeShape,
  PickQueryMetaResultRelationsWithDataReturnTypeShapeAs,
  PickQueryMetaResultReturnType,
  PickQueryMetaShape,
  PickQueryMetaShapeRelationsWithDataAs,
  PickQueryQ,
  PickQueryRelationsWithData,
  PickQueryTable,
  PickQueryMetaResultShapeAs,
  PickQueryResultAs,
  PickQueryShapeAs,
} from '../../pick-query-types';
import {
  EmptyTuple,
  pushOrNewArrayToObjectImmutable,
  setObjectValueImmutable,
} from '../../../utils';
import { getQueryAs } from '../as/as';
import { Expression } from '../../expressions/expression';
import { _clone } from '../clone/clone';
import {
  prepareSubQueryForSql,
  SubQueryForSql,
} from '../../sub-query/sub-query-for-sql';
import { _queryNone, isQueryNone } from '../../extra-features/none/none';
import {
  BatchParsers,
  ColumnsParsers,
  getQueryParsers,
  setParserToQuery,
} from '../../query-columns/query-column-parsers';
import { preprocessJoinArg, processJoinArgs } from './process-join-args';
import { getIsJoinSubQuery } from '../../sql/get-is-join-sub-query';
import { getShapeFromSelect } from '../select/select.utils';
import { WithDataItem } from '../cte/cte.sql';
import { QueryMetaBase, QuerySelectable } from '../../query-meta';
import { isRelationQuery, RelationConfigBase } from '../../relations';
import { ComputedColumns } from '../../extra-features/computed/computed';
import { throwIfJoinLateral } from '../../query.utils';
import { resolveSubQueryCallback } from '../../sub-query/sub-query';
import { SelectAs, SelectAsValue, SelectItem } from '../select/select.sql';
import { JoinItemArgs } from './join.sql';
import { getSqlText } from '../../sql/sql';
import { JoinValueDedupItem, pushQueryValueImmutable } from '../../query-data';
import { ToSQLQuery } from '../../sql/to-sql';
import { QueryThenByQuery } from '../../then/then';
import { getValueKey } from '../get/get-value-key';

// Type of column names of a `with` table, to use to join a `with` table by these columns.
// Union of `with` column names that may be prefixed with a `with` table name.
type WithSelectable<W extends WithDataItem> =
  | keyof W['shape']
  | `${W['table']}.${keyof W['shape'] & string}`;

/**
 * The first argument of all `join` and `joinLateral` methods.
 * See argument of {@link join}.
 */
export type JoinFirstArg<T extends PickQueryRelationsWithData> =
  | PickQueryResultAs
  | keyof T['relations']
  | keyof T['withData']
  | ((q: {
      [K in keyof T['relations']]: T['relations'][K]['query'];
    }) => PickQueryResultAs)
  | FnPickQueryResultAs;

interface FnPickQueryResultAs {
  (): PickQueryResultAs;
}

/**
 * Arguments of `join` methods (not `joinLateral`).
 * See {@link join}
 */
export type JoinArgs<
  T extends PickQueryMetaShapeRelationsWithDataAs,
  Arg extends JoinFirstArg<T>,
> =
  | [on?: JoinCallback<T, Arg>]
  | (Arg extends PickQueryResultAs
      ? JoinQueryArgs<T, Arg>
      : Arg extends keyof T['withData']
      ? JoinWithArgs<T, T['withData'][Arg]>
      : EmptyTuple);

/**
 * Column names of the joined table that can be used to join.
 * Derived from 'result', not from 'shape',
 * because if the joined table has a specific selection, it will be wrapped like:
 * ```sql
 * JOIN (SELECT something FROM joined) joined ON joined.something = ...
 * ```
 * And the selection becomes available to use in the `ON` and to select from the joined table.
 */
type JoinSelectable<Q extends PickQueryResultAs> =
  | keyof Q['result']
  | `${Q['__as']}.${keyof Q['result'] & string}`;

// Available arguments when joining a query object. Can be:
// - an object where keys are columns of the joined table and values are columns of the main table or a raw SQL.
// - raw SQL expression
// - `true` to join without conditions
// - pair of columns, first is of the joined table, second is of main table
// - string tuple of a column of a joined table, operator string such as '=' or '!=', and a column of the main table
type JoinQueryArgs<T extends PickQueryMeta, Q extends PickQueryResultAs> =
  | [
      conditions:
        | {
            [K in JoinSelectable<Q>]:
              | keyof T['meta']['selectable']
              | Expression;
          }
        | Expression
        | true,
    ]
  | [
      leftColumn: JoinSelectable<Q> | Expression,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ]
  | [
      leftColumn: JoinSelectable<Q> | Expression,
      op: string,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ];

// Available arguments when joining a `with` table. Can be:
// - an object where keys are columns of the `with` table and values are columns of the main table or a raw SQL
// - raw SQL expression
// - pair of columns, first is of the `with` table, second is of main table
// - string tuple of a column of a `with` table, operator string such as '=' or '!=', and a column of the main table
type JoinWithArgs<T extends PickQueryMeta, W extends WithDataItem> =
  | [
      conditions:
        | {
            [K in WithSelectable<W>]:
              | keyof T['meta']['selectable']
              | Expression;
          }
        | Expression,
    ]
  | [
      leftColumn: WithSelectable<W> | Expression,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ]
  | [
      leftColumn: WithSelectable<W> | Expression,
      op: string,
      rightColumn: keyof T['meta']['selectable'] | Expression,
    ];

export type JoinResultRequireMain<T extends PickQueryMeta, JoinedSelectable> = {
  // is optimal
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'selectable'
          ? T['meta']['selectable'] & JoinedSelectable
          : T['meta'][K];
      }
    : T[K];
};

/**
 * Result of all `join` methods, not `joinLateral`.
 * Adds joined table columns from its 'result' to the 'selectable' of the query.
 */
export type JoinResult<
  T extends PickQueryMetaResultReturnType,
  JoinedSelectable,
  RequireMain,
> = RequireMain extends true
  ? {
      // is optimal, same as JoinResultRequireMain above, inlined for fewer instantiations.
      [K in keyof T]: K extends 'meta'
        ? {
            [K in keyof T['meta']]: K extends 'selectable'
              ? T['meta']['selectable'] & JoinedSelectable
              : T['meta'][K];
          }
        : T[K];
    }
  : {
      [K in keyof T]: K extends 'meta'
        ? {
            [K in keyof T['meta']]: K extends 'selectable'
              ? {
                  [K in keyof T['meta']['selectable']]: {
                    as: T['meta']['selectable'][K]['as'];
                    column: Column.Modifiers.QueryColumnToNullable<
                      T['meta']['selectable'][K]['column']
                    >;
                  };
                } & JoinedSelectable // & is optimal
              : T['meta'][K];
          }
        : K extends 'result'
        ? // nullable result: inlined for optimization
          {
            [K in keyof T['result']]: Column.Modifiers.QueryColumnToNullable<
              T['result'][K]
            >;
          }
        : K extends 'then'
        ? QueryThenByQuery<
            T,
            // nullable result: inlined for optimization
            {
              [K in keyof T['result']]: Column.Modifiers.QueryColumnToNullable<
                T['result'][K]
              >;
            }
          >
        : T[K];
    };

/**
 * Calls {@link JoinResult} with either callback result, if join has a callback,
 * or with a query derived from the first join argument.
 */
export type JoinResultFromArgs<
  T extends PickQueryMetaResultRelationsWithDataReturnType,
  Arg,
  Args extends unknown[],
  RequireJoined,
  RequireMain,
> = JoinResult<
  T,
  Args[0] extends GenericJoinCallback
    ? JoinResultSelectable<
        ReturnType<Args[0]>['result'],
        ReturnType<Args[0]>['__as'],
        RequireJoined
      >
    : Arg extends PickQueryMetaResultShapeAs
    ? JoinResultSelectable<
        Arg['meta']['hasSelect'] extends true
          ? // If joined query has select, computed values won't be available, use `result` as is
            Arg['result']
          : // If no select, allow using computed values by setting result to shape
            Arg['shape'],
        Arg['__as'],
        RequireJoined
      >
    : Arg extends keyof T['relations']
    ? JoinResultSelectable<
        T['relations'][Arg]['query']['shape'],
        T['relations'][Arg]['query']['__as'],
        RequireJoined
      >
    : Arg extends FirstArgCallback
    ? JoinResultSelectable<
        ReturnType<Arg>['shape'],
        ReturnType<Arg>['__as'],
        RequireJoined
      >
    : Arg extends keyof T['withData']
    ? T['withData'][Arg] extends WithDataItem
      ? JoinResultSelectable<
          T['withData'][Arg]['shape'],
          T['withData'][Arg]['table'],
          RequireJoined
        >
      : never
    : never,
  RequireMain
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface GenericJoinCallback {
  (...args: any[]): PickQueryResultAs;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FirstArgCallback {
  (...args: any[]): PickQueryShapeAs;
}

/**
 * Result of all `joinLateral` methods.
 * Adds joined table columns from its 'result' to the 'selectable' of the query.
 *
 * @param T - query type to join to
 * @param Arg - first arg of join, see {@link JoinFirstArg}
 * @param RequireJoined - when false, joined table shape will be mapped to make all columns optional
 */
export type JoinLateralResult<
  T extends PickQueryMeta,
  As extends string,
  Result extends Column.QueryColumns,
  RequireJoined,
> = JoinAddSelectable<T, JoinResultSelectable<Result, As, RequireJoined>>;

/**
 * Build `selectable` type for joined table.
 *
 * When `RequireJoined` parameter is false,
 * the result type of the joined table will be mapped to make all columns optional.
 *
 * Callback may override the joined table alias.
 *
 * The resulting selectable receives all joined table columns prefixed with the table name or alias,
 * and a star prefixed with the table name or alias to select all joined columns.
 */
export type JoinResultSelectable<
  // Interestingly, accepting T and inlining T['result'] adds a LOT (~823k) instantiations
  Result extends Column.QueryColumns,
  As extends string,
  RequireJoined,
> = RequireJoined extends true
  ? {
      [K in '*' | (keyof Result & string) as `${As}.${K}`]: K extends '*'
        ? {
            as: As;
            column: ColumnsShape.MapToObjectColumn<Result>;
          }
        : {
            as: K;
            column: Result[K];
          };
    }
  : {
      [K in '*' | (keyof Result & string) as `${As}.${K}`]: K extends '*'
        ? {
            as: As;
            column: ColumnsShape.MapToNullableObjectColumn<Result>;
          }
        : {
            as: K;
            column: Column.Modifiers.QueryColumnToNullable<Result[K]>;
          };
    };

// Replace the 'selectable' of the query with the given selectable.
type JoinAddSelectable<T extends PickQueryMeta, Selectable> = {
  // is optimal
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'selectable'
          ? T['meta']['selectable'] & Selectable
          : T['meta'][K];
      }
    : T[K];
};

/**
 * Map the first argument of `join` or `joinLateral` to a query type.
 *
 * `with` table arg is mapped into `QueryBase`,
 * query arg is returned as is,
 * relation name is replaced with a relation table.
 */
export type JoinArgToQuery<
  T extends PickQueryRelationsWithData,
  Arg extends JoinFirstArg<T>,
> = Arg extends keyof T['withData']
  ? T['withData'][Arg] extends WithDataItem
    ? /**
       * Map the `with` table first argument of `join` or `joinLateral` to a query type.
       * Constructs `selectable` based on `with` table shape.
       */
      {
        [K in 'meta' | 'result' | '__as' | keyof T]: K extends '__as'
          ? T['withData'][Arg]['table']
          : K extends 'meta'
          ? QueryMetaBase & {
              selectable: {
                [K in keyof T['withData'][Arg]['shape'] &
                  string as `${T['withData'][Arg]['table']}.${K}`]: {
                  as: K;
                  column: T['withData'][Arg]['shape'][K];
                };
              };
            }
          : K extends 'result'
          ? T['withData'][Arg]['shape']
          : K extends keyof T
          ? T[K]
          : never;
      }
    : never
  : Arg extends PickQueryMetaResultAs
  ? Arg
  : Arg extends keyof T['relations']
  ? T['relations'][Arg]['query']
  : Arg extends JoinArgToQueryCallback
  ? ReturnType<Arg>
  : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface JoinArgToQueryCallback {
  (...args: any[]): IsQuery;
}

/**
 * Type of the `join` callback (not `joinLateral`).
 *
 * Receives a query builder that can access columns of both the main and the joined table.
 *
 * The query builder is limited to `or` and `where` methods only.
 *
 * Callback must return a query builder.
 */
export interface JoinCallback<
  T extends PickQueryMetaShapeRelationsWithDataAs,
  Arg extends JoinFirstArg<T>,
> {
  (q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>): IsQuery;
}

/**
 * Type of {@link QueryJoin.join} query method.
 */
export interface JoinQueryMethod {
  <
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShapeAs,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, true, true>;
}

/**
 * After getting a query from a sub-query callback,
 * join it to the main query in case it's a relation query.
 *
 * If it's not a relation query, it will be returned as is.
 *
 * @param q - main query object
 * @param sub - sub-query query object
 */
export const joinSubQuery = (q: ToSQLQuery, sub: ToSQLQuery): SubQueryForSql =>
  prepareSubQueryForSql(
    q as Query,
    (isRelationQuery(sub) ? sub.joinQuery(sub, q) : sub) as never,
  );

export const _joinReturningArgs = <
  T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
  RequireJoined extends boolean,
>(
  query: T,
  require: RequireJoined,
  first:
    | JoinFirstArg<never>
    // is used by `joinQueryChainHOF` in ORM
    | { _internalJoin: Query },
  args: JoinArgs<Query, JoinFirstArg<Query>>,
  forbidLateral?: boolean,
): JoinItemArgs | undefined => {
  let joinKey: string | undefined;
  let shape: Column.QueryColumns | undefined;
  let parsers: ColumnsParsers | undefined;
  let batchParsers: BatchParsers | undefined;
  let computeds: ComputedColumns | undefined;
  let joinSubQuery = false;

  first = preprocessJoinArg(query, first as JoinFirstArg<never>) as Query;

  if (typeof first === 'object') {
    let isInternalJoin;
    if ('_internalJoin' in first) {
      isInternalJoin = true;
      first = first._internalJoin as JoinFirstArg<never>;
    }

    if (require && isQueryNone(first)) {
      return;
    }

    const q = first as Query;
    if (!isInternalJoin) {
      joinSubQuery = getIsJoinSubQuery(q);
    }

    joinKey = q.q.as || q.table;
    if (joinKey) {
      shape = getShapeFromSelect(q, joinSubQuery && !!q.q.select);
      parsers = getQueryParsers(q);
      batchParsers = q.q.batchParsers;
      computeds = q.q.runtimeComputeds;

      if (joinSubQuery) {
        first = q.clone() as JoinFirstArg<Query>;
        (first as Query).shape = shape as never;
      }
    }
  } else {
    joinKey = first as string;

    const relation = query.relations[joinKey];
    if (relation) {
      shape = getShapeFromSelect(relation.query as never);
      const r = prepareSubQueryForSql(query as never, relation.query as Query);
      parsers = getQueryParsers(r);
      batchParsers = r.q.batchParsers;
      computeds = r.q.runtimeComputeds;
    } else {
      const w = (query as unknown as PickQueryQ).q.withShapes?.[joinKey];
      shape = w?.shape;
      computeds = w?.computeds;
      // TODO batchParsers

      if (shape) {
        // clone the shape to mutate it below; in other cases the shape is newly created
        if (!require) shape = { ...shape };

        const arg = { parsers: {} as ColumnsParsers };
        for (const key in shape) {
          addColumnParserToQuery(arg, key, shape[key]);
        }
      }
    }
  }

  const joinArgs = processJoinArgs(
    query as unknown as Query,
    first,
    args,
    joinSubQuery,
    shape,
    false,
    forbidLateral,
  );

  if (require && 'r' in joinArgs && isQueryNone(joinArgs.r)) {
    return;
  } else if (joinKey && 's' in joinArgs && joinArgs.s) {
    const j = (
      'j' in joinArgs
        ? joinArgs.r ?? joinArgs.j
        : 'r' in joinArgs
        ? joinArgs.r
        : joinArgs.q
    ) as Query;

    const jq = j.q;
    if (jq.select || !jq.selectAllColumns) {
      const { q } = query as unknown as PickQueryQ;

      // if 2nd argument callback is present, and it has select,
      // re-assign the columns shape from it.
      if ('r' in joinArgs && joinArgs.r) {
        joinArgs.c = shape = getShapeFromSelect(j, true);
      }

      setObjectValueImmutable(q, 'joinedShapes', joinKey, shape);
      setObjectValueImmutable(q, 'joinedParsers', joinKey, getQueryParsers(j));

      if (jq.batchParsers) {
        setObjectValueImmutable(
          jq,
          'joinedBatchParsers',
          joinKey,
          jq.batchParsers,
        );
      }

      setObjectValueImmutable(
        q,
        'joinedComputeds',
        joinKey,
        jq.runtimeComputeds,
      );
    } else {
      addAllShapesAndParsers(
        query,
        joinKey,
        shape,
        parsers,
        batchParsers,
        computeds,
      );
    }
  } else {
    addAllShapesAndParsers(
      query,
      joinKey,
      shape,
      parsers,
      batchParsers,
      computeds,
    );
  }

  return joinArgs;
};

const addAllShapesAndParsers = (
  query: unknown,
  joinKey?: string,
  shape?: Column.QueryColumns,
  parsers?: ColumnsParsers,
  batchParsers?: BatchParsers,
  computeds?: ComputedColumns,
) => {
  if (!joinKey) return;

  const { q } = query as PickQueryQ;

  setObjectValueImmutable(q, 'joinedShapes', joinKey, shape);

  setObjectValueImmutable(q, 'joinedParsers', joinKey, parsers);

  if (batchParsers) {
    setObjectValueImmutable(q, 'joinedBatchParsers', joinKey, batchParsers);
  }

  setObjectValueImmutable(q, 'joinedComputeds', joinKey, computeds);
};

/**
 * Generic function to construct all JOIN queries.
 * Add a shape of the joined table into `joinedShapes`.
 * Add column parsers of the joined table into `joinedParsers`.
 * Add join data into `join` of the query data.
 *
 * @param query - query object to join to
 * @param require - true for INNER kind of JOIN
 * @param type - SQL of the JOIN kind: JOIN, LEFT JOIN, RIGHT JOIN, etc.
 * @param first - the first argument of join: join target
 * @param args - rest join arguments: columns to join with, or a callback
 */
export const _join = <
  T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
  R extends PickQueryMetaResult,
  RequireJoined extends boolean,
  RequireMain extends boolean,
>(
  query: T,
  require: RequireJoined,
  type: string,
  first:
    | JoinFirstArg<never>
    // is used by `joinQueryChainHOF` in ORM
    | { _internalJoin: Query },
  args: JoinArgs<Query, JoinFirstArg<Query>>,
): JoinResult<T, R, RequireMain> => {
  const joinArgs = _joinReturningArgs(query, require, first, args);
  if (!joinArgs) {
    return _queryNone(query) as never;
  }

  pushQueryValueImmutable(query as never, 'join', {
    type,
    args: joinArgs,
  });

  if ((query as unknown as PickQueryQ).q.type === 'delete') {
    throwIfJoinLateral(
      query as never,
      (query as unknown as PickQueryQ).q.type as string,
    );
  }

  return query as never;
};

export const _joinLateralProcessArg = (
  q: Query,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arg: JoinFirstArg<any>,
  cb: (
    q: JoinQueryBuilder<
      PickQueryMetaShape,
      JoinArgToQuery<
        PickQueryRelationsWithData,
        JoinFirstArg<PickQueryRelationsWithData>
      >
    >,
  ) => {
    table: string;
    meta: QueryMetaBase;
    result: Column.QueryColumns;
  },
): Query => {
  let relation: RelationConfigBase | undefined;
  if (typeof arg === 'string') {
    relation = q.relations[arg];
    if (relation) {
      arg = _clone(relation.query);
    } else {
      const w = q.q.withShapes?.[arg];
      if (w) {
        const t = Object.create((q as unknown as Query).qb);
        t.table = arg;
        t.shape = w.shape;
        t.computeds = w.computeds;
        t.q = {
          ...t.q,
          shape: w.shape,
        };
        t.baseQuery = t;
        arg = t;
      }
    }
  }

  let result = resolveSubQueryCallback(
    arg as Query,
    cb as never,
  ) as unknown as Query;

  if (relation) {
    result = relation.joinQuery(
      result as unknown as Query,
      q as unknown as Query,
    ) as unknown as Query;
  }

  return result;
};

/**
 * Generic function to construct all JOIN LATERAL queries.
 * Adds a shape of the joined table into `joinedShapes`.
 * Adds column parsers of the joined table into `joinedParsers`.
 * Adds join data into `join` of the query data.
 *
 * @param self - query object to join to
 * @param type - SQL of the JOIN kind: JOIN or LEFT JOIN
 * @param joinQuery - join target: a query, or a relation name, or a `with` table name, or a callback returning a query.
 * @param as - alias of the joined table, it is set the join lateral happens when selecting a relation in `select`
 * @param innerJoinLateral - add `ON p.r IS NOT NULL` check to have INNER JOIN like experience when sub-selecting arrays.
 */
export const _joinLateral = (
  self: PickQueryMetaResultRelationsWithDataReturnTypeShape,
  type: string,
  joinQuery: Query,
  as?: string,
  innerJoinLateral?: boolean,
): string | undefined => {
  const query = self as Query;

  joinQuery = prepareSubQueryForSql(self as Query, joinQuery) as never;
  joinQuery.q.joinTo = query;

  as ||= getQueryAs(joinQuery);
  setObjectValueImmutable(
    query.q,
    'joinedComputeds',
    as,
    joinQuery.q.runtimeComputeds,
  );

  const joinArgs = {
    l: joinQuery,
    a: as,
    i: innerJoinLateral,
  };

  const joinAs = (as || joinQuery.q.as || joinQuery.table) as string;

  const joinValue =
    joinQuery.q.returnType === 'value' ||
    joinQuery.q.returnType === 'valueOrThrow';

  let joinValueAs: string | undefined;
  let joinValueSelect: SelectItem | undefined;
  let existingValue: JoinValueDedupItem | undefined;

  if (joinValue) {
    const map = query.q.joinValueDedup
      ? new Map(query.q.joinValueDedup)
      : new Map<string, JoinValueDedupItem>();
    query.q.joinValueDedup = map;

    const select = joinQuery.q.select as SelectItem[];
    joinValueSelect = select[0];
    joinQuery.q.select = [];
    const dedupKey = getSqlText(joinQuery.toSQL());
    joinQuery.q.select = select;

    existingValue = map.get(dedupKey);
    if (existingValue) {
      joinValueAs = existingValue.a as string;
    } else {
      joinValueAs = joinAs;
      map.set(dedupKey, { q: joinQuery, a: as });
    }
  }

  if (!existingValue) {
    const joinedAs = getQueryAs(query);
    setObjectValueImmutable(
      joinQuery.q,
      'joinedShapes',
      joinedAs,
      query.q.shape,
    );
  }

  const shape = getShapeFromSelect(joinQuery, true);
  setObjectValueImmutable(query.q, 'joinedShapes', joinAs, shape);

  const parsers = getQueryParsers(joinQuery);

  if (joinValue) {
    setObjectValueImmutable(query.q, 'valuesJoinedAs', joinAs, joinValueAs);

    const parse = parsers && getValueKey in parsers;
    if (parse) {
      const parse = parsers[getValueKey];
      setParserToQuery(query.q, joinAs, parse);
      parsers[joinAs] = parse;
    }
  }

  setObjectValueImmutable(
    query.q,
    'joinedParsers',
    joinValueAs || joinAs,
    getQueryParsers(joinQuery),
  );

  if (joinQuery.q.batchParsers) {
    setObjectValueImmutable(
      query.q,
      'joinedBatchParsers',
      joinAs,
      joinQuery.q.batchParsers,
    );
  }

  if (joinValueAs) {
    if (existingValue) {
      existingValue.q.q.select = [
        {
          selectAs: {
            ...((existingValue.q.q.select?.[0] as SelectAs)
              .selectAs as SelectAsValue),
            [joinAs]: joinValueSelect as never,
          },
        },
      ];

      return joinValueAs;
    }

    joinQuery.q.select = [
      { selectAs: { [joinValueAs]: joinValueSelect as string } },
    ];
  }

  pushQueryValueImmutable(query, 'join', {
    type: `${type} LATERAL`,
    args: joinArgs,
  });

  return joinAs;
};

export class QueryJoin {
  /**
   * ## Select relation
   *
   * Before joining a table, consider if selecting a relation is enough for your case:
   *
   * ```ts
   * // select users with profiles
   * // result type is Array<{ name: string, profile: Profile }>
   * await db.user.select('name', {
   *   profile: (q) => q.profile,
   * });
   *
   * // select posts with counts of comments, filter and order by comments count
   * // result type is Array<Post & { commentsCount: number }>
   * await db.post
   *   .select('*', {
   *     commentsCount: (q) => q.comments.count(),
   *   })
   *   .where({ commentsCount: { gt: 10 } })
   *   .order({ commentsCount: 'DESC' });
   *
   * // select authors with array of their book titles
   * // result type is Array<Author & { books: string[] }>
   * await db.author.select('*', {
   *   books: (q) => q.books.pluck('title'),
   * });
   * ```
   *
   * Internally, such selects will use `LEFT JOIN LATERAL` to join a relation.
   * If you're loading users with profiles (one-to-one relation), and some users don't have a profile, `profile` property will have `NULL` for such users.
   * If you want to load only users that have profiles, and filter out the rest, add `.join()` method to the relation without arguments:
   *
   * ```ts
   * // load only users who have a profile
   * await db.user.select('*', {
   *   profile: (q) => q.profile.join(),
   * });
   *
   * // load only users who have a specific profile
   * await db.user.select('*', {
   *   profile: (q) => q.profile.join().where({ age: { gt: 20 } }),
   * });
   * ```
   *
   * You can also use this `.join()` method on the one-to-many relations, and records with empty array will be filtered out:
   *
   * ```ts
   * // posts that have no tags won't be loaded
   * // result type is Array<Post & { tags: Tag[] }>
   * db.post.select('*', {
   *   tags: (q) => q.tags.join(),
   * });
   * ```
   *
   * # Joins
   *
   * `join` methods allows to join other tables, relations by name, [with](/guide/advanced-queries#with) statements, sub queries.
   *
   * All the `join` methods accept the same arguments, but returning type is different because with `join` it's guaranteed to load joined table, and with `leftJoin` the joined table columns may be `NULL` when no matching record was found.
   *
   * For the following examples, imagine you have a `User` table with `id` and `name`, and `Message` table with `id`, `text`, messages belongs to user via `userId` column:
   *
   * ```ts
   * export class UserTable extends BaseTable {
   *   readonly table = 'user';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     name: t.text(),
   *   }));
   *
   *   relations = {
   *     messages: this.hasMany(() => MessageTable, {
   *       primaryKey: 'id',
   *       foreignKey: 'userId',
   *     }),
   *   };
   * }
   *
   * export class MessageTable extends BaseTable {
   *   readonly table = 'message';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     text: t.text(),
   *     ...t.timestamps(),
   *   }));
   *
   *   relations = {
   *     user: this.belongsTo(() => UserTable, {
   *       primaryKey: 'id',
   *       foreignKey: 'userId',
   *     }),
   *   };
   * }
   * ```
   *
   * ## join
   *
   * `join` is a method for SQL `JOIN`, which is equivalent to `INNER JOIN`, `LEFT INNERT JOIN`.
   *
   * When no matching record is found, it will skip records of the main table.
   *
   * When joining the same table with the same condition more than once, duplicated joins will be ignored:
   *
   * ```ts
   * // joining a relation
   * db.post.join('comments').join('comments');
   *
   * // joining a table with a condition
   * db.post
   *   .join('comments', 'comments.postId', 'post.id')
   *   .join('comments', 'comments.postId', 'post.id');
   * ```
   *
   * Both queries will produce SQL with only 1 join
   *
   * ```sql
   * SELECT * FROM post JOIN comments ON comments.postId = post.id
   * ```
   *
   * However, this is only possible if the join has no dynamic values:
   *
   * ```ts
   * db.post
   *   .join('comments', (q) => q.where({ rating: { gt: 5 } }))
   *   .join('comments', (q) => q.where({ rating: { gt: 5 } }));
   * ```
   *
   * Both joins above have the same `{ gt: 5 }`, but still, the `5` is a dynamic value and in this case joins will be duplicated,
   * resulting in a database error.
   *
   * ### join relation
   *
   * When relations are defined between the tables, you can join them by a relation name.
   * Joined table can be references from `where` and `select` by a relation name.
   *
   * ```ts
   * const result = await db.user
   *   .join('messages')
   *   // after joining a table, you can use it in `where` conditions:
   *   .where({ 'messages.text': { startsWith: 'Hi' } })
   *   .select(
   *     'name', // name is User column, table name may be omitted
   *     'messages.text', // text is the Message column, and the table name is required
   *   );
   *
   * // result has the following type:
   * const ok: { name: string; text: string }[] = result;
   * ```
   *
   * The first argument can also be a callback, where instead of relation name as a string you're picking it as a property of `q`.
   * In such a way, you can alias the relation with `as`, add `where` conditions, use other query methods.
   *
   * ```ts
   * const result = await db.user.join((q) =>
   *   q.messages.as('m').where({ text: 'some text' }),
   * );
   * ```
   *
   * Optionally, you can pass a second callback argument, it makes `on` and `orOn` methods available.
   *
   * But remember that when joining a relation, the relevant `ON` conditions are already handled automatically.
   *
   * ```ts
   * const result = await db.user.join(
   *   (q) => q.messages.as('m'),
   *   (q) =>
   *     q
   *       .on('messages.text', 'user.name') // additionally, match message with user name
   *       .where({ text: 'some text' }), // you can add `where` in a second callback as well.
   * );
   * ```
   *
   * ### Selecting full joined records
   *
   * `select` supports selecting a full record of a previously joined table by passing a table name with `.*` at the end:
   *
   * ```ts
   * const result = await db.book.join('author').select('title', {
   *   author: 'author.*',
   * });
   *
   * // result has the following type:
   * const ok: {
   *   // title of the book
   *   title: string;
   *   // a full author record is included:
   *   author: { id: number; name: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * It works fine for `1:1` (`belongsTo`, `hasOne`) relations, but it may have an unexpected result for `1:M` or `M:M` (`hasMany`, `hasAndBelongsToMany`) relations.
   * For any kind of relation, it results in one main table record with data of exactly one joined table record, i.e. when selecting in this way, the records **won't** be collected into arrays.
   *
   * ```ts
   * const result = await db.user
   *   .join('messages')
   *   .where({ 'messages.text': { startsWith: 'Hi' } })
   *   .select('name', { messages: 'messages.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included:
   *   messages: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * Because it's a one-to-many relation, one user has many messages, the user data will be duplicated for different messages data:
   *
   * | name   | msg                            |
   * | ------ | ------------------------------ |
   * | user 1 | `{ id: 1, text: 'message 1' }` |
   * | user 1 | `{ id: 2, text: 'message 2' }` |
   * | user 1 | `{ id: 3, text: 'message 3' }` |
   *
   * ### join table
   *
   * If relation wasn't defined, provide a `db.table` instance and specify columns for the join.
   * Joined table can be references from `where` and `select` by a table name.
   *
   * ```ts
   * db.user
   *   .join(db.message, 'userId', 'user.id')
   *   .where({ 'message.text': { startsWith: 'Hi' } })
   *   .select('name', 'message.text');
   * ```
   *
   * The name of the joining table can be omitted, but not the name of the main table:
   *
   * ```ts
   * db.user.join(db.message, 'userId', 'user.id');
   * ```
   *
   * Joined table can have an alias for referencing it further:
   *
   * ```ts
   * db.user
   *   .join(db.message.as('m'), 'message.userId', 'user.id')
   *   .where({ 'm.text': { startsWith: 'Hi' } })
   *   .select('name', 'm.text');
   * ```
   *
   * Joined table can be selected as an object as well as the relation join above:
   *
   * ```ts
   * const result = await db.user
   *   .join(db.message.as('m'), 'message.userId', 'user.id')
   *   .where({ 'm.text': { startsWith: 'Hi' } })
   *   .select('name', { msg: 'm.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included as msg:
   *   msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * You can provide a custom comparison operator
   *
   * ```ts
   * db.user.join(db.message, 'userId', '!=', 'user.id');
   * ```
   *
   * Join can accept raw SQL for the `ON` part of join:
   *
   * ```ts
   * db.user.join(
   *   db.message,
   *   // `sql` can be imported from your `BaseTable` file
   *   sql`lower("message"."text") = lower("user"."name")`,
   * );
   * ```
   *
   * Join can accept raw SQL instead of columns:
   *
   * ```ts
   * db.user.join(
   *   db.message,
   *   sql`lower("message"."text")`,
   *   sql`lower("user"."name")`,
   * );
   *
   * // with operator:
   * db.user.join(
   *   db.message,
   *   sql`lower("message"."text")`,
   *   '!=',
   *   sql`lower("user"."name")`,
   * );
   * ```
   *
   * To join based on multiple columns, you can provide an object where keys are joining table columns, and values are main table columns or a raw SQL:
   *
   * ```ts
   * db.user.join(db.message, {
   *   'message.userId': 'user.id',
   *
   *   // joined table name may be omitted
   *   userId: 'user.id',
   *
   *   // value can be a raw SQL expression:
   *   text: sql`lower("user"."name")`,
   * });
   * ```
   *
   * Join all records without conditions by providing `true`:
   *
   * ```ts
   * db.user.join(db.message, true);
   * ```
   *
   * Join methods can accept a callback with a special query builder that has `on` and `orOn` methods for handling advanced cases:
   *
   * ```ts
   * db.user.join(
   *   db.message,
   *   (q) =>
   *     q
   *       .on('message.userId', 'user.id')
   *       // joined table name may be omitted
   *       .on('userId', 'user.id')
   *       // operator can be specified:
   *       .on('userId', '!=', 'user.id')
   *       // operator can be specified with table names as well:
   *       .on('message.userId', '!=', 'user.id')
   *       // `.orOn` takes the same arguments as `.on` and acts like `.or`:
   *       .on('userId', 'user.id') // where message.userId = user.id
   *       .orOn('text', 'user.name'), // or message.text = user.name
   * );
   * ```
   *
   * Column names in the where conditions are applied for the joined table, but you can specify a table name to add a condition for the main table.
   *
   * ```ts
   * db.user.join(db.message, (q) =>
   *   q
   *     .on('userId', 'user.id')
   *     .where({
   *       // not prefixed column name is for joined table:
   *       text: { startsWith: 'hello' },
   *       // specify a table name to set condition on the main table:
   *       'user.name': 'Bob',
   *     })
   *     // id is a column of a joined table Message
   *     .whereIn('id', [1, 2, 3])
   *     // condition for id of a user
   *     .whereIn('user.id', [4, 5, 6]),
   * );
   * ```
   *
   * The query above will generate the following SQL (simplified):
   *
   * ```sql
   * SELECT * FROM "user"
   * JOIN "message"
   *   ON "message"."userId" = "user"."id"
   *  AND "message"."text" ILIKE 'hello%'
   *  AND "user"."name" = 'Bob'
   *  AND "message"."id" IN (1, 2, 3)
   *  AND "user"."id" IN (4, 5, 6)
   * ```
   *
   * The join argument can be a query with `select`, `where`, and other methods. In such case, it will be handled as a sub query:
   *
   * ```ts
   * db.user.join(
   *   db.message
   *     .select('id', 'userId', 'text')
   *     .where({ text: { startsWith: 'Hi' } })
   *     .as('t'),
   *   'userId',
   *   'user.id',
   * );
   * ```
   *
   * It will produce such SQL:
   *
   * ```sql
   * SELECT * FROM "user"
   * JOIN (
   *   SELECT "t"."id", "t"."userId", "t"."text"
   *   FROM "message" AS "t"
   * ) "t" ON "t"."userId" = "user"."id"
   * ```
   *
   * ## implicit join lateral
   *
   * `JOIN`'s source expression that comes before `ON` cannot access other tables, but in some cases this may be needed.
   *
   * For example, let's consider joining last 10 messages of a user:
   *
   * ```ts
   * await db.user.join('messages', (q) => q.order({ createdAt: 'DESC' }).limit(10));
   * ```
   *
   * When the `join`'s callback returns a more complex query than the one that simply applies certain conditions,
   * it will implicitly generate a `JOIN LATERAL` SQL query, as the following:
   *
   * ```sql
   * SELECT *
   * FROM "user"
   * JOIN LATERAL (
   *   SELECT *
   *   FROM "message" AS "messages"
   *   WHERE "message"."userId" = "user"."id"
   *   ORDER BY "message"."createdAt" DESC
   *   LIMIT 10
   * ) "messages" ON true
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  join<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShapeAs,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, true, true> {
    return _join(
      _clone(this),
      true,
      'JOIN',
      arg as never,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `leftJoin` is a method for SQL `LEFT JOIN`, which is equivalent to `OUTER JOIN`, `LEFT OUTER JOIN`.
   *
   * When no matching record is found, it will fill joined table columns with `NULL` values in the result rows.
   *
   * Works just like `join`, except for result type that may have `null`:
   *
   * ```ts
   * const result = await db.user
   *   .leftJoin('messages')
   *   .select('name', 'messages.text');
   *
   * // the same query, but joining table explicitly
   * const result2: typeof result = await db.user
   *   .leftJoin(db.message, 'userId', 'user.id')
   *   .select('name', 'message.text');
   *
   * // result has the following type:
   * const ok: { name: string; text: string | null }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  leftJoin<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShapeAs,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, false, true> {
    return _join(
      _clone(this),
      false,
      'LEFT JOIN',
      arg as never,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `rightJoin` is a method for SQL `RIGHT JOIN`, which is equivalent to `RIGHT OUTER JOIN`.
   *
   * Takes the same arguments as `json`.
   *
   * It will load all records from the joining table, and fill the main table columns with `null` when no match is found.
   *
   * The columns of the table you're joining to are becoming nullable when using `rightJoin`.
   *
   * ```ts
   * const result = await db.user
   *   .rightJoin('messages')
   *   .select('name', 'messages.text');
   *
   * // even though name is not a nullable column, it becomes nullable after using rightJoin
   * const ok: { name: string | null; text: string }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  rightJoin<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShapeAs,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, true, false> {
    return _join(
      _clone(this),
      true,
      'RIGHT JOIN',
      arg as never,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `fullJoin` is a method for SQL `FULL JOIN`, which is equivalent to `FULL OUTER JOIN`.
   *
   * Takes the same arguments as `json`.
   *
   * It will load all records from the joining table, both sides of the join may result in `null` values when there is no match.
   *
   * All columns become nullable after using `fullJoin`.
   *
   * ```ts
   * const result = await db.user
   *   .rightJoin('messages')
   *   .select('name', 'messages.text');
   *
   * // all columns can be null
   * const ok: { name: string | null; text: string | null }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param args - {@link JoinArgs}
   */
  fullJoin<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShapeAs,
    Arg extends JoinFirstArg<T>,
    Args extends JoinArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Args
  ): JoinResultFromArgs<T, Arg, Args, false, false> {
    return _join(
      _clone(this),
      false,
      'FULL JOIN',
      arg as never,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) as never;
  }

  /**
   * `joinLateral` allows joining a table with a sub-query that can reference the main table of current query and the other joined tables.
   *
   * First argument is the other table you want to join, or a name of relation, or a name of `with` defined table.
   *
   * Second argument is a callback where you can reference other tables using `on` and `orOn`, select columns, do `where` conditions, and use any other query methods to build a sub-query.
   *
   * Note that the regular `join` will also generate `JOIN LATERAL` SQL expression when the query returned from callback is complex enough (see the bottom of {@link join} description).
   *
   * ```ts
   * // joinLateral messages relation, alias it as `m`
   * // without aliasing you can refer to the message by a table name
   * db.user
   *   .joinLateral(db.message.as('m'), (q) =>
   *     q
   *       // select message columns
   *       .select('text')
   *       // join the message to the user, column names can be prefixed with table names
   *       .on('authorId', 'user.id')
   *       // message columns are available without prefixing,
   *       // outer table columns are available with a table name
   *       .where({ text: 'some text', 'user.name': 'name' })
   *       .order({ createdAt: 'DESC' }),
   *   )
   *   // only selected message columns are available in select and where
   *   .select('id', 'name', 'm.text')
   *   .where({ 'm.text': messageData.text });
   * ```
   *
   * As well as simple `join`, `joinLateral` can select an object of full joined record:
   *
   * ```ts
   * // join by relation name
   * const result = await db.user
   *   .joinLateral('messages', (q) => q.as('message')) // alias to 'message'
   *   .select('name', { message: 'message.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included:
   *   message: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * `message` can be aliased withing the `select` as well as in case of a simple `join`:
   *
   * ```ts
   * // join by relation name
   * const result = await db.user
   *   .joinLateral('messages', (q) => q.as('message')) // alias to 'message'
   *   .select('name', { msg: 'message.*' });
   *
   * // result has the following type:
   * const ok: {
   *   name: string;
   *   // full message is included as msg:
   *   msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
   * }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param cb - {@link JoinLateralCallback}
   */
  joinLateral<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    As extends string,
    Result extends Column.QueryColumns,
  >(
    this: T,
    arg: Arg,
    cb: (q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>) => {
      __as: As;
      result: Result;
    },
  ): JoinLateralResult<T, As, Result, true> {
    const q = _clone(this);
    _joinLateral(
      q,
      'JOIN',
      _joinLateralProcessArg(q, arg as never, cb as never),
    );
    return q as never;
  }

  /**
   * The same as {@link joinLateral}, but when no records found for the join it will result in `null`:
   *
   * ```ts
   * const result = await db.user
   *   .leftJoinLateral('messages', (q) => q.as('message'))
   *   .select('name', 'message.text');
   *
   * // result has the following type:
   * const ok: { name: string; text: string | null }[] = result;
   * ```
   *
   * @param arg - {@link JoinFirstArg}
   * @param cb - {@link JoinLateralCallback}
   */
  leftJoinLateral<
    T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    Arg extends JoinFirstArg<T>,
    As extends string,
    Result extends Column.QueryColumns,
  >(
    this: T,
    arg: Arg,
    cb: (q: JoinQueryBuilder<T, JoinArgToQuery<T, Arg>>) => {
      __as: As;
      result: Result;
    },
  ): JoinLateralResult<T, As, Result, false> {
    const q = _clone(this);
    _joinLateral(
      q,
      'LEFT JOIN',
      _joinLateralProcessArg(q, arg as never, cb as never),
    );
    return q as never;
  }

  /**
   * This method may be useful
   * for combining with [createForEachFrom](/guide/create-update-delete.html#createForEachFrom-insertForEachFrom).
   *
   * `createForEachFrom` creates multiple record based on a selecting query:
   *
   * ```sql
   * INSERT INTO t1(c1, c2)
   * SELECT c1, c2 FROM t2
   * ```
   *
   * Such a query inserts one record per one selected record.
   *
   * Use `joinData` to insert a multiplication of selected records and the provided data.
   *
   * ```ts
   * const data = [{ column2: 'one' }, { column2: 'two' }, { column2: 'three' }];
   *
   * await db.table.createForEachFrom(
   *   db.otherTable
   *     .joinData('data', (t) => ({ column2: t.text() }), data)
   *     .select('otherTable.column1', 'data.column2'),
   * );
   * ```
   *
   * If the query on the other table returns 2 records,
   * and the data array contains 3 records, then 2 \* 3 = 6 will be inserted - every combination.
   *
   * Joined data values are available in `where` just as usual.
   *
   * @param as - alias to reference joined columns
   * @param fn - declare column types
   * @param data - array of data to join
   */
  joinData<
    T extends PickQueryMetaColumnTypes,
    As extends string,
    RecordType extends Column.QueryColumnsInit,
    Item extends ColumnsShape.Input<RecordType>,
  >(
    this: T,
    as: As,
    fn: (types: T['columnTypes']) => RecordType,
    data: Item[],
  ): {
    [K in keyof T]: K extends 'meta'
      ? {
          [K in keyof T['meta']]: K extends 'selectable'
            ? T['meta']['selectable'] & {
                [K in keyof RecordType & string as `${As}.${K}`]: {
                  as: K;
                  column: RecordType[K];
                };
              }
            : T['meta'][K];
        }
      : T[K];
  } {
    const shape = fn(this.columnTypes);

    const query = _clone(this);

    const parsers = Object.fromEntries(
      Object.entries(shape).map(([key, column]) => [
        key,
        (column as Column)._parse,
      ]),
    );

    const { q } = query;
    setObjectValueImmutable(q, 'joinedShapes', as, shape);
    setObjectValueImmutable(q, 'joinedParsers', as, parsers);

    pushOrNewArrayToObjectImmutable(q, 'join', {
      type: 'JOIN',
      args: { a: as, c: shape, d: data },
    });

    return query as never;
  }
}

// Arguments of `on` and `orOn` methods inside `join` callback.
// Takes a pair of columns to check them for equality, or a pair of columns separated with an operator such as '!='.
type OnArgs<S extends QuerySelectable> =
  | [leftColumn: keyof S, rightColumn: keyof S]
  | [leftColumn: keyof S, op: string, rightColumn: keyof S];

// Construct an object for `ON` type of where condition.
const makeOnItem = (
  joinTo: PickQueryMeta,
  joinFrom: PickQueryMeta,
  args: OnArgs<QuerySelectable>,
) => ({
  ON: {
    joinFrom,
    from: args[0],
    joinTo,
    to: args.length === 2 ? args[1] : args[2],
    op: args.length === 2 ? undefined : args[1],
  },
});

// Add `ON` statement.
export const pushQueryOnForOuter = <T extends PickQueryMeta>(
  q: T,
  joinFrom: PickQueryMeta,
  joinTo: PickQueryMeta,
  leftColumn: string,
  rightColumn: string,
): T => {
  return pushQueryValueImmutable(q as never, 'and', {
    ON: {
      joinFrom: joinTo,
      from: leftColumn,
      joinTo: joinFrom,
      to: rightColumn,
      useOuterAliases: true,
    },
  }) as never;
};

// Add `ON` statement.
export const pushQueryOn = <T extends PickQueryMeta>(
  q: T,
  joinFrom: PickQueryMeta,
  joinTo: PickQueryMeta,
  ...on: OnArgs<QuerySelectable>
): T => {
  return pushQueryValueImmutable(
    q as never,
    'and',
    makeOnItem(joinFrom, joinTo, on),
  ) as never;
};

// Add `ON` statement separated from previous statements with `OR`.
export const pushQueryOrOn = <T extends PickQueryMeta>(
  q: T,
  joinFrom: PickQueryMeta,
  joinTo: PickQueryMeta,
  ...on: OnArgs<QuerySelectable>
) => {
  return pushQueryValueImmutable(q as never, 'or', [
    makeOnItem(joinFrom, joinTo, on),
  ]);
};

// Used by the ORM to join relations.
// Adds a shape of relation to the `joinedShapes`, and adds an `on` statement.
export const addQueryOn = <T extends PickQueryMeta>(
  query: T,
  joinFrom: PickQueryMeta,
  joinTo: PickQueryMeta,
  ...args: OnArgs<QuerySelectable>
): T => {
  const cloned = _clone(query);

  const { q } = cloned;

  setObjectValueImmutable(
    q,
    'joinedShapes',
    ((joinFrom as unknown as PickQueryQ).q.as ||
      (joinFrom as PickQueryTable).table) as string,
    (joinFrom as unknown as PickQueryQ).q.shape,
  );

  return pushQueryOn(cloned, joinFrom, joinTo, ...args) as never;
};

// To join record based on a value inside their json columns
type OnJsonPathEqualsArgs<S extends QuerySelectable> = [
  leftColumn: keyof S,
  leftPath: string,
  rightColumn: keyof S,
  rightPath: string,
];

/**
 * Mutative {@link OnMethods.prototype.on}
 */
export const _queryJoinOn = <T extends PickQueryMeta>(
  q: T,
  args: OnArgs<T['meta']['selectable']>,
): T => {
  return pushQueryOn(
    q,
    (q as unknown as PickQueryQ).q.joinTo as unknown as PickQueryMeta,
    q,
    ...args,
  );
};

/**
 * Mutative {@link OnMethods.prototype.orOn}
 */
export const _queryJoinOrOn = <T extends PickQueryMeta>(
  q: T,
  args: OnArgs<T['meta']['selectable']>,
): T => {
  return pushQueryOrOn(
    q,
    (q as unknown as PickQueryQ).q.joinTo as unknown as PickQueryMeta,
    q,
    ...args,
  ) as unknown as T;
};

/**
 * Mutative {@link OnMethods.prototype.onJsonPathEquals}
 */
export const _queryJoinOnJsonPathEquals = <T extends PickQueryMeta>(
  q: T,
  args: OnJsonPathEqualsArgs<T['meta']['selectable']>,
): T => {
  return pushQueryValueImmutable(q as never, 'and', {
    ON: args,
  }) as unknown as T;
};

/**
 * Argument of join callback.
 * It is a query object of table that you're joining, with ability to select main table's columns.
 * Adds {@link OnMethods.prototype.on} method and similar to the query.
 */
export type JoinQueryBuilder<
  T extends PickQueryMetaShape = PickQueryMetaShape,
  J extends PickQueryMetaResultAs = PickQueryMetaResultAs,
> = {
  [K in keyof J | keyof OnMethods]: K extends 'meta'
    ? {
        [K in keyof J['meta']]: K extends 'selectable'
          ? SelectableFromShape<J['result'], J['__as']> &
              Omit<T['meta']['selectable'], keyof T['shape']>
          : J['meta'][K];
      }
    : K extends keyof OnMethods
    ? OnMethods[K]
    : K extends keyof J
    ? J[K]
    : never;
};

export class OnMethods {
  /**
   * Use `on` to specify columns to join records.
   *
   * ```ts
   * q
   *   .on('message.userId', 'user.id')
   *   // joined table name may be omitted
   *   .on('userId', 'user.id')
   *   // operator can be specified:
   *   .on('userId', '!=', 'user.id')
   *   // operator can be specified with table names as well:
   *   .on('message.userId', '!=', 'user.id')
   * ```
   *
   * @param args - columns to join with
   */
  on<T extends PickQueryMeta>(
    this: T,
    ...args: OnArgs<T['meta']['selectable']>
  ): T {
    return _queryJoinOn(_clone(this) as never, args);
  }

  /**
   * Works as {@link on}, but the added conditions will be separated from previous with `OR`.
   *
   * @param args - columns to join with
   */
  orOn<T extends PickQueryMeta>(
    this: T,
    ...args: OnArgs<T['meta']['selectable']>
  ): T {
    return _queryJoinOrOn(_clone(this) as never, args);
  }

  /**
   * Use `onJsonPathEquals` to join record based on a field of their JSON column:
   *
   * ```ts
   * db.table.join(db.otherTable, (q) =>
   *   // '$.key' is a JSON path
   *   q.onJsonPathEquals('otherTable.data', '$.key', 'table.data', '$.key'),
   * );
   * ```
   *
   * @param args - columns and JSON paths to join with.
   */
  onJsonPathEquals<T extends PickQueryMeta>(
    this: T,
    ...args: OnJsonPathEqualsArgs<T['meta']['selectable']>
  ): T {
    return _queryJoinOnJsonPathEquals(_clone(this) as never, args);
  }
}
