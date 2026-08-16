import { Query } from 'pqb';
import {
  _appendQuery,
  _appendQueryOnUpsertCreate,
  _clone,
  _hookSelectColumns,
  _queryFindBy,
  _queryFindByOptional,
  _queryCreateMany,
  _queryInsertForEachFrom,
  _queryInsertMany,
  _queryInsertManyFrom,
  _querySelect,
  _queryTake,
  _queryUpsert,
  _queryUpdate,
  _queryWhere,
  getFreeAlias,
  RawSql,
  RecordUnknown,
  CreateSelf,
  CreateCtx,
  UpdateSelf,
  MaybeArray,
  toArray,
} from 'pqb/internal';
import {
  hasRelationHandleCreate,
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
  NestedUpdateManyUpsert,
  makeRawSqlPlaceholders,
  queryUnionAll,
  setRawSqlPlaceholdersFromCte,
} from '../common/utils';
import { HasManyNestedInsert } from '../has-many/has-many.create';
import { State } from './has-and-belongs-to-many';

export const hasAndBelongsToManyCreate = (
  key: string,
  state: State,
  nestedInsertFn: HasManyNestedInsert,
  self: CreateSelf,
  ctx: CreateCtx,
  items: RecordUnknown[],
  rowIndexes: number[],
  count: number,
) => {
  const querySelf = self as unknown as Query;
  if (count <= querySelf.qb.internal.nestedCreateBatchMax) {
    const {
      relatedTableQuery: relQuery,
      joinTableQuery,
      primaryKeys,
      foreignKeys,
      throughForeignKeys,
      throughPrimaryKeys,
    } = state;

    const nestedRecords: {
      rowIndex: number;
      records: RecordUnknown[];
      foreignKeyValues: RawSql[];
    }[] = [];
    const nestedConnects: {
      rowIndex: number;
      connect: NestedInsertManyConnect;
      foreignKeyValues: RawSql[];
    }[] = [];
    const nestedConnectOrCreates: {
      rowIndex: number;
      connectOrCreate: NestedInsertManyConnectOrCreate;
      foreignKeyValues: RawSql[];
    }[] = [];
    const nestedUpserts: {
      rowIndex: number;
      upsert: MaybeArray<NestedUpdateManyUpsert>;
      foreignKeyValues: RawSql[];
    }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item[key] as NestedInsertManyItems;
      if (value.create?.length) {
        nestedRecords.push({
          rowIndex: rowIndexes[i],
          records: value.create,
          foreignKeyValues: makeRawSqlPlaceholders(foreignKeys.length),
        });
      }
      if (value.connect?.length) {
        nestedConnects.push({
          rowIndex: rowIndexes[i],
          connect: value.connect,
          foreignKeyValues: makeRawSqlPlaceholders(foreignKeys.length),
        });
      }
      if (value.connectOrCreate?.length) {
        nestedConnectOrCreates.push({
          rowIndex: rowIndexes[i],
          connectOrCreate: value.connectOrCreate,
          foreignKeyValues: makeRawSqlPlaceholders(foreignKeys.length),
        });
      }
      if (value.upsert) {
        nestedUpserts.push({
          rowIndex: rowIndexes[i],
          upsert: value.upsert,
          foreignKeyValues: makeRawSqlPlaceholders(foreignKeys.length),
        });
      }
    }

    if (
      nestedRecords.length ||
      nestedConnects.length ||
      nestedConnectOrCreates.length ||
      nestedUpserts.length
    ) {
      let mainAs: string | undefined;
      let aliasedPrimaryKeysForMain: string[] | undefined;
      const setMainForeignKeyValues = () => {
        if (!mainAs || !aliasedPrimaryKeysForMain) return;

        for (const { rowIndex, foreignKeyValues } of [
          ...nestedRecords,
          ...nestedConnects,
          ...nestedConnectOrCreates,
          ...nestedUpserts,
        ]) {
          setRawSqlPlaceholdersFromCte(
            foreignKeyValues,
            mainAs,
            aliasedPrimaryKeysForMain,
            rowIndex,
            count,
          );
        }
      };
      const setMainAs = (as: string) => {
        mainAs = as;
        setMainForeignKeyValues();
      };
      _hookSelectColumns(querySelf, primaryKeys, (aliasedPrimaryKeys) => {
        aliasedPrimaryKeysForMain = aliasedPrimaryKeys;
        setMainForeignKeyValues();
      });

      const joinQueries: Query[] = [];
      for (const nested of nestedRecords) {
        const { foreignKeyValues } = nested;
        const throughForeignKeyValues = makeRawSqlPlaceholders(
          throughForeignKeys.length,
        );

        const selectAs: RecordUnknown = {};
        for (let i = 0; i < foreignKeys.length; i++) {
          selectAs[foreignKeys[i]] = foreignKeyValues[i];
        }
        for (let i = 0; i < throughForeignKeys.length; i++) {
          selectAs[throughForeignKeys[i]] = throughForeignKeyValues[i];
        }

        // `baseQuery` intentionally strips possible `on` WHERE clauses from
        // the join CTE: they are already applied in the related CTE.
        const joinRows = _querySelect(_clone(relQuery.baseQuery), [
          selectAs as never,
        ]);
        const joinQuery = _queryInsertForEachFrom(
          _clone(joinTableQuery) as unknown as CreateSelf,
          joinRows,
        ) as unknown as Query;
        joinQuery.q.returnType = 'void';
        joinQuery.q.ensureCount = { expected: 1 };
        if (querySelf.q.type === 'upsert') {
          const createWhereExists = new RawSql('');
          const sourceQuery = _queryWhere(
            _queryTake(_querySelect(_clone(relQuery.qb), [{}])),
            [createWhereExists] as never,
          );
          const query = _queryInsertManyFrom(
            _querySelect(
              _clone(relQuery),
              throughPrimaryKeys as never,
            ) as unknown as CreateSelf,
            sourceQuery as never,
            nested.records as never,
          ) as unknown as Query;

          const queryWithJoin = _appendQuery(query, joinQuery, (as) => {
            joinRows.q.from = as;
            joinRows.q.schema = undefined;
            for (let i = 0; i < throughForeignKeyValues.length; i++) {
              throughForeignKeyValues[i]._sql =
                `"${as}"."${throughPrimaryKeys[i]}"`;
            }
          });

          _appendQueryOnUpsertCreate(querySelf, queryWithJoin, (as) => {
            setMainAs(as);
            createWhereExists._sql = `EXISTS (SELECT 1 FROM "${as}")`;
          });
        } else {
          joinQueries.push(joinQuery);

          const query = _queryInsertMany(
            _querySelect(
              _clone(relQuery),
              throughPrimaryKeys as never,
            ) as unknown as CreateSelf,
            nested.records as never,
          ) as unknown as Query;

          _appendQuery(querySelf, query, setMainAs, (as) => {
            joinRows.q.from = as;
            joinRows.q.schema = undefined;
            for (let i = 0; i < throughForeignKeyValues.length; i++) {
              throughForeignKeyValues[i]._sql =
                `"${as}"."${throughPrimaryKeys[i]}"`;
            }
          });
        }
      }

      for (const { connect, foreignKeyValues } of nestedConnects) {
        for (const item of connect) {
          const selectAs: RecordUnknown = {};
          for (let i = 0; i < foreignKeys.length; i++) {
            selectAs[foreignKeys[i]] = foreignKeyValues[i];
          }
          for (let i = 0; i < throughForeignKeys.length; i++) {
            selectAs[throughForeignKeys[i]] = throughPrimaryKeys[i];
          }

          const joinRows = _queryFindBy(
            _querySelect(_clone(relQuery), [selectAs as never]),
            item as never,
          );
          const joinQuery = _queryInsertForEachFrom(
            _clone(joinTableQuery) as unknown as CreateSelf,
            joinRows,
          ) as unknown as Query;
          joinQuery.q.returnType = 'void';
          joinQuery.q.ensureCount = { expected: 1 };

          if (querySelf.q.type === 'upsert') {
            const connectWhereExists = new RawSql('');
            _queryWhere(joinRows, [connectWhereExists] as never);

            _appendQueryOnUpsertCreate(querySelf, joinQuery, (as) => {
              setMainAs(as);
              connectWhereExists._sql = `EXISTS (SELECT 1 FROM "${as}")`;
            });
          } else {
            joinQueries.push(joinQuery);
          }
        }
      }

      for (const joinQuery of joinQueries) {
        _appendQuery(querySelf, joinQuery, setMainAs);
      }

      for (const {
        connectOrCreate,
        foreignKeyValues,
      } of nestedConnectOrCreates) {
        for (const value of connectOrCreate) {
          const selectAs: RecordUnknown = {};
          for (let i = 0; i < foreignKeys.length; i++) {
            selectAs[foreignKeys[i]] = foreignKeyValues[i];
          }
          for (let i = 0; i < throughForeignKeys.length; i++) {
            selectAs[throughForeignKeys[i]] = throughPrimaryKeys[i];
          }

          const connectRows = _queryFindBy(
            _querySelect(_clone(relQuery), [selectAs as never]),
            value.where as never,
          );
          const connectQuery = _queryInsertForEachFrom(
            _clone(joinTableQuery) as unknown as CreateSelf,
            connectRows,
          ) as unknown as Query;
          connectQuery.q.returnType = 'void';

          const createWhereNotExists = new RawSql('');
          const createWhereExists =
            querySelf.q.type === 'upsert' ? new RawSql('') : undefined;
          const createSource = _queryWhere(
            _queryTake(_querySelect(_clone(relQuery.qb), [{}])),
            [createWhereNotExists, createWhereExists].filter(Boolean) as never,
          );
          const createQuery = _queryInsertManyFrom(
            _querySelect(
              _clone(relQuery),
              throughPrimaryKeys as never,
            ) as unknown as CreateSelf,
            createSource as never,
            [value.create] as never,
          ) as unknown as Query;

          const throughForeignKeyValues = makeRawSqlPlaceholders(
            throughForeignKeys.length,
          );
          const createSelectAs: RecordUnknown = {};
          for (let i = 0; i < foreignKeys.length; i++) {
            createSelectAs[foreignKeys[i]] = foreignKeyValues[i];
          }
          for (let i = 0; i < throughForeignKeys.length; i++) {
            createSelectAs[throughForeignKeys[i]] = throughForeignKeyValues[i];
          }

          const createJoinRows = _querySelect(_clone(relQuery.baseQuery), [
            createSelectAs as never,
          ]);
          const createJoinQuery = _queryInsertForEachFrom(
            _clone(joinTableQuery) as unknown as CreateSelf,
            createJoinRows,
          ) as unknown as Query;
          createJoinQuery.q.returnType = 'void';

          if (querySelf.q.type === 'upsert') {
            const connectWhereExists = new RawSql('');
            _queryWhere(connectRows, [connectWhereExists] as never);

            const createQueryWithJoin = _appendQuery(
              createQuery,
              createJoinQuery,
              (as) => {
                createJoinRows.q.from = as;
                createJoinRows.q.schema = undefined;
                for (let i = 0; i < throughForeignKeyValues.length; i++) {
                  throughForeignKeyValues[i]._sql =
                    `"${as}"."${throughPrimaryKeys[i]}"`;
                }
              },
            );
            const query = _appendQuery(
              connectQuery,
              createQueryWithJoin,
              (as) => {
                createWhereNotExists._sql = `NOT EXISTS (SELECT 1 FROM "${as}")`;
              },
            );

            _appendQueryOnUpsertCreate(querySelf, query, (as) => {
              setMainAs(as);
              connectWhereExists._sql = `EXISTS (SELECT 1 FROM "${as}")`;
              createWhereExists!._sql = `EXISTS (SELECT 1 FROM "${as}")`;
            });
          } else {
            _appendQuery(querySelf, connectQuery, setMainAs, (as) => {
              createWhereNotExists._sql = `NOT EXISTS (SELECT 1 FROM "${as}")`;
            });
            _appendQuery(querySelf, createQuery, setMainAs, (as) => {
              createJoinRows.q.from = as;
              createJoinRows.q.schema = undefined;
              for (let i = 0; i < throughForeignKeyValues.length; i++) {
                throughForeignKeyValues[i]._sql =
                  `"${as}"."${throughPrimaryKeys[i]}"`;
              }
            });
            _appendQuery(querySelf, createJoinQuery, setMainAs);
          }
        }
      }

      for (const { upsert, foreignKeyValues } of nestedUpserts) {
        for (const value of toArray(upsert)) {
          const upsertWhereExists =
            querySelf.q.type === 'upsert' ? new RawSql('') : undefined;
          const makeJoinQuery = () => {
            const selectAs: RecordUnknown = {};
            for (let i = 0; i < foreignKeys.length; i++) {
              selectAs[foreignKeys[i]] = foreignKeyValues[i];
            }
            for (let i = 0; i < throughForeignKeys.length; i++) {
              selectAs[throughForeignKeys[i]] = new RawSql('');
            }

            const joinRows = _querySelect(_clone(relQuery.baseQuery), [
              selectAs as never,
            ]);
            const joinQuery = _queryInsertForEachFrom(
              _clone(joinTableQuery) as unknown as CreateSelf,
              joinRows,
            ) as unknown as Query;
            joinQuery.q.returnType = 'void';

            return {
              joinQuery,
              setJoinRowsFrom: (as: string) => {
                joinRows.q.from = as;
                joinRows.q.schema = undefined;
                for (let i = 0; i < throughForeignKeys.length; i++) {
                  (selectAs[throughForeignKeys[i]] as RawSql)._sql =
                    `"${as}"."${throughPrimaryKeys[i]}"`;
                }
              },
            };
          };

          const updateQuery = _querySelect(
            _queryUpdate(
              _clone(relQuery).where(
                value.findBy as never,
              ) as unknown as UpdateSelf,
              value.update as never,
            ) as never,
            throughPrimaryKeys as never,
          ) as unknown as Query;
          if (upsertWhereExists) {
            // Prevent the child update when the parent upsert update branch wins.
            _queryWhere(updateQuery, [upsertWhereExists] as never);
          }
          const updateJoin = makeJoinQuery();
          const updateQueryWithJoin = _appendQuery(
            updateQuery,
            updateJoin.joinQuery,
            updateJoin.setJoinRowsFrom,
          );

          let query = updateQueryWithJoin;
          if (value.create) {
            const createWhereNotExists = new RawSql('');
            const createSource = _queryWhere(
              _queryTake(_querySelect(_clone(relQuery.qb), [{}])),
              [createWhereNotExists, upsertWhereExists].filter(
                Boolean,
              ) as never,
            );
            const create =
              typeof value.create === 'function'
                ? value.create()
                : value.create;
            const createQuery = _queryInsertManyFrom(
              _querySelect(
                _clone(relQuery),
                throughPrimaryKeys as never,
              ) as unknown as CreateSelf,
              createSource as never,
              [create] as never,
            ) as unknown as Query;
            const createJoin = makeJoinQuery();
            const createQueryWithJoin = _appendQuery(
              createQuery,
              createJoin.joinQuery,
              createJoin.setJoinRowsFrom,
            );

            query = _appendQuery(
              updateQueryWithJoin,
              createQueryWithJoin,
              (as) => {
                createWhereNotExists._sql = `NOT EXISTS (SELECT 1 FROM "${as}")`;
              },
            );
          }

          const appendQuery =
            querySelf.q.type === 'upsert'
              ? _appendQueryOnUpsertCreate
              : _appendQuery;
          appendQuery(querySelf, query, (as) => {
            setMainAs(as);
            if (upsertWhereExists) {
              // The insert source must also be empty when no parent was created.
              upsertWhereExists._sql = `EXISTS (SELECT 1 FROM "${as}")`;
            }
          });
        }
      }
    }
  } else {
    hasRelationHandleCreate(
      querySelf,
      ctx,
      items,
      rowIndexes,
      key,
      state.primaryKeys,
      nestedInsertFn,
    );
  }
};

export const nestedInsert = ({
  relatedTableQuery,
  joinTableQuery,
  primaryKeys,
  foreignKeys,
  throughPrimaryKeys,
  throughForeignKeys,
}: State) => {
  const len = primaryKeys.length;
  const throughLen = primaryKeys.length;

  return (async (_, data) => {
    const t = relatedTableQuery.clone();

    // array to store specific items will be reused
    const items: unknown[] = [];
    for (const item of data) {
      if (item[1].connect) {
        items.push(item);
      }
    }

    let connected: RecordUnknown[];
    if (items.length) {
      const queries: Query[] = [];
      const indexAs = getFreeAlias(t.shape, 'i');

      for (const [, { connect }] of items as [
        unknown,
        { connect: NestedInsertManyConnect },
      ][]) {
        for (const item of connect) {
          queries.push(
            _queryFindBy(
              t.select(...throughPrimaryKeys, {
                [indexAs]: new RawSql(String(queries.length)),
              }),
              item as never,
            ) as Query,
          );
        }
      }

      connected = (await queryUnionAll(queries, indexAs)) as RecordUnknown[];
    } else {
      connected = [];
    }

    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        items.push(item);
      }
    }

    let connectOrCreated: (RecordUnknown | undefined)[];
    if (items.length) {
      const queries: Query[] = [];
      const indexAs = getFreeAlias(t.shape, 'i');

      for (const [, { connectOrCreate }] of items as [
        unknown,
        { connectOrCreate: NestedInsertManyConnectOrCreate },
      ][]) {
        for (const item of connectOrCreate) {
          queries.push(
            _queryFindByOptional(
              t.select(...throughPrimaryKeys, {
                [indexAs]: new RawSql(String(queries.length)),
              }),
              item.where as never,
            ) as Query,
          );
        }
      }

      connectOrCreated = await queryUnionAll(queries, indexAs);
    } else {
      connectOrCreated = [];
    }

    let connectOrCreateI = 0;
    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        const length = item[1].connectOrCreate.length;
        connectOrCreateI += length;
        for (let i = length; i > 0; i--) {
          if (!connectOrCreated[connectOrCreateI - i]) {
            items.push(item);
            break;
          }
        }
      } else if (item[1].create) {
        items.push(item);
      }
    }

    connectOrCreateI = 0;
    let created: RecordUnknown[];
    if (items.length) {
      const records: RecordUnknown[] = [];

      for (const [, { create, connectOrCreate }] of items as [
        unknown,
        NestedInsertManyItems,
      ][]) {
        if (create) {
          records.push(...create);
        }

        if (connectOrCreate) {
          for (const item of connectOrCreate) {
            if (!connectOrCreated[connectOrCreateI++]) {
              records.push(item.create);
            }
          }
        }
      }

      created = (await _queryCreateMany(
        t.select(...throughPrimaryKeys),
        records,
      )) as never;
    } else {
      created = [];
    }

    const allKeys = data as unknown as [
      selfData: RecordUnknown,
      relationKeys: RecordUnknown[],
    ][];

    for (let index = 0; index < data.length; index++) {
      const item = data[index][1] as NestedInsertManyItems;
      if (!item.upsert) continue;

      const upserted = await Promise.all(
        toArray(item.upsert).map((upsert) =>
          _querySelect(
            _queryUpsert(t.clone().where(upsert.findBy as never) as never, {
              update: upsert.update,
              create: upsert.create || {},
            }),
            throughPrimaryKeys as never,
          ),
        ),
      );
      allKeys[index][1] = upserted.map((record) =>
        Array.isArray(record) ? record[0] : record,
      ) as RecordUnknown[];
    }

    let createI = 0;
    let connectI = 0;
    connectOrCreateI = 0;
    for (let index = 0, len = data.length; index < len; index++) {
      const item = data[index][1] as NestedInsertManyItems;

      if (item.create || item.connectOrCreate) {
        if (item.create) {
          const len = item.create.length;
          allKeys[index][1] = created.slice(createI, createI + len);
          createI += len;
        }
        if (item.connectOrCreate) {
          const arr: RecordUnknown[] = [];
          allKeys[index][1] = arr;

          const len = item.connectOrCreate.length;
          for (let i = 0; i < len; i++) {
            const item = connectOrCreated[connectOrCreateI++];
            if (item) {
              arr.push(item);
            } else {
              arr.push(created[createI++]);
            }
          }
        }
      }

      if (item.connect) {
        const len = item.connect.length;
        allKeys[index][1] = connected.slice(connectI, connectI + len);
        connectI += len;
      }
    }

    const records: RecordUnknown[] = [];
    for (const [selfData, relationKeys] of allKeys) {
      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = selfData[primaryKeys[i]];
      }

      for (const relationData of relationKeys) {
        const record = { ...obj };

        for (let i = 0; i < throughLen; i++) {
          record[throughForeignKeys[i]] = relationData[throughPrimaryKeys[i]];
        }

        records.push(record);
      }
    }

    await (joinTableQuery as Query.NotReadOnlyQuery).insertMany(records);
  }) as HasManyNestedInsert;
};
