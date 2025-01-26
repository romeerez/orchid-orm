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
} from 'orchid-core';
import { getIsJoinSubQuery } from '../../sql/join';
import { getShapeFromSelect } from '../select';
import { RelationQueryBase } from '../../relations';
import {
  _clone,
  pushQueryValue,
  setQueryObjectValue,
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
 * Adds a shape of the joined table into `joinedShapes`.
 * Adds column parsers of the joined table into `joinedParsers`.
 * Adds join data into `join` of the query data.
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
  first: JoinFirstArg<never>,
  args: JoinArgs<Query, JoinFirstArg<Query>>,
): JoinResult<T, R, RequireMain> => {
  let joinKey: string | undefined;
  let shape: QueryColumns | undefined;
  let parsers: ColumnsParsers | undefined;
  let batchParsers: BatchParsers | undefined;
  let computeds: ComputedColumns | undefined;
  let joinSubQuery = false;

  first = preprocessJoinArg(query, first);

  if (typeof first === 'object') {
    if (require && isQueryNone(first)) {
      return _queryNone(query) as never;
    }

    const q = first as Query;
    joinSubQuery = getIsJoinSubQuery(q);

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
      shape = getShapeFromSelect(relation.relationConfig.query);
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

  if (joinKey && 's' in joinArgs && joinArgs.s) {
    const j =
      'j' in joinArgs
        ? joinArgs.r ?? joinArgs.j
        : 'r' in joinArgs
        ? joinArgs.r
        : joinArgs.q;

    if (
      (j as unknown as PickQueryQ).q.select ||
      !(j as unknown as PickQueryQ).q.selectAllColumns
    ) {
      const shape = getShapeFromSelect(j, true);
      setQueryObjectValue(
        query as unknown as PickQueryQ,
        'joinedShapes',
        joinKey,
        shape,
      );

      setQueryObjectValue(
        query as unknown as PickQueryQ,
        'joinedParsers',
        joinKey,
        (j as unknown as PickQueryQ).q.parsers,
      );

      if ((j as unknown as PickQueryQ).q.batchParsers) {
        ((query as unknown as PickQueryQ).q.joinedBatchParsers ??= {})[
          joinKey
        ] = (j as unknown as PickQueryQ).q.batchParsers as BatchParsers;
      }

      setQueryObjectValue(
        query as unknown as PickQueryQ,
        'joinedComputeds',
        joinKey,
        (j as unknown as PickQueryQ).q.computeds,
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
  } else if (require && 'r' in joinArgs && isQueryNone(joinArgs.r)) {
    return _queryNone(query) as never;
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

  const q = pushQueryValue(query as unknown as PickQueryQ, 'join', {
    type,
    args: joinArgs,
  });

  if ((query as unknown as PickQueryQ).q.type === 'delete') {
    throwIfJoinLateral(q, (query as unknown as PickQueryQ).q.type as string);
  }

  return q as never;
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

  setQueryObjectValue(query as PickQueryQ, 'joinedShapes', joinKey, shape);

  setQueryObjectValue(query as PickQueryQ, 'joinedParsers', joinKey, parsers);

  if (batchParsers) {
    ((query as PickQueryQ).q.joinedBatchParsers ??= {})[joinKey] = batchParsers;
  }

  setQueryObjectValue(
    query as PickQueryQ,
    'joinedComputeds',
    joinKey,
    computeds,
  );
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
): JoinLateralResult<T, Table, Meta, Result, RequireJoined> => {
  const q = self as unknown as Query;

  arg.q.joinTo = q;
  const joinedAs = getQueryAs(q);
  (arg.q.joinedShapes ??= {})[joinedAs] = q.q.shape;

  const joinKey = as || arg.q.as || arg.table;
  if (joinKey) {
    const shape = getShapeFromSelect(arg, true);
    setQueryObjectValue(q, 'joinedShapes', joinKey, shape);
    setQueryObjectValue(q, 'joinedParsers', joinKey, arg.q.parsers);
    if (arg.q.batchParsers) {
      (q.q.joinedBatchParsers ??= {})[joinKey] = arg.q.batchParsers;
    }
  }

  as ||= getQueryAs(arg);
  (q.q.joinedComputeds ??= {})[as] = arg.q.computeds as ComputedColumns;

  return pushQueryValue(q, 'join', [type, arg, as]) as never;
};
