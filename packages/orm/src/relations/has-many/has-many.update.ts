import { Query } from 'pqb';
import {
  objectHasValues,
  RecordUnknown,
  toArray,
  _appendQuery,
  _hookSelectColumns,
  _queryDelete,
  _queryInsertMany,
  _querySelect,
  _queryUpdate,
  _queryUpsert,
  CreateSelf,
  RawSql,
  UpdateSelf,
  ColumnsShape,
  getPrimaryKeys,
  MaybeArray,
} from 'pqb/internal';
import {
  makeNestedUpdateRelationIds,
  makeNestedUpdateUpsertData,
  NestedUpdateManyItems,
  NestedUpdateManyUpsert,
  throwIfQueryReturnsAllForNestedUpdate,
} from '../common/utils';

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
}

type NestedUpdateManyParams = Omit<NestedUpdateManyItems, 'upsert'> & {
  upsert?: MaybeArray<NestedUpdateManyUpsert>;
};

export const hasManyUpdate = (
  key: string,
  state: State,
  self: UpdateSelf,
  set: RecordUnknown,
) => {
  const querySelf = self as unknown as Query;
  const params = set[key] as NestedUpdateManyParams;
  throwIfQueryReturnsAllForNestedUpdate(querySelf, params);
  const makeRelationIds = () =>
    makeNestedUpdateRelationIds(
      querySelf,
      state.query,
      state.primaryKeys,
      state.foreignKeys,
    );

  const hasDisconnect =
    !!params.disconnect &&
    (!Array.isArray(params.disconnect) || params.disconnect.length > 0);

  const hasSetConditions =
    params.set &&
    (Array.isArray(params.set)
      ? params.set.length
      : objectHasValues(params.set));

  if (hasDisconnect || params.set !== undefined) {
    const { primaryKeys, foreignKeys, query: relQuery } = state;
    const relatedAs = relQuery.q.as || relQuery.table;
    const joinSql = new RawSql('');
    let mainAs: string | undefined;
    let aliasedPrimaryKeys: string[] | undefined;
    const setNulls = Object.fromEntries(
      foreignKeys.map((foreignKey) => [foreignKey, null]),
    );
    let queryToDisconnect = relQuery.clone().updateFrom('');
    if (hasDisconnect && params.set === undefined) {
      queryToDisconnect = queryToDisconnect.where({
        OR: toArray(params.disconnect),
      }) as never;
    }

    // Do not nullify records that are going to be set, because the column may
    // be non-nullable.
    if (params.set && hasSetConditions) {
      queryToDisconnect = queryToDisconnect.whereNot(
        Array.isArray(params.set) ? { OR: params.set } : params.set,
      ) as never;
    }

    const disconnectQuery = _queryUpdate(
      queryToDisconnect.whereSql(joinSql) as unknown as UpdateSelf,
      setNulls as never,
    ) as unknown as Query;

    disconnectQuery.q.returnType = 'void';

    const setJoinSql = () => {
      if (mainAs && aliasedPrimaryKeys) {
        joinSql._sql = foreignKeys
          .map(
            (foreignKey, i) =>
              `"${relatedAs}"."${(relQuery.shape as ColumnsShape)[foreignKey].data.name || foreignKey}" = "${mainAs}"."${aliasedPrimaryKeys![i]}"`,
          )
          .join(' AND ');
      }
    };

    _hookSelectColumns(querySelf, primaryKeys, (aliased) => {
      aliasedPrimaryKeys = aliased;
      setJoinSql();
    });

    _appendQuery(querySelf, disconnectQuery, (as) => {
      mainAs = as;
      (disconnectQuery.q.updateFrom as { w: string }).w = as;
      disconnectQuery.q.joinedShapes = {
        ...disconnectQuery.q.joinedShapes,
        [as]: {},
      };
      setJoinSql();
    });
  }

  const hasAdd =
    params.add && (!Array.isArray(params.add) || params.add.length > 0);
  const updates = params.update ? toArray(params.update) : [];
  const hasUpdate = updates.some(
    (update) => !Array.isArray(update.where) || update.where.length,
  );
  const relatedIdsAs =
    hasUpdate && (hasAdd || hasSetConditions) ? ([] as RawSql[]) : undefined;
  const sourceCondition = relatedIdsAs ? new RawSql('') : undefined;
  const updateFrom = relatedIdsAs ? new RawSql('') : undefined;
  const upsertRelatedIdsAs = params.upsert ? ([] as RawSql[]) : undefined;
  const upsertSourceCondition = upsertRelatedIdsAs ? new RawSql('') : undefined;
  const upsertUpdateFrom = upsertRelatedIdsAs ? new RawSql('') : undefined;
  let appendRelatedQuery: (() => void) | undefined;

  const setSourceCondition = (
    relatedIdsAs: RawSql[] | undefined,
    sourceCondition: RawSql | undefined,
    updateFrom: RawSql | undefined,
    relatedPrimaryKeys: string[],
  ) => {
    if (!relatedIdsAs) return;

    const relatedAs = state.query.q.as || state.query.table;
    const sourceAs = '"relatedIds"';
    sourceCondition!._sql = relatedPrimaryKeys
      .map(
        (primaryKey) =>
          `"${relatedAs}"."${(state.query.shape as ColumnsShape)[primaryKey].data.name || primaryKey}" = ${sourceAs}."${primaryKey}"`,
      )
      .join(' AND ');
    const columns = relatedPrimaryKeys.map((key) => `"${key}"`).join(', ');
    updateFrom!._sql = `(${relatedIdsAs
      .map((as) => `SELECT ${columns} FROM ${as._sql}`)
      .join(' UNION ALL ')}) AS ${sourceAs}`;
  };

  if (hasAdd || hasSetConditions) {
    const { query: relQuery } = state;
    const relatedWheres = [
      ...(hasAdd ? toArray(params.add) : []),
      ...(hasSetConditions ? toArray(params.set) : []),
    ];
    if (relatedIdsAs || upsertRelatedIdsAs) {
      const relatedPrimaryKeys = getPrimaryKeys(relQuery);
      const relatedQuery = _querySelect(
        relQuery.clone().where({ OR: relatedWheres }),
        relatedPrimaryKeys as never,
      ) as Query;
      relatedQuery.q.returnType = 'void';

      _appendQuery(
        querySelf,
        relatedQuery,
        () => {},
        (as) => {
          if (relatedIdsAs) {
            relatedIdsAs.push(new RawSql(`"${as}"`));
            setSourceCondition(
              relatedIdsAs,
              sourceCondition,
              updateFrom,
              relatedPrimaryKeys,
            );
          }
          if (upsertRelatedIdsAs) {
            upsertRelatedIdsAs.push(new RawSql(`"${as}"`));
            setSourceCondition(
              upsertRelatedIdsAs,
              upsertSourceCondition,
              upsertUpdateFrom,
              relatedPrimaryKeys,
            );
          }
        },
      );

      if (!querySelf.q.upsertUpdate) {
        relatedQuery.q.ensureCount = {
          expected: relatedWheres.length,
          message: `based on \`${hasAdd ? 'add' : 'set'}\` conditions`,
        };
      }
    }

    appendRelatedQuery = () => {
      const ids = makeRelationIds();
      const addQuery = _queryUpdate(
        (sourceCondition
          ? relQuery.clone().where({
              OR: relatedWheres,
              NOT: {
                OR: updates.flatMap((update) => toArray(update.where)),
              },
            })
          : relQuery
              .clone()
              .where({ OR: relatedWheres })) as unknown as UpdateSelf,
        ids.setIds as never,
      ) as unknown as Query;

      addQuery.q.returnType = 'void';
      if (!sourceCondition && !querySelf.q.upsertUpdate) {
        addQuery.q.ensureCount = {
          expected: relatedWheres.length,
          message: `based on \`${hasAdd ? 'add' : 'set'}\` conditions`,
        };
      }

      _appendQuery(querySelf, addQuery, ids.setAppendedAs);
    };
  }

  if (upsertRelatedIdsAs) {
    const { query: relQuery } = state;
    const ids = makeRelationIds();
    let existingRelQuery = hasDisconnect
      ? ids.existingRelQuery.whereNot({ OR: toArray(params.disconnect) })
      : ids.existingRelQuery;
    if (params.set !== undefined) {
      existingRelQuery = (
        hasSetConditions
          ? existingRelQuery.where(
              Array.isArray(params.set) ? { OR: params.set } : params.set,
            )
          : existingRelQuery.none()
      ) as Query;
    }
    const relatedPrimaryKeys = getPrimaryKeys(relQuery);
    const relatedQuery = _querySelect(
      existingRelQuery,
      relatedPrimaryKeys as never,
    ) as Query;
    relatedQuery.q.returnType = 'void';

    _appendQuery(querySelf, relatedQuery, ids.setAppendedAs, (as) => {
      upsertRelatedIdsAs.push(new RawSql(`"${as}"`));
      setSourceCondition(
        upsertRelatedIdsAs,
        upsertSourceCondition,
        upsertUpdateFrom,
        relatedPrimaryKeys,
      );
    });
  }

  if (
    params.delete &&
    (!Array.isArray(params.delete) || params.delete.length > 0)
  ) {
    const ids = makeRelationIds();
    const deleteQuery = _queryDelete(
      ids.existingRelQuery.where({
        OR: toArray(params.delete),
      }) as Query.NotReadOnlyQuery,
    ) as unknown as Query;

    deleteQuery.q.returnType = 'void';

    _appendQuery(querySelf, deleteQuery, ids.setAppendedAs);
  }

  appendRelatedQuery?.();

  if (params.upsert) {
    const { query: relQuery } = state;

    for (const upsert of toArray(params.upsert)) {
      const ids = makeRelationIds();

      const appendedQuery = _queryUpsert(
        (upsertSourceCondition
          ? relQuery
              .clone()
              .where(upsert.findBy as never)
              .whereSql(upsertSourceCondition)
          : ids.existingRelQuery.where(upsert.findBy as never)) as Query,
        makeNestedUpdateUpsertData(
          upsertSourceCondition
            ? { ...upsert, update: { ...upsert.update, ...ids.setIds } }
            : upsert,
          ids.setIds,
        ),
      ) as unknown as Query;

      if (upsertUpdateFrom) {
        appendedQuery.q.updateFrom = {
          u: true,
          x: upsertUpdateFrom,
        };
      }

      appendedQuery.q.returnType = 'void';

      _appendQuery(querySelf, appendedQuery, ids.setAppendedAs);
    }
  }

  if (hasUpdate) {
    for (const update of updates) {
      if (Array.isArray(update.where) && update.where.length === 0) continue;

      const { query: relQuery } = state;
      const ids = makeRelationIds();
      let relatedUpdateQuery: Query = relQuery.clone().where({
        OR: toArray(update.where),
      });

      if (sourceCondition) {
        relatedUpdateQuery.q.updateFrom = {
          u: true,
          x: updateFrom as RawSql,
        };
        relatedUpdateQuery = relatedUpdateQuery.whereSql(sourceCondition);
      } else {
        relatedUpdateQuery = ids.existingRelQuery.where({
          OR: toArray(update.where),
        });
      }
      const updateQuery = _queryUpdate(
        relatedUpdateQuery as unknown as UpdateSelf,
        (sourceCondition
          ? { ...update.data, ...ids.setIds }
          : update.data) as never,
      ) as unknown as Query;

      updateQuery.q.returnType = 'void';

      _appendQuery(querySelf, updateQuery, ids.setAppendedAs);
    }
  }

  if (params.create?.length) {
    const { query: relQuery } = state;
    const ids = makeRelationIds();
    const createQuery = _queryInsertMany(
      relQuery.clone() as unknown as CreateSelf,
      params.create.map((data) => ({ ...data, ...ids.setIds })),
    ) as unknown as Query;

    createQuery.q.returnType = 'void';

    _appendQuery(querySelf, createQuery, ids.setAppendedAs);
  }
};
