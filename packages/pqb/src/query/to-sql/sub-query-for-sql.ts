import { PickQueryQ, Query } from '../query';
import { pushQueryArrayImmutable } from '../queryUtils';
import { QueryData, ToSQLQuery } from '../../sql';
import { IsQuery } from '../../core';
import { setPrepareSubQueryForSql } from '../../columns/operators';

export interface SubQueryForSql extends IsQuery, ToSQLQuery {
  __forSql: true;
}

export interface HasBeforeSet {
  beforeSet?: QueryData['beforeSet'];
}

export interface ArgWithBeforeSet {
  q: HasBeforeSet;
}

export interface PrepareSubQueryForSql {
  (mainQuery: ArgWithBeforeSet, subQuery: Query): SubQueryForSql;
}

export const prepareSubQueryForSql: PrepareSubQueryForSql = (
  mainQuery,
  subQuery,
) => {
  let beforeAction =
    subQuery.q.type === 'insert'
      ? subQuery.q.beforeCreate
      : subQuery.q.type === 'update'
      ? subQuery.q.beforeUpdate
      : subQuery.q.type === 'upsert'
      ? subQuery.q.upsertUpdate && subQuery.q.updateData
        ? subQuery.q.beforeUpdate && subQuery.q.beforeCreate
          ? [...subQuery.q.beforeUpdate, ...subQuery.q.beforeCreate]
          : subQuery.q.beforeUpdate || subQuery.q.beforeCreate
        : subQuery.q.beforeCreate
      : subQuery.q.type === 'delete'
      ? subQuery.q.beforeDelete
      : undefined;

  if (beforeAction) {
    const newSet = new Set(mainQuery.q.beforeSet);
    const filteredHooks = [];
    for (const hook of beforeAction) {
      if (!newSet.has(hook)) {
        newSet.add(hook);
        filteredHooks.push(hook);
      }
    }
    mainQuery.q.beforeSet = newSet;
    beforeAction = filteredHooks;

    if (beforeAction.length) {
      pushQueryArrayImmutable(
        mainQuery as PickQueryQ,
        'before',
        beforeAction.map((fn) => () => fn(subQuery)),
      );
    }
  }

  return subQuery as never;
};

setPrepareSubQueryForSql(prepareSubQueryForSql);
