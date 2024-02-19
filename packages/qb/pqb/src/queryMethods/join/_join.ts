import { Query } from '../../query/query';
import {
  ColumnsParsers,
  ColumnsShapeBase,
  ColumnTypeBase,
  QueryColumns,
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
import { getQueryAs } from '../../common/utils';
import { QueryBase } from '../../query/queryBase';

/**
 * Generic function to construct all JOIN queries.
 * Adds a shape of the joined table into `joinedShapes`.
 * Adds column parsers of the joined table into `joinedParsers`.
 * Adds join data into `join` of the query data.
 *
 * @param q - query object to join to
 * @param require - true for INNER kind of JOIN
 * @param type - SQL of the JOIN kind: JOIN, LEFT JOIN, RIGHT JOIN, etc.
 * @param args - join arguments to join a query, or `with` table, or a callback returning a query, etc.
 */
export const _join = <
  T extends Query,
  Arg extends JoinFirstArg<T>,
  RequireJoined extends boolean,
  RequireMain extends boolean,
  Args extends JoinArgs<T, Arg>,
>(
  q: T,
  require: RequireJoined,
  type: string,
  first: Arg,
  args: Args,
): JoinResult<T, Arg, RequireJoined, RequireMain> => {
  let joinKey: string | undefined;
  let shape: QueryColumns | undefined;
  let parsers: ColumnsParsers | undefined;
  let isSubQuery = false;

  if (typeof first === 'function') {
    first = (first as (q: Record<string, Query>) => Arg)(q.relations);
    (
      first as unknown as { joinQueryAfterCallback: unknown }
    ).joinQueryAfterCallback = (
      first as unknown as { joinQuery: unknown }
    ).joinQuery;
  }

  if (typeof first === 'object') {
    isSubQuery = getIsJoinSubQuery(first.q, first.baseQuery.q);

    joinKey = first.q.as || first.table;
    if (joinKey) {
      shape = getShapeFromSelect(first, isSubQuery);
      parsers = first.q.parsers;

      if (isSubQuery) {
        first = first.clone() as Arg;
        (first as Query).shape = shape as ColumnsShapeBase;
      }
    }
  } else {
    joinKey = first as string;

    const relation = q.relations[joinKey];
    if (relation) {
      shape = getShapeFromSelect(relation.relationConfig.query);
      parsers = relation.relationConfig.query.q.parsers;
    } else {
      shape = q.q.withShapes?.[joinKey];
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
    setQueryObjectValue(q, 'joinedShapes', joinKey, shape);
    setQueryObjectValue(q, 'joinedParsers', joinKey, parsers);
  }

  return pushQueryValue(q, 'join', {
    type,
    first,
    args,
    isSubQuery,
  }) as unknown as JoinResult<T, Arg, RequireJoined, RequireMain>;
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
  T extends QueryBase,
  Arg extends JoinFirstArg<T>,
  R extends QueryBase,
  RequireJoined extends boolean,
>(
  self: T,
  type: string,
  arg: Arg,
  cb: JoinLateralCallback<T, Arg, R>,
  as?: string,
): JoinLateralResult<T, R, RequireJoined> => {
  const q = self as unknown as Query;

  let relation: RelationQueryBase | undefined;
  if (typeof arg === 'string') {
    relation = q.relations[arg];
    if (relation) {
      arg = relation.relationConfig.query as Arg;
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
  let result = cb(query as never);

  if (relation) {
    result = relation.relationConfig.joinQuery(
      result as unknown as Query,
      q as unknown as Query,
    ) as unknown as R;
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
  ]) as JoinLateralResult<T, R, RequireJoined>;
};
