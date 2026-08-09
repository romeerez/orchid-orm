import { Query } from 'pqb';
import { _queryWhere, RecordUnknown, RelationJoinQuery } from 'pqb/internal';
import {
  getThroughRelation,
  getSourceRelation,
  joinHasThrough,
} from '../common/utils';
import { RelationThroughOptions } from '../common/options';
import { joinQueryChainHOF } from '../common/joinQueryChain';
import { RelationData } from '../relations';

export const hasOneThrough = (
  table: Query,
  options: RelationThroughOptions & { required?: boolean },
  relationName: string,
  query: Query,
  relPKeys: string[],
): RelationData => {
  const { through, source, on } = options;
  if (on) _queryWhere(query, [on]);

  const throughRelation = getThroughRelation(table, through);
  const sourceRelation = getSourceRelation(throughRelation, source);
  const sourceRelationQuery = (sourceRelation.query as Query).as(relationName);
  const sourceQuery = sourceRelation.joinQuery(
    sourceRelationQuery,
    throughRelation.query as never,
  ) as Query;

  const whereExistsCallback = () => sourceQuery;

  const reverseJoin: RelationJoinQuery = (baseQuery, joiningQuery) => {
    return joinHasThrough(
      baseQuery as Query,
      baseQuery as Query,
      joiningQuery as Query,
      throughRelation,
      sourceRelation,
    );
  };

  return {
    returns: 'one',
    queryRelated: (params: RecordUnknown) => {
      const throughQuery = table.queryRelated(through, params) as Query;

      return query.whereExists(throughQuery, whereExistsCallback);
    },
    joinQuery: joinQueryChainHOF(
      relPKeys,
      reverseJoin,
      (joiningQuery, baseQuery) =>
        joinHasThrough(
          joiningQuery as Query,
          baseQuery as Query,
          joiningQuery as Query,
          throughRelation,
          sourceRelation,
        ),
    ),
    reverseJoin,
  };
};
