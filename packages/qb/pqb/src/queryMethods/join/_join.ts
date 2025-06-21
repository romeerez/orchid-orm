import {
  PickQueryMetaResultRelationsWithDataReturnTypeShape,
  PickQueryQ,
  PickQueryRelationsWithData,
  Query,
} from '../../query/query';
import {
  BatchParsers,
  ColumnsParsers,
  ColumnsShapeBase,
  PickQueryMetaShape,
  PickQueryTableMetaResult,
  QueryColumns,
  QueryMetaBase,
  setObjectValueImmutable,
} from 'orchid-core';
import { getIsJoinSubQuery } from '../../sql/join';
import { getShapeFromSelect } from '../select';
import { RelationQueryBase } from '../../relations';
import {
  _clone,
  pushQueryValueImmutable,
  throwIfJoinLateral,
} from '../../query/queryUtils';
import {
  JoinArgs,
  JoinArgToQuery,
  JoinFirstArg,
  JoinLateralResult,
  JoinQueryBuilder,
  JoinResult,
} from './join';
import { getQueryAs, resolveSubQueryCallbackV2 } from '../../common/utils';
import { preprocessJoinArg, processJoinArgs } from './processJoinArgs';
import { _queryNone, isQueryNone } from '../none';
import { ComputedColumns } from '../../modules/computed';
import { addColumnParserToQuery } from '../../columns';

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
  let joinKey: string | undefined;
  let shape: QueryColumns | undefined;
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
      return _queryNone(query) as never;
    }

    const q = first as Query;
    if (!isInternalJoin) {
      joinSubQuery = getIsJoinSubQuery(q);
    }

    joinKey = q.q.as || q.table;
    if (joinKey) {
      shape = getShapeFromSelect(q, joinSubQuery && !!q.q.select);
      parsers = q.q.parsers;
      batchParsers = q.q.batchParsers;
      computeds = q.q.computeds;

      if (joinSubQuery) {
        first = q.clone() as JoinFirstArg<Query>;
        (first as Query).shape = shape as ColumnsShapeBase;
      }
    }
  } else {
    joinKey = first as string;

    const relation = query.relations[joinKey];
    if (relation) {
      shape = getShapeFromSelect(relation.relationConfig.query as never);
      const r = relation.relationConfig.query as Query;
      parsers = r.q.parsers;
      batchParsers = r.q.batchParsers;
      computeds = r.q.computeds;
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
  );

  if (require && 'r' in joinArgs && isQueryNone(joinArgs.r)) {
    return _queryNone(query) as never;
  } else if (joinKey && 's' in joinArgs && joinArgs.s) {
    const j =
      'j' in joinArgs
        ? joinArgs.r ?? joinArgs.j
        : 'r' in joinArgs
        ? joinArgs.r
        : joinArgs.q;

    const jq = (j as unknown as PickQueryQ).q;
    if (jq.select || !jq.selectAllColumns) {
      const { q } = query as unknown as PickQueryQ;
      const shape = getShapeFromSelect(j, true);
      setObjectValueImmutable(q, 'joinedShapes', joinKey, shape);

      setObjectValueImmutable(q, 'joinedParsers', joinKey, jq.parsers);

      if (jq.batchParsers) {
        setObjectValueImmutable(
          jq,
          'joinedBatchParsers',
          joinKey,
          jq.batchParsers,
        );
      }

      setObjectValueImmutable(q, 'joinedComputeds', joinKey, jq.computeds);
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
  shape?: QueryColumns,
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
    result: QueryColumns;
  },
): Query => {
  let relation: RelationQueryBase | undefined;
  if (typeof arg === 'string') {
    relation = q.relations[arg];
    if (relation) {
      arg = _clone(relation.relationConfig.query);
    } else {
      const w = q.q.withShapes?.[arg];
      if (w) {
        const t = Object.create((q as unknown as Query).queryBuilder);
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
    result = relation.relationConfig.joinQuery(
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
export const _joinLateral = <
  T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
  Table extends string,
  Meta extends QueryMetaBase,
  Result extends QueryColumns,
  RequireJoined extends boolean,
>(
  self: T,
  type: string,
  arg: Query,
  as?: string,
  innerJoinLateral?: boolean,
): JoinLateralResult<T, Table, Meta, Result, RequireJoined> => {
  const q = self as unknown as Query;

  arg.q.joinTo = q;
  const joinedAs = getQueryAs(q);
  setObjectValueImmutable(arg.q, 'joinedShapes', joinedAs, q.q.shape);

  const joinKey = as || arg.q.as || arg.table;
  if (joinKey) {
    const shape = getShapeFromSelect(arg, true);
    setObjectValueImmutable(q.q, 'joinedShapes', joinKey, shape);

    setObjectValueImmutable(q.q, 'joinedParsers', joinKey, arg.q.parsers);

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
  setObjectValueImmutable(q.q, 'joinedComputeds', as, arg.q.computeds);

  pushQueryValueImmutable(q, 'join', {
    type: `${type} LATERAL`,
    args: { l: arg, a: as, i: innerJoinLateral },
  });

  return q as never;
};
