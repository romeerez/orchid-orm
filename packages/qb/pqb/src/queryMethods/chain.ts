import { IsQuery } from 'orchid-core';
import { RelationConfigBase } from '../relations';
import { Query } from '../query/query';
import { _queryWhere } from './where/where';
import { _queryResolveAlias } from './as';
import { getQueryAs } from '../common/utils';
import { _queryAll } from '../query/queryUtils';
import { SelectQueryData } from 'pqb';

export const _chain = (
  fromQuery: IsQuery,
  toQuery: IsQuery,
  rel: RelationConfigBase,
) => {
  const self = fromQuery as Query;
  const toTable = toQuery as Query;

  let query: Query;
  let q: SelectQueryData;
  if (self.q.subQuery) {
    query = toTable;
    query.q.subQuery = 2;
    q = query.q as SelectQueryData;

    // once there is a hasMany or hasAndBelongsToMany in the chain,
    // the following belongTo and hasOne must also return multiple
    if (
      // `select({ q => q.rel })`: on the first relation it doesn't matter if the parent has chainMultiple
      self.q.subQuery > 1 &&
      self.q.chainMultiple
    ) {
      q.returnType = q.returnsOne = q.limit = undefined;
    } else if (!((rel.query as Query).q as SelectQueryData).returnsOne) {
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

    q = query.q as SelectQueryData;

    q.returnType = q.returnsOne = q.limit = undefined;
  }

  if (self.q.relChain) {
    q.relChain = [...self.q.relChain, { query: self, rel }];
  } else {
    q.relChain = [{ query: self, rel }];
  }

  const aliases = self.q.as
    ? { ...self.q.aliases }
    : { ...self.q.aliases, [self.table as string]: self.table as string };

  const relAliases = q.aliases!; // is always set for a relation
  for (const as in relAliases) {
    aliases[as] = _queryResolveAlias(aliases, as);
  }
  q.as = aliases[q.as!]; // `as` is always set for a relation;
  q.aliases = aliases;

  q.joinedShapes = {
    [getQueryAs(self)]: self.q.shape,
    ...self.q.joinedShapes,
  };

  rel.modifyRelatedQuery?.(query)?.(self);

  return query;
};
