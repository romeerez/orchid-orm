import { PickQueryQ, Query } from '../../query/query';
import { JoinArgs, JoinFirstArg, JoinQueryBuilder } from './join';
import {
  JoinedShapes,
  QueryDataJoinTo,
  JoinItemArgs,
  SimpleJoinItemNonSubQueryArgs,
  QueryData,
} from '../../sql';
import { getIsJoinSubQuery } from '../../sql/join';
import {
  IsQuery,
  PickQueryRelationQueries,
  PickQueryRelations,
  RelationJoinQuery,
  returnArg,
} from 'orchid-core';
import { pushQueryArrayImmutable } from '../../query/queryUtils';

/**
 * Processes arguments of join {@link JoinArgs} into {@link JoinItemArgs} type for building sql.
 * Resolves join callback.
 * Detects if the join should be an implicit lateral join.
 *
 * @param joinTo - main query
 * @param first - first join argument
 * @param args - rest join arguments
 * @param joinSubQuery - callee should find out whether first argument should result in a sub-queried join
 * @param whereExists - the lateral expression should be never wrapped into a sub query for `whereExist`
 */
export const processJoinArgs = (
  joinTo: Query,
  first: JoinFirstArg<never>,
  args: JoinArgs<Query, JoinFirstArg<Query>>,
  joinSubQuery: boolean,
  whereExists?: boolean,
): JoinItemArgs => {
  if (typeof first === 'string') {
    if (first in joinTo.relations) {
      const { query: toQuery, joinQuery } = joinTo.relations[first];

      const j = joinQuery(toQuery as never, joinTo) as Query;
      if (typeof args[0] === 'function') {
        const r = args[0](
          makeJoinQueryBuilder(j, j.q.joinedShapes, joinTo),
        ) as Query;
        return {
          j: j.merge(r),
          s: whereExists ? false : joinSubQuery || getIsJoinSubQuery(r),
          r,
        };
      }

      return { j, s: joinSubQuery };
    } else if (typeof args[0] !== 'function') {
      return { w: first, a: args as SimpleJoinItemNonSubQueryArgs };
    } else {
      const joinToQ = joinTo.q;
      const w = joinToQ.withShapes?.[first];
      if (!w) {
        throw new Error('Cannot find a `with` statement');
      }

      const j = joinTo.qb.baseQuery.clone();
      j.table = first;
      j.q = {
        shape: w.shape,
        computeds: w.computeds,
        adapter: joinToQ.adapter,
        handleResult: joinToQ.handleResult,
        returnType: 'all',
        logger: joinToQ.logger,
      } as QueryData;
      j.baseQuery = j as Query;

      const joinedShapes = {
        ...joinToQ.joinedShapes,
        [(joinToQ.as || joinTo.table) as string]: joinTo.shape,
      } as JoinedShapes;

      const r = args[0](
        makeJoinQueryBuilder(
          j,
          j.q.joinedShapes
            ? {
                ...j.q.joinedShapes,
                ...joinedShapes,
              }
            : joinedShapes,
          joinTo,
        ),
      ) as Query;

      return {
        w: first,
        r,
        s: whereExists ? false : joinSubQuery || getIsJoinSubQuery(r),
      };
    }
  }

  const args0 = args.length ? args[0] : returnArg;
  if (typeof args0 === 'function') {
    const q = first as Query & {
      joinQueryAfterCallback?: RelationJoinQuery;
    };

    if (q.joinQueryAfterCallback) {
      let base = q.baseQuery;
      if (q.q.as) {
        base = base.as(q.q.as);
      }

      const { q: query } = q.joinQueryAfterCallback(
        base,
        joinTo,
      ) as unknown as PickQueryQ;
      if (query.and) {
        pushQueryArrayImmutable(q, 'and', query.and);
      }
      if (query.or) {
        pushQueryArrayImmutable(q, 'or', query.or);
      }
      if (query.scopes) {
        q.q.scopes = { ...q.q.scopes, ...query.scopes };
      }
    }

    const joinedShapes = {
      ...joinTo.q.joinedShapes,
      [(joinTo.q.as || joinTo.table) as string]: joinTo.shape,
    } as JoinedShapes;

    const r = args0(
      makeJoinQueryBuilder(
        q,
        q.q.joinedShapes
          ? {
              ...q.q.joinedShapes,
              ...joinedShapes,
            }
          : joinedShapes,
        joinTo,
      ),
    ) as Query;

    joinSubQuery ||= getIsJoinSubQuery(r);
    return { q: joinSubQuery ? q.merge(r) : q, r, s: joinSubQuery };
  }

  return {
    q: first,
    a: args,
    s: joinSubQuery,
  } as never;
};

export const preprocessJoinArg = (
  q: PickQueryRelations,
  arg: JoinFirstArg<never>,
) => {
  if (typeof arg !== 'function') return arg;

  arg = arg(
    (q as unknown as PickQueryRelationQueries).relationQueries as never,
  );

  (
    arg as unknown as { joinQueryAfterCallback: unknown }
  ).joinQueryAfterCallback = (
    arg as unknown as { joinQuery: unknown }
  ).joinQuery;

  return arg;
};

/**
 * Creates {@link JoinQueryBuilder} argument for join callback.
 *
 * @param joinedQuery - the query that is joining
 * @param joinedShapes
 * @param joinTo
 */
const makeJoinQueryBuilder = (
  joinedQuery: IsQuery,
  joinedShapes: JoinedShapes | undefined,
  joinTo: QueryDataJoinTo,
): JoinQueryBuilder<Query, Query> => {
  const q = (joinedQuery as Query).baseQuery.clone();
  q.baseQuery = q;
  q.q.as = (joinedQuery as Query).q.as;
  q.q.joinedShapes = joinedShapes;
  q.q.joinTo = joinTo;
  return q as never;
};
