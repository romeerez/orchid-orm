import {
  PickQueryMetaResultRelationsWithDataReturnTypeShape,
  PickQueryQ,
  Query,
} from '../../query/query';
import {
  ColumnsParsers,
  ColumnsShapeBase,
  ColumnTypeBase,
  PickQueryTableMetaResult,
  QueryColumns,
  QueryMetaBase,
} from 'orchid-core';
import { getIsJoinSubQuery } from '../../sql/join';
import { getShapeFromSelect } from '../select';
import { RelationQueryBase } from '../../relations';
import { pushQueryValue, setQueryObjectValue } from '../../query/queryUtils';
import {
  JoinArgs,
  JoinFirstArg,
  JoinLateralCallback,
  JoinLateralResult,
  JoinResult,
} from './join';
import { getQueryAs, resolveSubQueryCallback } from '../../common/utils';
import { processJoinArgs } from './processJoinArgs';
import { _queryNone, isQueryNone } from '../none';

/**
 * Generic function to construct all JOIN queries.
 * Adds a shape of the joined table into `joinedShapes`.
 * Adds column parsers of the joined table into `joinedParsers`.
 * Adds join data into `join` of the query data.
 *
 * @param q - query object to join to
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
): JoinResult<T, R, RequireJoined, RequireMain> => {
  let joinKey: string | undefined;
  let shape: QueryColumns | undefined;
  let parsers: ColumnsParsers | undefined;
  let joinSubQuery = false;

  if (typeof first === 'function') {
    first = (
      first as unknown as (q: { [K: string]: Query }) => JoinFirstArg<Query>
    )(query.relations);
    (
      first as unknown as { joinQueryAfterCallback: unknown }
    ).joinQueryAfterCallback = (
      first as unknown as { joinQuery: unknown }
    ).joinQuery;
  }

  if (typeof first === 'object') {
    if (require && isQueryNone(first)) {
      return _queryNone(query) as JoinResult<T, R, RequireJoined, RequireMain>;
    }

    const q = first as Query;
    joinSubQuery = getIsJoinSubQuery(q);

    joinKey = q.q.as || q.table;
    if (joinKey) {
      shape = getShapeFromSelect(q, joinSubQuery);
      parsers = q.q.parsers;

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
      parsers = relation.relationConfig.query.q.parsers;
    } else {
      shape = (query as unknown as PickQueryQ).q.withShapes?.[joinKey];
      if (shape) {
        // clone the shape to mutate it below, in other cases the shape is newly created
        if (!require) shape = { ...shape };

        parsers = {} as ColumnsParsers;
        for (const key in shape) {
          const parser = (shape[key] as ColumnTypeBase).parseFn;
          if (parser) {
            parsers[key] = parser;
          }
        }
      }
    }
  }

  if (joinKey) {
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
      parsers,
    );
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

    if (j.q.select || !j.internal.columnsForSelectAll) {
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
        j.q.parsers,
      );
    }
  } else if (require && 'r' in joinArgs && isQueryNone(joinArgs.r)) {
    return _queryNone(query) as JoinResult<T, R, RequireJoined, RequireMain>;
  }

  return pushQueryValue(query as unknown as PickQueryQ, 'join', {
    type,
    args: joinArgs,
  }) as never;
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
 * @param cb - callback where you can use `on` to join by columns, select needed data from the joined table, add where conditions, etc.
 * @param as - alias of the joined table, it is set the join lateral happens when selecting a relation in `select`
 */
export const _joinLateral = <
  T extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
  Arg extends JoinFirstArg<T>,
  Table extends string,
  Meta extends QueryMetaBase,
  Result extends QueryColumns,
  RequireJoined extends boolean,
>(
  self: T,
  type: string,
  arg: Arg,
  cb: JoinLateralCallback<T, Arg, Table, Meta, Result>,
  as?: string,
): JoinLateralResult<T, Table, Meta, Result, RequireJoined> => {
  const q = self as unknown as Query;

  let relation: RelationQueryBase | undefined;
  if (typeof arg === 'string') {
    relation = q.relations[arg];
    if (relation) {
      arg = relation.relationConfig.query.clone() as unknown as Arg;
    } else {
      const shape = q.q.withShapes?.[arg];
      if (shape) {
        const t = Object.create((q as unknown as Query).queryBuilder);
        t.table = arg;
        t.shape = shape;
        t.q = {
          ...t.q,
          shape,
        };
        t.baseQuery = t;
        arg = t as Arg;
      }
    }
  }

  const query = arg as Query;
  query.q.joinTo = q;
  (query.q.joinedShapes ??= {})[getQueryAs(q)] = q.q.shape;
  let result = resolveSubQueryCallback(query, cb as never) as unknown as Query;

  if (relation) {
    result = relation.relationConfig.joinQuery(
      result as unknown as Query,
      q as unknown as Query,
    ) as unknown as Query;
  }

  const joinKey = as || result.q.as || result.table;
  if (joinKey) {
    const shape = getShapeFromSelect(result, true);
    setQueryObjectValue(q, 'joinedShapes', joinKey, shape);
    setQueryObjectValue(q, 'joinedParsers', joinKey, result.q.parsers);
  }

  return pushQueryValue(q, 'join', [
    type,
    result,
    as || getQueryAs(result),
  ]) as never;
};
