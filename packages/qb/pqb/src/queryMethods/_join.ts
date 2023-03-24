import { ColumnsParsers, Query } from '../query';
import { ColumnsShapeBase } from 'orchid-core';
import { getIsJoinSubQuery } from '../sql/join';
import { getShapeFromSelect } from './select';
import { Relation } from '../relations';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import { JoinArgs, JoinCallback, JoinFirstArg, JoinResult } from './join';

export const _join = <
  T extends Query,
  Arg extends JoinFirstArg<T>,
  Args extends JoinArgs<T, Arg>,
>(
  q: T,
  type: string,
  args: [arg: Arg, ...args: Args] | [arg: Arg, cb: JoinCallback<T, Arg>],
): JoinResult<T, Arg> => {
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
  }) as unknown as JoinResult<T, Arg>;
};
