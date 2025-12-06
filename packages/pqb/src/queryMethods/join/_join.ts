import { PickQueryQ, Query } from '../../query/query';
import {
  BatchParsers,
  ColumnsParsers,
  getQueryParsers,
  PickQueryMetaResultRelationsWithDataReturnTypeShape,
  PickQueryMetaShape,
  PickQueryRelationsWithData,
  PickQueryTableMetaResult,
  pushQueryValueImmutable,
  QueryMetaBase,
  RelationConfigBase,
  setObjectValueImmutable,
} from '../../core';
import { getShapeFromSelect } from '../select/select';
import { _clone, throwIfJoinLateral } from '../../query/queryUtils';
import {
  JoinArgs,
  JoinArgToQuery,
  JoinFirstArg,
  JoinQueryBuilder,
  JoinResult,
} from './join';
import { getQueryAs, resolveSubQueryCallbackV2 } from '../../common/utils';
import { preprocessJoinArg, processJoinArgs } from './processJoinArgs';
import { _queryNone, isQueryNone } from '../none';
import { ComputedColumns } from '../../modules/computed';
import { addColumnParserToQuery } from '../../columns/column.utils';
import { getSqlText } from '../../sql/utils';
import { JoinItemArgs, SelectItem } from '../../sql/types';
import { Column } from '../../columns/column';
import { getIsJoinSubQuery } from '../../sql/get-is-join-sub-query';
import { prepareSubQueryForSql } from 'pqb';

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

  first = preprocessJoinArg(query, first as JoinFirstArg<never>);

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
  R extends PickQueryTableMetaResult,
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

  let result = resolveSubQueryCallbackV2(
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
 * @param arg - join target: a query, or a relation name, or a `with` table name, or a callback returning a query.
 * @param as - alias of the joined table, it is set the join lateral happens when selecting a relation in `select`
 * @param innerJoinLateral - add `ON p.r IS NOT NULL` check to have INNER JOIN like experience when sub-selecting arrays.
 */
export const _joinLateral = (
  self: PickQueryMetaResultRelationsWithDataReturnTypeShape,
  type: string,
  arg: Query,
  as?: string,
  innerJoinLateral?: boolean,
): string | undefined => {
  const q = self as Query;
  arg = prepareSubQueryForSql(self as Query, arg) as never;

  arg.q.joinTo = q;
  const joinedAs = getQueryAs(q);
  setObjectValueImmutable(arg.q, 'joinedShapes', joinedAs, q.q.shape);

  const joinKey = as || arg.q.as || arg.table;
  if (joinKey) {
    const shape = getShapeFromSelect(arg, true);
    setObjectValueImmutable(q.q, 'joinedShapes', joinKey, shape);

    setObjectValueImmutable(
      q.q,
      'joinedParsers',
      joinKey,
      getQueryParsers(arg),
    );

    if (arg.q.batchParsers) {
      setObjectValueImmutable(
        q.q,
        'joinedBatchParsers',
        joinKey,
        arg.q.batchParsers,
      );
    }
  }

  as ||= getQueryAs(arg);
  setObjectValueImmutable(q.q, 'joinedComputeds', as, arg.q.runtimeComputeds);

  const joinArgs = {
    l: arg,
    a: as,
    i: innerJoinLateral,
  };

  if (arg.q.returnType === 'value' || arg.q.returnType === 'valueOrThrow') {
    const map = q.q.joinValueDedup ? new Map(q.q.joinValueDedup) : new Map();
    q.q.joinValueDedup = map;

    const select = (arg.q.select as SelectItem[])[0];
    arg.q.select = [];
    const dedupKey = getSqlText(arg.toSQL());

    const existing = map.get(dedupKey);
    if (existing) {
      existing.q.q.select = [
        {
          selectAs: {
            ...existing.q.q.select[0].selectAs,
            [joinKey as string]: select as string,
          },
        },
      ];
      return existing.a;
    } else {
      arg.q.select = [{ selectAs: { [joinKey as string]: select as string } }];
      map.set(dedupKey, { q: arg, a: as });
    }
  }

  pushQueryValueImmutable(q, 'join', {
    type: `${type} LATERAL`,
    args: joinArgs,
  });

  return joinKey;
};
