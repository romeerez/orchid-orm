import { Query, QueryWithTable } from '../../query/query';
import { JoinArgs, JoinFirstArg, JoinQueryBuilder } from './join';
import {
  JoinedShapes,
  QueryDataJoinTo,
  SelectQueryData,
  JoinItemArgs,
  SimpleJoinItemNonSubQueryArgs,
} from '../../sql';
import { RelationJoinQuery } from '../../relations';
import { pushQueryArray } from '../../query/queryUtils';
import { getIsJoinSubQuery } from '../../sql/join';
import { QueryBase } from '../../query/queryBase';
import { returnArg } from 'orchid-core';

/**
 * Processes arguments of join {@link JoinArgs} into {@link JoinItemArgs} type for building sql.
 * Resolves join callback.
 * Detects if the join should be an implicit lateral join.
 *
 * @param joinTo - main query
 * @param first - first join argument
 * @param args - rest join arguments
 * @param joinSubQuery - callee should find out whether first argument should result in a sub-queried join
 */
export const processJoinArgs = (
  joinTo: Query,
  first: JoinFirstArg<never>,
  args: JoinArgs<Query, JoinFirstArg<Query>>,
  joinSubQuery: boolean,
): JoinItemArgs => {
  if (typeof first === 'string') {
    if (first in joinTo.relations) {
      const { query: toQuery, joinQuery } =
        joinTo.relations[first].relationConfig;

      const j = joinQuery(toQuery, joinTo);
      if (typeof args[0] === 'function') {
        const r = args[0](
          makeJoinQueryBuilder(j, j.q.joinedShapes, joinTo),
        ) as Query;
        return { j: j.merge(r), s: joinSubQuery || getIsJoinSubQuery(r), r };
      }

      return { j, s: joinSubQuery };
    } else if (typeof args[0] !== 'function') {
      return { w: first, a: args as SimpleJoinItemNonSubQueryArgs };
    } else {
      const joinToQ = joinTo.q;
      const shape = joinToQ.withShapes?.[first];
      if (!shape) {
        throw new Error('Cannot get shape of `with` statement');
      }

      const j = joinTo.queryBuilder.baseQuery.clone();
      j.table = first;
      j.q = {
        shape,
        adapter: joinToQ.adapter,
        handleResult: joinToQ.handleResult,
        returnType: 'all',
        logger: joinToQ.logger,
      } as SelectQueryData;
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

      return { w: first, r, s: joinSubQuery || getIsJoinSubQuery(r) };
    }
  }

  const args0 = args.length ? args[0] : returnArg;
  if (typeof args0 === 'function') {
    const q = first as QueryWithTable & {
      joinQueryAfterCallback?: RelationJoinQuery;
    };

    if (q.joinQueryAfterCallback) {
      let base = q.baseQuery;
      if (q.q.as) {
        base = base.as(q.q.as);
      }

      const { q: query } = q.joinQueryAfterCallback(base, joinTo);
      if (query.and) {
        pushQueryArray(q, 'and', query.and);
      }
      if (query.or) {
        pushQueryArray(q, 'or', query.or);
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
    q: first as QueryWithTable,
    a: args as SimpleJoinItemNonSubQueryArgs,
    s: joinSubQuery,
  };
};

/**
 * Creates {@link JoinQueryBuilder} argument for join callback.
 *
 * @param joinedQuery - the query that is joining
 * @param joinedShapes
 * @param joinTo
 */
const makeJoinQueryBuilder = (
  joinedQuery: QueryBase,
  joinedShapes: JoinedShapes | undefined,
  joinTo: QueryDataJoinTo,
): JoinQueryBuilder<Query, Query> => {
  const q = joinedQuery.baseQuery.clone();
  q.baseQuery = q as unknown as Query;
  q.q.as = joinedQuery.q.as;
  q.q.joinedShapes = joinedShapes;
  q.q.joinTo = joinTo;
  return q as never;
};
