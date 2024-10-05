import { IsQuery } from 'orchid-core';
import { RelationConfigBase } from '../relations';
import { Query } from '../query/query';
import { _queryWhere } from './where/where';
import { _queryResolveAlias } from './as';
import { getQueryAs } from '../common/utils';

import { _queryAll } from '../query/queryUtils';

export const _chain = (
  fromQuery: IsQuery,
  toQuery: IsQuery,
  rel: Pick<RelationConfigBase, 'reverseJoin' | 'modifyRelatedQuery'>,
) => {
  const self = fromQuery as Query;
  const toTable = toQuery as Query;

  let query: Query;
  if (self.q.subQuery) {
    query = toTable;
    query.q.subQuery = 2;
  } else {
    // Relation query returns a single record in case of belongsTo or hasOne,
    // but when called as a query chain like `q.user.profile` it should return many.
    query = _queryWhere(_queryAll(toTable), [
      {
        EXISTS: { q: rel.reverseJoin(self, toTable) },
      },
    ]);
  }

  if (self.q.relChain) {
    query.q.relChain = [...self.q.relChain, self];
    query.q.returnType = 'all';
  } else {
    query.q.relChain = [self];
  }

  const aliases = self.q.as
    ? { ...self.q.aliases }
    : { ...self.q.aliases, [self.table as string]: self.table as string };

  const relAliases = query.q.aliases!; // is always set for a relation
  for (const as in relAliases) {
    aliases[as] = _queryResolveAlias(aliases, as);
  }
  query.q.as = aliases[query.q.as!]; // `as` is always set for a relation;
  query.q.aliases = aliases;

  query.q.joinedShapes = {
    [getQueryAs(self)]: self.q.shape,
    ...self.q.joinedShapes,
  };

  rel.modifyRelatedQuery?.(query)?.(self);

  return query;
};
