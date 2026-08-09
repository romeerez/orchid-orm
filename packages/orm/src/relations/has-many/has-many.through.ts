import { Query } from 'pqb';
import { RecordUnknown, RelationJoinQuery, _queryWhere } from 'pqb/internal';
import {
  getThroughRelation,
  getSourceRelation,
  joinHasThrough,
} from '../common/utils';
import { joinQueryChainHOF } from '../common/joinQueryChain';
import { RelationData } from '../relations';
import { HasMany } from './has-many';

interface ThroughRelationState {
  table: Query;
  query: Query;
  relation: HasMany;
  relationName: string;
  relPKeys: string[];
}

export const makeHasManyThroughMethod = ({
  table,
  query,
  relation,
  relationName,
  relPKeys,
}: ThroughRelationState): RelationData | undefined => {
  if (!('through' in relation.options)) {
    return undefined;
  }

  const { through, source, on } = relation.options;
  if (on) _queryWhere(query, [on]);

  const throughRelation = getThroughRelation(table, through);
  const sourceRelation = getSourceRelation(throughRelation, source);
  const sourceRelationQuery = (sourceRelation.query as Query).as(relationName);
  const sourceQuery = sourceRelation.joinQuery(
    sourceRelationQuery,
    throughRelation.query as never,
  );

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
    returns: 'many',
    queryRelated: (params: RecordUnknown) => {
      const throughQuery = table.queryRelated(through, params) as Query;

      return query.whereExists(
        throughQuery,
        whereExistsCallback as never,
      ) as never;
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
