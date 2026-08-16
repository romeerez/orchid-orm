import { OrchidOrmInternalError, Query } from 'pqb';
import {
  _queryDelete,
  _queryHookAfterCreate,
  _queryHookAfterUpdate,
  _queryInsertForEachFrom,
  _queryInsertMany,
  _queryJoinOn,
  _querySelect,
  _queryUpdate,
  _queryUpsert,
  _onUpsertUpdate,
  _queryWhere,
  _queryWhereExists,
  _queryWhereIn,
  _appendQuery,
  _appendQueryOnUpsertCreate,
  _clone,
  _hookSelectColumns,
  CreateSelf,
  objectHasValues,
  RawSql,
  RecordUnknown,
  MaybeArray,
  toArray,
  UpdateSelf,
  WhereArg,
} from 'pqb/internal';
import {
  makeRawSqlPlaceholders,
  NestedUpdateManyAdd,
  NestedUpdateManyCreate,
  NestedUpdateManyDelete,
  NestedUpdateManyDisconnect,
  NestedUpdateManySet,
  NestedUpdateManyUpdate,
  NestedUpdateManyUpsert,
  selectCteColumnSql,
  selectCteColumnsSql,
} from '../common/utils';
import { State } from './has-and-belongs-to-many';

export const nestedUpdateUpsert = (
  querySelf: Query,
  state: State,
  upsert: MaybeArray<NestedUpdateManyUpsert>,
  onAppended?: (as: string, index: number) => void,
  updateFrom?: RawSql,
  sourceCondition?: RawSql,
  disconnect?: NestedUpdateManyDisconnect,
  set?: NestedUpdateManySet,
) => {
  for (const [index, item] of toArray(upsert).entries()) {
    nestedUpdateUpsertOne(
      querySelf,
      state,
      item,
      (as) => onAppended?.(as, index),
      updateFrom,
      sourceCondition,
      disconnect,
      set,
    );
  }
};

const nestedUpdateUpsertOne = (
  querySelf: Query,
  state: State,
  upsert: NestedUpdateManyUpsert,
  onAppended?: (as: string) => void,
  updateFrom?: RawSql,
  sourceCondition?: RawSql,
  disconnect?: NestedUpdateManyDisconnect,
  set?: NestedUpdateManySet,
) => {
  const parentIdsSql = new RawSql('');
  const parentValues = makeRawSqlPlaceholders(state.foreignKeys.length);
  const relatedIdsSql = new RawSql('');
  const relatedValues = makeRawSqlPlaceholders(state.throughPrimaryKeys.length);

  let parentAs: string | undefined;
  _hookSelectColumns(querySelf, state.primaryKeys, (aliasedPrimaryKeys) => {
    parentIdsSql._sql = selectCteColumnsSql(
      parentAs as string,
      aliasedPrimaryKeys,
    );

    for (let i = 0; i < state.foreignKeys.length; i++) {
      parentValues[i]._sql = selectCteColumnSql(
        parentAs as string,
        aliasedPrimaryKeys[i],
      );
    }
  });

  let existingRelQuery = _queryWhere(_clone(state.relatedTableQuery), [
    upsert.findBy as unknown as WhereArg<Query>,
  ]);
  if (disconnect) {
    existingRelQuery = existingRelQuery.whereNot({
      OR: toArray(disconnect),
    });
  }
  existingRelQuery = _queryWhereExists(existingRelQuery, state.joinTableQuery, [
    (q) => {
      for (let i = 0; i < state.throughPrimaryKeys.length; i++) {
        _queryJoinOn(q, [
          state.throughForeignKeysFull[i],
          state.throughPrimaryKeysFull[i],
        ]);
      }

      return _queryWhereIn(q, true, state.foreignKeysFull, parentIdsSql);
    },
  ]);
  if (sourceCondition) {
    existingRelQuery.q.updateFrom = { u: true, x: updateFrom as RawSql };
    const conditions = existingRelQuery.q.and as unknown[];
    const existingRelationCondition = conditions.pop();
    const relationCondition = set
      ? sourceCondition
      : { OR: [existingRelationCondition, sourceCondition] };
    conditions.push(relationCondition);
  }

  const upsertQuery = _querySelect(
    _queryUpsert(existingRelQuery, {
      update: upsert.update,
      create: upsert.create || {},
    }),
    state.throughPrimaryKeys,
  ) as unknown as Query;

  upsertQuery.q.returnType = 'void';
  _onUpsertUpdate(upsertQuery, (as) => onAppended?.(as));
  if (onAppended) {
    upsertQuery.q.upsertCreateAsFns = [
      ...(upsertQuery.q.upsertCreateAsFns || []),
      onAppended,
    ];
  }

  const selectAs: RecordUnknown = {};
  for (let i = 0; i < state.foreignKeys.length; i++) {
    selectAs[state.foreignKeys[i]] = parentValues[i];
  }
  for (let i = 0; i < state.throughForeignKeys.length; i++) {
    selectAs[state.throughForeignKeys[i]] = relatedValues[i];
  }

  const joinRows = _querySelect(_clone(state.queryBuilder), [
    selectAs as never,
  ]) as Query;
  _queryWhere(joinRows, [relatedIdsSql] as never);

  const joinQuery = (
    state.joinTableQuery as Query.NotReadOnlyQuery
  ).insertForEachFrom(joinRows as never) as Query;

  joinQuery.q.returnType = 'void';

  _appendQuery(
    querySelf,
    _appendQueryOnUpsertCreate(upsertQuery, joinQuery, (as) => {
      onAppended?.(as);
      relatedIdsSql._sql = `EXISTS (SELECT 1 FROM "${as}")`;
      for (let i = 0; i < relatedValues.length; i++) {
        relatedValues[i]._sql = selectCteColumnSql(
          as,
          state.throughPrimaryKeys[i],
        );
      }
    }),
    (as) => {
      parentAs = as;
    },
  );
};

export const nestedUpdateAdd = (
  querySelf: Query,
  state: State,
  add: NestedUpdateManyAdd,
  onAppended?: (as: string) => void,
) => {
  const relatedWheres = toArray(add);
  const joinTableColumns = [...state.foreignKeys, ...state.throughForeignKeys];
  const parentValues = makeRawSqlPlaceholders(state.foreignKeys.length);
  const mainQuery = _clone(state.queryBuilder);
  const isRootUpsert = querySelf.q.upsertUpdate;
  let parentCount = 0;

  if (!isRootUpsert) {
    _queryHookAfterUpdate(querySelf, state.primaryKeys, (rows) => {
      parentCount = rows.length;
    });
  }

  _hookSelectColumns(querySelf, state.primaryKeys, (aliased) => {
    for (let i = 0; i < parentValues.length; i++) {
      parentValues[i]._sql = `"${mainQuery.q.from}"."${aliased[i]}"`;
    }
  });

  const joinRows = _querySelect(
    state.relatedTableQuery.whereOneOf(...relatedWheres) as Query,
    [
      Object.fromEntries([
        ...state.foreignKeys.map((key, i) => [key, parentValues[i]]),
        ...state.throughForeignKeys.map((key, i) => [
          key,
          state.throughPrimaryKeys[i],
        ]),
      ]),
    ],
  ).join(mainQuery as never, true) as Query;

  const joinQuery = (state.joinTableQuery as Query.NotReadOnlyQuery)
    .insertForEachFrom(joinRows as never)
    // do update on conflict to increase the resulting counter
    .onConflict(joinTableColumns)
    .merge([state.foreignKeys[0]]);

  if (onAppended) {
    _querySelect(joinQuery, state.throughForeignKeys as never);
  } else {
    joinQuery.q.returnType = 'void';
  }

  if (!isRootUpsert) {
    joinQuery.q.ensureCount = {
      expected: relatedWheres.length,
      message: 'based on `add` conditions',
    };

    _queryHookAfterCreate(joinQuery, state.foreignKeys, (rows) => {
      if (rows.length < parentCount * relatedWheres.length) {
        throw new OrchidOrmInternalError(
          querySelf,
          `Expected to find at least ${
            relatedWheres.length
          } record(s) based on \`add\` conditions, but found ${
            rows.length / parentCount
          }`,
        );
      }
    });
  }

  _appendQuery(
    querySelf,
    joinQuery,
    (as) => {
      mainQuery.q.from = as;
      mainQuery.q.schema = undefined;
      mainQuery.q.as = undefined;
    },
    onAppended,
  );
};

export const nestedUpdateDisconnect = (
  querySelf: Query,
  state: State,
  disconnect: NestedUpdateManyDisconnect,
) => {
  const relatedWheres = toArray(disconnect);
  const joinTableColumns = [...state.foreignKeys, ...state.throughForeignKeys];
  const parentValues = makeRawSqlPlaceholders(state.foreignKeys.length);
  const mainQuery = _clone(state.queryBuilder);

  _hookSelectColumns(querySelf, state.primaryKeys, (aliased) => {
    for (let i = 0; i < parentValues.length; i++) {
      parentValues[i]._sql = `"${mainQuery.q.from}"."${aliased[i]}"`;
    }
  });

  const joinRows = _querySelect(
    state.relatedTableQuery.whereOneOf(...relatedWheres) as Query,
    [
      Object.fromEntries([
        ...state.foreignKeys.map((key, i) => [key, parentValues[i]]),
        ...state.throughForeignKeys.map((key, i) => [
          key,
          state.throughPrimaryKeys[i],
        ]),
      ]),
    ],
  ).join(mainQuery as never, true) as Query;

  const joinQuery = _queryDelete(
    state.joinTableQuery.where({
      IN: {
        columns: joinTableColumns,
        values: joinRows,
      },
    }),
  );

  joinQuery.q.returnType = 'void';

  _appendQuery(querySelf, joinQuery, (as) => {
    mainQuery.q.from = as;
    mainQuery.q.schema = undefined;
    mainQuery.q.as = undefined;
  });
};

export const nestedUpdateDelete = (
  querySelf: Query,
  state: State,
  del: NestedUpdateManyDelete,
) => {
  const relatedWheres = toArray(del);
  const parentValues = makeRawSqlPlaceholders(state.foreignKeys.length);
  const relatedValues = makeRawSqlPlaceholders(state.throughForeignKeys.length);
  const parentIdsSql = new RawSql('');
  const mainQuery = _clone(state.queryBuilder);
  const relatedRows = _querySelect(_clone(state.queryBuilder), [
    Object.fromEntries([
      ...state.foreignKeys.map((key, i) => [key, parentValues[i]]),
      ...state.throughForeignKeys.map((key, i) => [key, relatedValues[i]]),
    ]),
  ]).join(mainQuery as never, true) as Query;

  _hookSelectColumns(querySelf, state.primaryKeys, (aliased) => {
    parentIdsSql._sql = selectCteColumnsSql(
      mainQuery.q.from as string,
      aliased,
    );

    for (let i = 0; i < parentValues.length; i++) {
      parentValues[i]._sql = `"${mainQuery.q.from}"."${aliased[i]}"`;
    }
  });

  const relatedQuery = _queryWhereExists(
    state.relatedTableQuery.whereOneOf(...relatedWheres) as Query,
    state.joinTableQuery,
    [
      (q) => {
        for (let i = 0; i < state.throughPrimaryKeys.length; i++) {
          _queryJoinOn(q, [
            state.throughForeignKeysFull[i],
            state.throughPrimaryKeysFull[i],
          ]);
        }

        return _queryWhereIn(q, true, state.foreignKeysFull, parentIdsSql);
      },
    ],
  );

  const relatedDeleteQuery = _queryDelete(
    _querySelect(relatedQuery, state.throughPrimaryKeys),
  ) as unknown as Query;

  relatedDeleteQuery.q.returnType = 'void';

  const joinQuery = _queryDelete(
    state.joinTableQuery.where({
      IN: {
        columns: [...state.foreignKeys, ...state.throughForeignKeys],
        values: relatedRows,
      },
    }),
  );

  joinQuery.q.returnType = 'void';

  _appendQuery(
    querySelf,
    relatedDeleteQuery,
    () => {},
    (as) => {
      relatedRows.q.from = as;
      relatedRows.q.schema = undefined;
      relatedRows.q.as = undefined;

      for (let i = 0; i < relatedValues.length; i++) {
        relatedValues[i]._sql = `"${as}"."${state.throughPrimaryKeys[i]}"`;
      }
    },
  );

  _appendQuery(querySelf, joinQuery, (as) => {
    mainQuery.q.from = as;
    mainQuery.q.schema = undefined;
    mainQuery.q.as = undefined;
  });
};

export const nestedUpdateUpdate = (
  querySelf: Query,
  state: State,
  update: NestedUpdateManyUpdate,
  updateFrom?: RawSql,
  sourceCondition?: RawSql,
  disconnect?: NestedUpdateManyDisconnect,
  set?: NestedUpdateManySet,
) => {
  const parentIdsSql = new RawSql('');
  const mainQuery = _clone(state.queryBuilder);
  const isRootUpsert = querySelf.q.upsertUpdate;

  _hookSelectColumns(querySelf, state.primaryKeys, (aliased) => {
    parentIdsSql._sql = selectCteColumnsSql(
      mainQuery.q.from as string,
      aliased,
    );
  });

  for (const item of toArray(update)) {
    for (const relatedWhere of toArray(item.where)) {
      let relatedQuery = _queryWhere(_clone(state.relatedTableQuery), [
        relatedWhere,
      ]) as Query;

      if (disconnect) {
        relatedQuery = relatedQuery.whereNot({
          OR: toArray(disconnect),
        });
      }

      if (sourceCondition) {
        relatedQuery.q.updateFrom = { u: true, x: updateFrom as RawSql };
        relatedQuery = (relatedQuery as Query.NotReadOnlyQuery).whereSql(
          sourceCondition,
        ) as Query;
      } else {
        relatedQuery = _queryWhereExists(relatedQuery, state.joinTableQuery, [
          (q) => {
            for (let i = 0; i < state.throughPrimaryKeys.length; i++) {
              _queryJoinOn(q, [
                state.throughForeignKeysFull[i],
                state.throughPrimaryKeysFull[i],
              ]);
            }

            return _queryWhereIn(q, true, state.foreignKeysFull, parentIdsSql);
          },
        ]);
      }

      const relatedUpdateQuery = _queryUpdate(
        relatedQuery as unknown as UpdateSelf,
        item.data as never,
      ) as unknown as Query;

      relatedUpdateQuery.q.returnType = 'void';

      if (!isRootUpsert && !disconnect && !set) {
        relatedUpdateQuery.q.ensureCount = { expected: 1 };
      }

      _appendQuery(querySelf, relatedUpdateQuery, (as) => {
        mainQuery.q.from = as;
        mainQuery.q.schema = undefined;
        mainQuery.q.as = undefined;
      });
    }
  }
};

export const nestedUpdateCreate = (
  querySelf: Query,
  state: State,
  create: NestedUpdateManyCreate,
) => {
  const mainQuery = _clone(state.queryBuilder);
  const parentValues = makeRawSqlPlaceholders(state.foreignKeys.length);
  const relatedValues = makeRawSqlPlaceholders(state.throughForeignKeys.length);

  _hookSelectColumns(querySelf, state.primaryKeys, (aliased) => {
    for (let i = 0; i < parentValues.length; i++) {
      parentValues[i]._sql = `"${mainQuery.q.from}"."${aliased[i]}"`;
    }
  });

  const joinRows = _querySelect(_clone(state.relatedTableQuery.baseQuery), [
    Object.fromEntries([
      ...state.foreignKeys.map((key, i) => [key, parentValues[i]]),
      ...state.throughForeignKeys.map((key, i) => [key, relatedValues[i]]),
    ]),
  ]).join(mainQuery as never, true) as Query;

  const joinQuery = _queryInsertForEachFrom(
    _clone(state.joinTableQuery) as unknown as CreateSelf,
    joinRows,
  ) as unknown as Query;
  joinQuery.q.returnType = 'void';

  const relatedCreateQuery = _queryInsertMany(
    _querySelect(
      _clone(state.relatedTableQuery),
      state.throughPrimaryKeys as never,
    ) as unknown as CreateSelf,
    create as never,
  ) as unknown as Query;

  relatedCreateQuery.q.returnType = 'void';

  _appendQuery(
    querySelf,
    relatedCreateQuery,
    (as) => {
      mainQuery.q.from = as;
      mainQuery.q.schema = undefined;
      mainQuery.q.as = undefined;
    },
    (as) => {
      joinRows.q.from = as;
      joinRows.q.schema = undefined;
      joinRows.q.as = undefined;

      for (let i = 0; i < relatedValues.length; i++) {
        relatedValues[i]._sql = `"${as}"."${state.throughPrimaryKeys[i]}"`;
      }
    },
  );

  _appendQuery(querySelf, joinQuery, () => {});
};

export const nestedUpdateSet = (
  querySelf: Query,
  state: State,
  set: NestedUpdateManySet,
  onAppended?: (as: string) => void,
) => {
  const mainQuery = _clone(state.queryBuilder);
  const parentIdsSql = new RawSql('');
  const parentValues = makeRawSqlPlaceholders(state.foreignKeys.length);

  _hookSelectColumns(querySelf, state.primaryKeys, (aliased) => {
    parentIdsSql._sql = selectCteColumnsSql(
      mainQuery.q.from as string,
      aliased,
    );

    for (let i = 0; i < parentValues.length; i++) {
      parentValues[i]._sql = `"${mainQuery.q.from}"."${aliased[i]}"`;
    }
  });

  const deleteQuery = _queryDelete(
    state.joinTableQuery.where({
      IN: {
        columns: state.foreignKeys,
        values: parentIdsSql,
      },
    }),
  );

  deleteQuery.q.returnType = 'void';

  if (state.on) {
    _queryWhereExists(deleteQuery, state.relatedTableQuery, [
      (q) => {
        for (let i = 0; i < state.throughPrimaryKeys.length; i++) {
          _queryJoinOn(q, [
            state.throughPrimaryKeysFull[i],
            state.throughForeignKeysFull[i],
          ]);
        }
        return q;
      },
    ]);
  }

  _appendQuery(querySelf, deleteQuery, (as) => {
    mainQuery.q.from = as;
    mainQuery.q.schema = undefined;
    mainQuery.q.as = undefined;
  });

  const isEmpty = Array.isArray(set) ? set.length === 0 : !objectHasValues(set);
  if (isEmpty) return;

  const relatedWheres = toArray(set);
  const joinTableColumns = [...state.foreignKeys, ...state.throughForeignKeys];
  const isRootUpsert = querySelf.q.upsertUpdate;
  let parentCount = 0;

  if (!isRootUpsert) {
    _queryHookAfterUpdate(querySelf, state.primaryKeys, (rows) => {
      parentCount = rows.length;
    });
  }

  const joinRows = _querySelect(
    state.relatedTableQuery.whereOneOf(...relatedWheres) as Query,
    [
      Object.fromEntries([
        ...state.foreignKeys.map((key, i) => [key, parentValues[i]]),
        ...state.throughForeignKeys.map((key, i) => [
          key,
          state.throughPrimaryKeys[i],
        ]),
      ]),
    ],
  ).join(mainQuery as never, true) as Query;

  const joinQuery = (state.joinTableQuery as Query.NotReadOnlyQuery)
    .insertForEachFrom(joinRows as never)
    .onConflict(joinTableColumns)
    .merge([state.foreignKeys[0]]);

  if (onAppended) {
    _querySelect(joinQuery, state.throughForeignKeys as never);
  } else {
    joinQuery.q.returnType = 'void';
  }

  if (!isRootUpsert) {
    joinQuery.q.ensureCount = {
      expected: relatedWheres.length,
      message: 'based on `set` conditions',
    };

    _queryHookAfterCreate(joinQuery, state.foreignKeys, (rows) => {
      if (rows.length < parentCount * relatedWheres.length) {
        throw new OrchidOrmInternalError(
          querySelf,
          `Expected to find at least ${
            relatedWheres.length
          } record(s) based on \`set\` conditions, but found ${
            rows.length / parentCount
          }`,
        );
      }
    });
  }

  _appendQuery(querySelf, joinQuery, () => {}, onAppended);
};
