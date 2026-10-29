import { IsQuery, Query } from '../../query';
import { _queryWhere } from '../../basic-features/where/where';
import { _queryAll } from '../../query.utils';
import { QueryData } from '../../query-data';
import { RelationConfigBase } from '../../relations';
import { _applyRelationAliases, getQueryAs } from '../../basic-features/as/as';
import { markRelationConditions } from '../../basic-features/where/relation-conditions';

export const _chain = (
  fromQuery: IsQuery,
  toQuery: IsQuery,
  rel: RelationConfigBase,
) => {
  const self = fromQuery as Query;
  const toTable = toQuery as Query;

  // Combine aliases of the self query and the relation query before building conditions,
  // so the conditions refer to the final free alias of the query, not to its original name.
  _applyRelationAliases(self, toTable.q as QueryData);

  let query: Query;
  let q: QueryData;
  if (self.q.subQuery) {
    query = toTable;
    query.q.subQuery = 2;
    q = query.q as QueryData;

    // once there is a hasMany or hasAndBelongsToMany in the chain,
    // the following belongTo and hasOne must also return multiple
    if (
      // `select({ q => q.rel })`: on the first relation it doesn't matter if the parent has chainMultiple
      self.q.subQuery > 1 &&
      self.q.chainMultiple
    ) {
      q.returnType = q.returnsOne = q.limit = undefined;
    } else if (!((rel.query as Query).q as QueryData).returnsOne) {
      q.chainMultiple = true;
    }
  } else {
    // Relation query returns a single record in case of belongsTo or hasOne,
    // but when called as a query chain like `q.user.profile` it should return many.
    const prevAnd = toTable.q.and;
    query = _queryWhere(_queryAll(toTable), [
      {
        EXISTS: {
          q: rel.reverseJoin(self, toTable),
          // remember the alias of this query to resolve it to the current alias on SQL building,
          // it may be changed later by `as` or by a next query in the chain
          outerAs: getQueryAs(toTable),
        },
      },
    ]);
    markRelationConditions(query, prevAnd);

    q = query.q as QueryData;

    q.returnType = q.returnsOne = q.limit = undefined;
  }

  if (self.q.relChain) {
    q.relChain = [...self.q.relChain, { query: self, rel }];
  } else {
    q.relChain = [{ query: self, rel }];
  }

  q.joinedShapes = {
    [getQueryAs(self)]: self.q.selectShape,
    ...self.q.joinedShapes,
  };

  rel.modifyRelatedQuery?.(query)?.(self);

  return query;
};
