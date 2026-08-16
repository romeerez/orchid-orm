import {
  _appendQuery,
  _clone,
  _queryDelete,
  _queryInsert,
  _queryUpdate,
  _queryUpsert,
  _queryWhere,
  CreateSelf,
  noop,
  RecordUnknown,
  UpdateSelf,
} from 'pqb/internal';
import { Query } from 'pqb';
import {
  makeNestedUpdateRelationIds,
  makeNestedUpdateUpsertData,
  NestedUpdateOneItem,
  throwIfQueryReturnsAllForNestedUpdate,
} from '../common/utils';
import { State } from './has-one';

export const hasOneUpdate = (
  key: string,
  state: State,
  self: UpdateSelf,
  set: RecordUnknown,
): void => {
  const querySelf = self as unknown as Query;
  const params = set[key] as NestedUpdateOneItem;
  throwIfQueryReturnsAllForNestedUpdate(querySelf, params);

  const { primaryKeys, foreignKeys, query: relQuery } = state;
  if (
    params.create ||
    params.update ||
    params.upsert ||
    params.disconnect ||
    params.set ||
    params.delete
  ) {
    const ids = makeNestedUpdateRelationIds(
      querySelf,
      relQuery,
      primaryKeys,
      foreignKeys,
    );

    const setNulls: RecordUnknown = {};
    for (const foreignKey of foreignKeys) {
      setNulls[foreignKey] = null;
    }

    const nullifyOrDeleteQuery = (params.update
      ? _queryUpdate(
          ids.existingRelQuery as unknown as UpdateSelf,
          params.update as never,
        )
      : params.upsert
        ? _queryUpsert(
            ids.existingRelQuery,
            makeNestedUpdateUpsertData(params.upsert, ids.setIds),
          )
        : params.delete
          ? _queryDelete(ids.existingRelQuery)
          : _queryUpdate(
              ids.existingRelQuery as unknown as UpdateSelf,
              setNulls as never,
            )) as unknown as Query;

    nullifyOrDeleteQuery.q.returnType = 'void';

    _appendQuery(querySelf, nullifyOrDeleteQuery, ids.setAppendedAs);

    if (params.create) {
      const createQuery = _queryInsert(
        _clone(relQuery) as unknown as CreateSelf,
        {
          ...params.create,
          ...ids.setIds,
        },
      ) as unknown as Query;

      _appendQuery(querySelf, createQuery, noop);
    } else if (params.set) {
      const setQuery = _queryUpdate(
        _queryWhere(_clone(relQuery), [
          params.set as never,
        ]) as unknown as UpdateSelf,
        ids.setIds as never,
      ) as unknown as Query;
      setQuery.q.returnType = 'void';

      _appendQuery(querySelf, setQuery, noop);
    }
  }
};
