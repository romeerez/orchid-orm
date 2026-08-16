import { Query } from 'pqb';
import {
  _queryCreate,
  _queryDelete,
  _queryFindBy,
  _queryUpdate,
  _querySelect,
  _queryWhereIn,
  _queryUpsert,
  _appendQuery,
  _prependWith,
  _hookSelectColumns,
  noop,
  RawSql,
  RecordUnknown,
  CreateSelf,
  UpdateSelf,
  UpdateData,
  UpsertData,
  UpsertThis,
  isQueryReturnsAll,
  emptyArray,
} from 'pqb/internal';
import {
  NestedUpdateOneItem,
  selectCteColumnsSql,
  setForeignKeysFromCte,
} from '../common/utils';

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  len: number;
  on?: RecordUnknown;
}

export type BelongsToNestedUpdate = (
  q: Query,
  update: RecordUnknown,
  params: NestedUpdateOneItem,
) => void;

export const nestedUpdate = ({
  query,
  primaryKeys,
  foreignKeys,
  len,
}: State) => {
  return ((self, update, params) => {
    if (params.create) {
      const createQuery = _querySelect(
        _queryCreate(
          query.clone() as unknown as CreateSelf,
          params.create,
        ) as unknown as Query,
        primaryKeys,
      );

      const asFn = setForeignKeysFromCte(update, primaryKeys, foreignKeys);

      _prependWith(self, asFn, createQuery);
    } else if (params.update) {
      let appendedAs: string | undefined;
      _hookSelectColumns(self, foreignKeys, (aliasedForeignKeys) => {
        selectIdsSql._sql = selectCteColumnsSql(
          appendedAs as string,
          aliasedForeignKeys,
        );
      });

      const selectIdsSql = new RawSql('');

      const updateQuery = _queryUpdate(
        _queryWhereIn(
          query.clone() as unknown as Query,
          true,
          primaryKeys,
          selectIdsSql,
        ) as unknown as UpdateSelf,
        params.update as never,
      ) as unknown as Query;

      // don't throw "not found" if it is not found for update
      updateQuery.q.returnType = 'value';

      _appendQuery(self, updateQuery, (as) => (appendedAs = as));
    } else if (params.upsert) {
      if (isQueryReturnsAll(self)) {
        throw new Error('`upsert` option is not allowed in a batch update');
      }

      const { relQuery } = relWithSelectIds(
        self,
        query,
        primaryKeys,
        foreignKeys,
      );

      const upsertQuery = _querySelect(
        _queryUpsert(
          relQuery,
          params.upsert as UpsertData<UpsertThis, UpdateData<UpdateSelf>>,
        ),
        primaryKeys,
      );
      upsertQuery.q.returnType = 'one';

      const asFn = setForeignKeysFromCte(update, primaryKeys, foreignKeys);

      _prependWith(self, asFn, upsertQuery);
    } else if (params.delete) {
      _hookSelectColumns(self, foreignKeys, noop);

      disconnect(update, foreignKeys);

      const { selectIdsSql, relQuery } = relWithSelectIds(
        self,
        query,
        primaryKeys,
        foreignKeys,
      );

      self.q.and = self.q.or = undefined;

      _queryWhereIn(self, true, foreignKeys, selectIdsSql);

      const deleteQuery = _queryDelete(relQuery);
      // don't throw "not found" if it is not found for delete
      deleteQuery.q.returnType = 'value';

      _appendQuery(self, deleteQuery, noop);
    } else if (params.disconnect) {
      disconnect(update, foreignKeys);
    } else if (params.set) {
      let loadPrimaryKeys: string[] | undefined;
      let loadForeignKeys: string[] | undefined;
      for (let i = 0; i < len; i++) {
        const primaryKey = primaryKeys[i];
        if (primaryKey in params.set) {
          update[foreignKeys[i]] =
            params.set[primaryKey as keyof typeof params.set];
        } else {
          (loadPrimaryKeys ??= []).push(primaryKey);
          (loadForeignKeys ??= []).push(foreignKeys[i]);
        }
      }
      if (loadPrimaryKeys) {
        const asFn = setForeignKeysFromCte(
          update,
          loadPrimaryKeys,
          loadForeignKeys as string[],
          true,
        );

        const findByQuery = _queryFindBy(
          query.select(...loadPrimaryKeys),
          params.set as never,
        );
        findByQuery.q.returnType = 'value';

        _prependWith(self, asFn, findByQuery);
      }
    }
  }) as BelongsToNestedUpdate;
};

const disconnect = (update: RecordUnknown, foreignKeys: string[]) => {
  for (const foreignKey of foreignKeys) {
    update[foreignKey] = null;
  }
};

const relWithSelectIds = (
  self: Query,
  rel: Query,
  primaryKeys: string[],
  foreignKeys: string[],
) => {
  const selectIdsQuery = makeSelectIdsQuery(self, foreignKeys);

  const selectIdsSql = new RawSql('');

  _prependWith(
    self,
    (as) => {
      selectIdsSql._sql = selectCteColumnsSql(as, foreignKeys);
    },
    selectIdsQuery,
  );

  return {
    selectIdsSql,
    relQuery: _queryWhereIn(rel.clone(), true, primaryKeys, selectIdsSql),
  };
};

const makeSelectIdsQuery = (self: Query, foreignKeys: string[]) => {
  const selectIdsQuery = self.baseQuery.clone();
  selectIdsQuery.q.distinct = emptyArray;
  selectIdsQuery.q.select = foreignKeys;
  selectIdsQuery.q.and = self.q.and;
  selectIdsQuery.q.or = self.q.or;
  return selectIdsQuery;
};
