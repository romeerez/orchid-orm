import { Query } from '../../query';
import { JoinArgs, JoinCallback, JoinFirstArg } from './join';
import { Column } from '../../../columns/column';
import { PickQueryRelations } from '../../pick-query-types';
import { JoinItemArgs } from './join.sql';
/**
 * Processes arguments of join {@link JoinArgs} into {@link JoinItemArgs} type for building sql.
 * Resolves join callback.
 * Detects if the join should be an implicit lateral join.
 *
 * @param joinTo - main query
 * @param joinKey - joining as
 * @param first - first join argument
 * @param args - rest join arguments
 * @param joinSubQuery - callee should find out whether first argument should result in a sub-queried join
 * @param shape - aliased shape of a joined table, the one from `getShapeFromSelect`
 * @param whereExists - the lateral expression should be never wrapped into a sub query for `whereExist`
 * @param forbidLateral - LATERAL with a query that references the main table is not available in `updateFrom`
 */
export declare const processJoinArgs: (joinTo: Query, first: JoinFirstArg<never>, args: [JoinCallback<Query, JoinFirstArg<Query>>] | JoinArgs<Query, JoinFirstArg<Query>>, joinSubQuery: boolean, shape: Column.QueryColumns | undefined, whereExists?: boolean, joinKey?: string, forbidLateral?: boolean) => JoinItemArgs;
export declare const preprocessJoinArg: (q: PickQueryRelations, arg: JoinFirstArg<never>) => string | number | symbol | import("../../pick-query-types").PickQueryResultAs | import("../../internal-features/sub-query/sub-query-for-sql").SubQueryForSql;
