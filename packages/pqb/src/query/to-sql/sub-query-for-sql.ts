import { PickQueryQ } from '../query';
import { pushQueryArrayImmutable } from '../queryUtils';
import { QueryBeforeHookInternal, QueryData } from '../../sql/data';
import { ToSQLQuery } from '../../sql/to-sql';
import { IsQuery, pushQueryValueImmutable } from '../../core/query/query';
import { setPrepareSubQueryForSql } from '../../columns/operators';
import { setRawSqlPrepareSubQueryForSql } from '../../sql/rawSql';

export interface SubQueryForSql extends IsQuery, ToSQLQuery {
  __forSql: true;
}

export interface HasBeforeAndBeforeSet {
  before?: QueryBeforeHookInternal[];
  beforeSet?: QueryData['beforeSet'];
}

export interface ArgWithBeforeAndBeforeSet {
  q: HasBeforeAndBeforeSet;
}

export interface PrepareSubQueryForSqlArg extends PickQueryQ {
  dynamicBefore?: boolean;
}

export interface PrepareSubQueryForSql {
  (
    mainQuery: ArgWithBeforeAndBeforeSet,
    subQuery: PrepareSubQueryForSqlArg,
  ): SubQueryForSql;
}

export const prepareSubQueryForSql: PrepareSubQueryForSql = (
  mainQuery,
  subQuery,
) => {
  if (subQuery.dynamicBefore) {
    pushQueryValueImmutable(mainQuery as never, 'dynamicBefore', subQuery.q);
    return subQuery as never;
  }

  let beforeAction = subQuery.q.type
    ? subQuery.q.type === 'insert'
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
      : undefined
    : undefined;

  const { beforeSet } = subQuery.q;
  beforeAction =
    beforeAction && beforeSet
      ? [...beforeAction, ...beforeSet]
      : beforeSet
      ? [...beforeSet]
      : beforeAction;

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
        beforeAction.map((fn) => () => fn(subQuery as never)),
      );
    }
  }

  return subQuery as never;
};

setPrepareSubQueryForSql(prepareSubQueryForSql);
setRawSqlPrepareSubQueryForSql(prepareSubQueryForSql);
