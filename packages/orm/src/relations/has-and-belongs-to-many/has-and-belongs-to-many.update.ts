import { OrchidOrmInternalError, Query } from 'pqb';
import {
  _queryCreateMany,
  _queryDelete,
  _queryJoinOn,
  _queryRows,
  _querySelect,
  _queryUpdate,
  _queryUpsert,
  _queryWhere,
  _queryWhereExists,
  _queryWhereIn,
  _appendQuery,
  _appendQueryOnUpsertCreate,
  _clone,
  _hookSelectColumns,
  MaybeArray,
  objectHasValues,
  pick,
  RawSql,
  RecordUnknown,
  toArray,
  UpdateSelf,
  WhereArg,
} from 'pqb/internal';
import { NestedUpdateManyItems } from '../common/utils';
import { HasManyNestedUpdate } from '../has-many/has-many';
import { State } from './has-and-belongs-to-many';

const selectCteColumnsSql = (cteAs: string, columns: string[]) =>
  `(SELECT ${columns.map((c) => `"${cteAs}"."${c}"`).join(', ')} FROM "${cteAs}")`;

const selectCteColumnSql = (cteAs: string, column: string) =>
  `(SELECT "${cteAs}"."${column}" FROM "${cteAs}")`;

const conditionsToWhereArg = (
  conditions: MaybeArray<WhereArg<Query>>,
): WhereArg<Query> =>
  Array.isArray(conditions) ? { OR: conditions } : conditions;

const queryJoinTable = (
  state: State,
  data: RecordUnknown[],
  conditions?: MaybeArray<WhereArg<Query>>,
) => {
  const t = state.joinTableQuery.where({
    IN: {
      columns: state.foreignKeys,
      values: data.map((item) => state.primaryKeys.map((key) => item[key])),
    },
  });

  if (conditions) {
    _queryWhere(t, [
      {
        IN: {
          columns: state.throughForeignKeys,
          values: _querySelect(
            state.relatedTableQuery.where(conditionsToWhereArg(conditions)),
            state.throughPrimaryKeys,
          ),
        },
      },
    ]);
  }

  if (state.on) {
    _queryWhereExists(t, state.relatedTableQuery, [
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

  return t;
};

const insertToJoinTable = (
  state: State,
  joinTableTransaction: Query,
  data: RecordUnknown[],
  idsRows: unknown[][],
) => {
  const len = state.primaryKeys.length;
  const throughLen = state.throughPrimaryKeys.length;

  const records: RecordUnknown[] = [];
  for (const item of data) {
    const obj: RecordUnknown = {};
    for (let i = 0; i < len; i++) {
      obj[state.foreignKeys[i]] = item[state.primaryKeys[i]];
    }

    for (const ids of idsRows) {
      const record = { ...obj };
      for (let i = 0; i < throughLen; i++) {
        record[state.throughForeignKeys[i]] = ids[i];
      }
      records.push(record);
    }
  }

  return (joinTableTransaction as Query.NotReadOnlyQuery).insertMany(records);
};

export const nestedUpdateUpsert = (
  querySelf: Query,
  state: State,
  upsert: NonNullable<NestedUpdateManyItems['upsert']>,
) => {
  const parentIdsSql = new RawSql('');
  const parentValues: RawSql[] = state.foreignKeys.map(() => new RawSql(''));
  const relatedIdsSql = new RawSql('');
  const relatedValues = state.throughPrimaryKeys.map(() => new RawSql(''));

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

  const existingRelQuery = _queryWhereExists(
    _queryWhere(_clone(state.relatedTableQuery), [
      upsert.findBy as unknown as WhereArg<Query>,
    ]),
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

  const upsertQuery = _querySelect(
    _queryUpsert(existingRelQuery, {
      update: upsert.update,
      create: upsert.create || {},
    }),
    state.throughPrimaryKeys,
  ) as unknown as Query;

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

export const nestedUpdate = (state: State) => {
  const len = state.primaryKeys.length;
  const throughLen = state.throughPrimaryKeys.length;

  return (async (
    query: Query,
    data: RecordUnknown[],
    params: NestedUpdateManyItems,
  ) => {
    if (params.create) {
      const idsRows: unknown[][] = await _queryCreateMany(
        _queryRows(state.relatedTableQuery.select(...state.throughPrimaryKeys)),
        params.create,
      );

      const records: RecordUnknown[] = [];
      for (const item of data) {
        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[state.foreignKeys[i]] = (item as RecordUnknown)[
            state.primaryKeys[i]
          ];
        }

        for (const ids of idsRows) {
          const record = { ...obj };

          for (let i = 0; i < throughLen; i++) {
            record[state.throughForeignKeys[i]] = ids[i];
          }

          records.push(record);
        }
      }

      await (state.joinTableQuery as Query.NotReadOnlyQuery).createMany(
        records,
      );
    }

    if (params.update) {
      await _queryUpdate(
        _queryWhere(
          state.relatedTableQuery.whereExists(state.joinTableQuery, (q) => {
            for (let i = 0; i < throughLen; i++) {
              _queryJoinOn(q, [
                state.throughForeignKeysFull[i],
                state.throughPrimaryKeysFull[i],
              ]);
            }

            return _queryWhere(q, [
              {
                IN: {
                  columns: state.foreignKeysFull,
                  values: data.map((item) =>
                    state.primaryKeys.map((key) => item[key]),
                  ),
                },
              },
            ]);
          }),
          [conditionsToWhereArg(params.update.where as WhereArg<Query>)],
        ) as unknown as UpdateSelf,
        params.update.data as never,
      );
    }

    /**
     * Performs `insertForEachFrom` on the joining table,
     * based on a query to the related table with applied filters of `params.connect`,
     * joins the main table data using `joinData`.
     */
    if (params.add) {
      const as = query.table as string;
      const relatedWheres = toArray(params.add);
      const joinTableColumns = [
        ...state.foreignKeys,
        ...state.throughForeignKeys,
      ];

      try {
        const count = await (state.joinTableQuery as Query.NotReadOnlyQuery)
          .insertForEachFrom(
            _querySelect(
              state.relatedTableQuery.whereOneOf(...relatedWheres) as Query,
              [
                Object.fromEntries([
                  ...state.primaryKeys.map((key, i) => [
                    state.foreignKeys[i],
                    as + '.' + (state.primaryKeysShape[key].data.name || key),
                  ]),
                  ...state.throughForeignKeys.map((key, i) => [
                    key,
                    state.throughPrimaryKeys[i],
                  ]),
                ]),
              ],
            ).joinData(
              as,
              () =>
                Object.fromEntries(
                  state.primaryKeys.map((key) => [
                    key,
                    state.primaryKeysShape[key],
                  ]),
                ) as never,
              data.map((x: RecordUnknown) =>
                pick(x, state.primaryKeys),
              ) as never,
            ),
          )
          // do update on conflict to increase the resulting counter
          .onConflict(joinTableColumns)
          .merge([state.foreignKeys[0]]);

        if (count < data.length * relatedWheres.length) {
          throw new OrchidOrmInternalError(
            query,
            `Expected to find at least ${
              relatedWheres.length
            } record(s) based on \`add\` conditions, but found ${
              count / data.length
            }`,
          );
        }
      } catch (err) {
        if ((err as RecordUnknown).code === '42P10') {
          throw new OrchidOrmInternalError(
            query,
            `"${
              state.joinTableQuery.table
            }" must have a primary key or a unique index on columns (${joinTableColumns.join(
              ', ',
            )}) for this kind of query.`,
          );
        }
        throw err;
      }
    }

    if (params.disconnect) {
      await _queryDelete(
        queryJoinTable(state, data, params.disconnect as WhereArg<Query>),
      );
    }

    if (params.delete) {
      const j = queryJoinTable(state, data, params.delete as WhereArg<Query>);

      const idsRows = await _queryDelete(
        _queryRows(_querySelect(j, state.throughForeignKeys)),
      );

      await _queryDelete(
        state.relatedTableQuery.where({
          IN: {
            columns: state.throughPrimaryKeys,
            values: idsRows,
          },
        }),
      );
    }

    if (params.set) {
      const j = queryJoinTable(state, data);
      await _queryDelete(j);

      if (
        Array.isArray(params.set)
          ? params.set.length
          : objectHasValues(params.set)
      ) {
        const idsRows = await _queryRows(
          _querySelect(
            state.relatedTableQuery.where(
              conditionsToWhereArg(params.set as WhereArg<Query>),
            ),
            state.throughPrimaryKeys,
          ),
        );

        await insertToJoinTable(state, j, data, idsRows);
      }
    }
  }) as HasManyNestedUpdate;
};
