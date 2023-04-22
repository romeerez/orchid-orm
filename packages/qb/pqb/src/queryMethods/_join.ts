import { ColumnsParsers, Query } from '../query';
import { ColumnsShapeBase } from 'orchid-core';
import { getIsJoinSubQuery } from '../sql/join';
import { getShapeFromSelect } from './select';
import { Relation } from '../relations';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import { JoinArgs, JoinCallback, JoinFirstArg, JoinResult } from './join';
import { ColumnsShape } from '../columns';

export const _join = <
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
  const first = args[0];
  let joinKey: string | undefined;
  let shape: ColumnsShapeBase | undefined;
  let parsers: ColumnsParsers | undefined;
  let isSubQuery = false;

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
    if (!require && shape) {
      for (const key in shape) {
        if (!shape[key].data.isNullable) {
          shape[key] = shape[key].nullable();
        }
      }
    }

    setQueryObjectValue(q, 'joinedShapes', joinKey, shape);
    setQueryObjectValue(q, 'joinedParsers', joinKey, parsers);
  }

  return pushQueryValue(q, 'join', {
    type,
    args,
    isSubQuery,
  }) as unknown as JoinResult<T, RequireJoined, RequireMain, Arg>;
};
