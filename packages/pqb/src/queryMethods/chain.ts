import {
  _applyRelationAliases,
  IsQuery,
  RelationConfigBase,
} from 'orchid-core';
import { Query } from '../query/query';
import { _queryWhere } from './where/where';
import { getQueryAs } from '../common/utils';
import { _queryAll } from '../query/queryUtils';
import { QueryData } from '../sql/data';

export const _chain = (
  fromQuery: IsQuery,
  toQuery: IsQuery,
  rel: RelationConfigBase,
) => {
  const self = fromQuery as Query;
  const toTable = toQuery as Query;

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
    query = _queryWhere(_queryAll(toTable), [
      {
        EXISTS: { q: rel.reverseJoin(self, toTable) },
      },
    ]);

    q = query.q as QueryData;

    q.returnType = q.returnsOne = q.limit = undefined;
  }

  if (self.q.relChain) {
    q.relChain = [...self.q.relChain, { query: self, rel }];
  } else {
    q.relChain = [{ query: self, rel }];
  }

  _applyRelationAliases(self, q);

  q.joinedShapes = {
    [getQueryAs(self)]: self.q.shape,
    ...self.q.joinedShapes,
  };

  rel.modifyRelatedQuery?.(query)?.(self);

  return query;
};
