import { ColumnsParsers, Query } from '../query';
import { ColumnsShapeBase } from 'orchid-core';
import { getIsJoinSubQuery } from '../sql/join';
import { getShapeFromSelect } from './select';
import { Relation } from '../relations';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import {
  JoinArgs,
  JoinCallback,
  JoinFirstArg,
  JoinLateralCallback,
  JoinLateralResult,
  JoinResult,
} from './join';
import { ColumnsShape } from '../columns';
import { getQueryAs } from '../utils';
import { QueryBase } from '../queryBase';

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
  args: [arg: Arg, ...args: Args] | [arg: Arg, cb: JoinCallback<T, Arg>],
): JoinResult<T, Arg, RequireJoined, RequireMain> => {
  let joinKey: string | undefined;
  let shape: ColumnsShapeBase | undefined;
  let parsers: ColumnsParsers | undefined;
  let isSubQuery = false;

  if (typeof args[0] === 'function') {
    args[0] = (args[0] as (q: Record<string, Query>) => Arg)(
      q.relationsQueries,
    );
    (
      args[0] as unknown as { joinQueryAfterCallback: unknown }
    ).joinQueryAfterCallback = (
      args[0] as unknown as { joinQuery: unknown }
    ).joinQuery;
  }

  const first = args[0];

  if (typeof first === 'object') {
    isSubQuery = getIsJoinSubQuery(first.query, first.baseQuery.query);

    joinKey = first.query.as || first.table;
    if (joinKey) {
      shape = getShapeFromSelect(first, isSubQuery);
      parsers = first.query.parsers;

      if (isSubQuery) {
        args[0] = first.clone() as Arg;
        (args[0] as Query).shape = shape as ColumnsShape;
      }
    }
  } else {
    joinKey = first as string;

    const relation = (q.relations as Record<string, Relation>)[joinKey];
    if (relation) {
      shape = getShapeFromSelect(relation.query);
      parsers = relation.query.query.parsers;
    } else {
      shape = q.query.withShapes?.[joinKey];
      if (shape) {
        // clone the shape to mutate it below, in other cases the shape is newly created
        if (!require) shape = { ...shape };

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

  if (joinKey) {
    setQueryObjectValue(q, 'joinedShapes', joinKey, shape);
    setQueryObjectValue(q, 'joinedParsers', joinKey, parsers);
  }

  return pushQueryValue(q, 'join', {
    type,
    args,
    isSubQuery,
  }) as unknown as JoinResult<T, Arg, RequireJoined, RequireMain>;
};

export const _joinLateral = <
  T extends Query,
  Arg extends JoinFirstArg<T>,
  R extends QueryBase,
  RequireJoined extends boolean,
  RequireMain extends boolean,
>(
  q: T,
  type: string,
  arg: Arg,
  cb: JoinLateralCallback<T, Arg, R>,
  as?: string,
): JoinLateralResult<T, R, RequireJoined, RequireMain> => {
  let relation: Relation | undefined;
  if (typeof arg === 'string') {
    relation = (q.relations as Record<string, Relation>)[arg];
    if (relation) {
      arg = relation.query as Arg;
    } else {
      const shape = q.query.withShapes?.[arg];
      if (shape) {
        const t = Object.create(q.queryBuilder);
        t.table = arg;
        t.shape = shape;
        t.query = {
          ...t.query,
          shape,
        };
        t.baseQuery = t;
        arg = t as Arg;
      }
    }
  }

  const query = arg as Query;
  query.query.joinTo = q;
  (query.query.joinedShapes ??= {})[getQueryAs(q)] = q.query.shape;
  let result = cb(query as never);

  if (relation) {
    result = relation.joinQuery(q, result as unknown as Query) as unknown as R;
  }

  const joinKey = result.query.as || result.table;
  if (joinKey) {
    const shape = getShapeFromSelect(result, true);
    setQueryObjectValue(q, 'joinedShapes', joinKey, shape);
    setQueryObjectValue(q, 'joinedParsers', joinKey, result.query.parsers);
  }

  return pushQueryValue(q, 'join', [type, result, as]) as JoinLateralResult<
    T,
    R,
    RequireJoined,
    RequireMain
  >;
};
