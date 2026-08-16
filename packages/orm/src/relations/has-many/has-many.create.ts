import { Query } from 'pqb';
import {
  _appendQuery,
  _appendQueryOnUpsertCreate,
  _clone,
  _hookSelectColumns,
  _queryCreateMany,
  _queryInsertMany,
  _queryInsertManyFrom,
  _querySelect,
  _queryTake,
  _queryUpdate,
  _queryUpdateOrThrow,
  _queryUpsert,
  _queryWhere,
  CreateCtx,
  CreateSelf,
  getFreeAlias,
  prepareSubQueryForSql,
  RawSql,
  RecordUnknown,
  UpdateSelf,
  WhereArg,
  toArray,
} from 'pqb/internal';
import {
  hasRelationHandleCreate,
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
  NestedUpdateManyUpsert,
  NestedInsertOneItemConnectOrCreate,
  makeNestedUpdateUpsertData,
  queryUnionAll,
  selectCteColumnFromManySql,
  makeRawSqlPlaceholderRecord,
  setRawSqlPlaceholderRecordFromCte,
} from '../common/utils';

export type HasManyNestedInsert = (
  query: Query,
  data: [selfData: RecordUnknown, relationData: NestedInsertManyItems][],
) => Promise<void>;

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
}

export const nestedInsert = ({ query, primaryKeys, foreignKeys }: State) => {
  const len = primaryKeys.length;

  return (async (_, data) => {
    const t = query.clone();

    // array to store specific items will be reused
    const items: unknown[] = [];
    for (const item of data) {
      if (item[1].connect) {
        items.push(item);
      }
    }

    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, { connect }] = items[i] as [
          RecordUnknown,
          { connect: NestedInsertManyConnect },
        ];

        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        items[i] = _queryUpdateOrThrow(
          t.where<Query>({ OR: connect as never[] }) as unknown as UpdateSelf,
          obj as never,
        ) as unknown as Query;
      }

      await Promise.all(items);
    }

    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        items.push(item);
      }
    }

    let connected: (RecordUnknown | undefined)[];
    if (items.length) {
      const queries: Query[] = [];
      const indexAs = getFreeAlias(t.shape, 'i');
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, { connectOrCreate }] = items[i] as [
          RecordUnknown,
          { connectOrCreate: NestedInsertManyConnectOrCreate },
        ];

        for (const item of connectOrCreate) {
          const obj: RecordUnknown = {};
          for (let i = 0; i < len; i++) {
            obj[foreignKeys[i]] = selfData[primaryKeys[i]];
          }

          queries.push(
            _querySelect(
              _queryUpdate(
                t.where(item.where as WhereArg<Query>) as unknown as UpdateSelf,
                obj as never,
              ) as unknown as Query,
              [{ [indexAs]: new RawSql(String(queries.length)) }],
            ) as Query,
          );
        }
      }

      connected = await queryUnionAll(queries, indexAs);
    } else {
      connected = [];
    }

    let connectedI = 0;
    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        const length = item[1].connectOrCreate.length;
        connectedI += length;
        for (let i = length; i > 0; i--) {
          if (!connected[connectedI - i]) {
            items.push(item);
            break;
          }
        }
      } else if (item[1].create) {
        items.push(item);
      }
    }

    connectedI = 0;
    if (items.length) {
      const records: RecordUnknown[] = [];

      for (const [selfData, { create, connectOrCreate }] of items as [
        RecordUnknown,
        NestedInsertManyItems,
      ][]) {
        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        if (create) {
          for (const item of create) {
            records.push({
              ...item,
              ...obj,
            });
          }
        }

        if (connectOrCreate) {
          for (const item of connectOrCreate) {
            if (!connected[connectedI++]) {
              records.push({
                ...item.create,
                ...obj,
              });
            }
          }
        }
      }

      await _queryCreateMany(t, records);
    }

    const queries: Query[] = [];
    for (const [selfData, { upsert }] of data) {
      if (!upsert) continue;

      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = selfData[primaryKeys[i]];
      }

      for (const item of toArray(upsert)) {
        queries.push(
          _queryUpsert(t.clone().where(item.findBy as never) as never, {
            update: { ...item.update, ...obj },
            create: makeNestedUpdateUpsertData(item, obj).create,
          }) as Query,
        );
      }
    }

    if (queries.length) {
      await queries[0].unionAll(...queries.slice(1));
    }
  }) as HasManyNestedInsert;
};

export const hasManyCreate = (
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
    interface NestedCreateItem {
      indexes: number[];
      items: RecordUnknown[];
      values: unknown[][];
    }

    interface NestedCreateItems {
      create?: {
        indexes: number[];
        items: RecordUnknown[][];
      };
      connect?: NestedCreateItem;
      connectOrCreate?: NestedCreateItem;
      upsert?: NestedCreateItem;
    }

    const { query: relQuery, primaryKeys, foreignKeys } = state;

    let nestedCreateItems: NestedCreateItems | undefined;

    items.forEach((item, i) => {
      const value = item[key] as NestedInsertManyItems;

      if (value.create?.length) {
        const nestedCreateItem = ((nestedCreateItems ??= {}).create ??= {
          indexes: [],
          items: [],
        });
        nestedCreateItem.indexes.push(rowIndexes[i]);

        const data = value.create.map((obj) => ({
          ...obj,
          ...makeRawSqlPlaceholderRecord(foreignKeys),
        }));

        nestedCreateItem.items.push(data);
      }

      for (const kind of ['connect', 'connectOrCreate', 'upsert'] as const) {
        const values = (
          kind === 'upsert'
            ? value.upsert
              ? toArray(value.upsert)
              : undefined
            : value[kind]
        ) as unknown[] | undefined;
        if (!values?.length) continue;

        const nestedCreateItem = ((nestedCreateItems ??= {})[kind] ??= {
          indexes: [],
          items: [],
          values: [],
        });
        nestedCreateItem.indexes.push(rowIndexes[i]);
        nestedCreateItem.values.push(values as unknown[]);

        const data = makeRawSqlPlaceholderRecord(foreignKeys);
        nestedCreateItem.items.push(data);
      }
    });

    if (!nestedCreateItems) {
      return;
    }

    let createAs: string | undefined;
    let createWhereExists: RawSql | undefined;
    let createSelectAs: RecordUnknown | undefined;
    let createAliasedPrimaryKeys: string[] | undefined;
    let upsertCreateAs: string | undefined;
    let connectAs: string | undefined;
    let connectOrCreateAs: string | undefined;
    let upsertAs: string | undefined;

    // In upsert create, relation FKs point to the parent create CTE.
    // The CTE alias and selected parent PK aliases are provided by separate callbacks.
    const setUpsertCreatePlaceholders = () => {
      if (!upsertCreateAs || !createAliasedPrimaryKeys) return;

      const aliasedPrimaryKeys = createAliasedPrimaryKeys;

      if (createWhereExists) {
        createWhereExists._sql = `EXISTS (SELECT 1 FROM "${upsertCreateAs}")`;
      }

      if (createSelectAs) {
        foreignKeys.forEach((key, keyI) => {
          ((createSelectAs as RecordUnknown)[key] as RawSql)._sql =
            selectCteColumnFromManySql(
              upsertCreateAs as string,
              aliasedPrimaryKeys[keyI],
              0,
              1,
            );
        });
      }

      if (connect) {
        for (let i = 0; i < connect.items.length; i++) {
          setRawSqlPlaceholderRecordFromCte(
            connect.items[i],
            foreignKeys,
            upsertCreateAs,
            aliasedPrimaryKeys,
            connect.indexes[i],
            count,
          );
        }
      }

      if (connectOrCreate) {
        for (let i = 0; i < connectOrCreate.items.length; i++) {
          setRawSqlPlaceholderRecordFromCte(
            connectOrCreate.items[i],
            foreignKeys,
            upsertCreateAs,
            aliasedPrimaryKeys,
            connectOrCreate.indexes[i],
            count,
          );
        }
      }

      if (upsert) {
        for (let i = 0; i < upsert.items.length; i++) {
          setRawSqlPlaceholderRecordFromCte(
            upsert.items[i],
            foreignKeys,
            upsertCreateAs,
            aliasedPrimaryKeys,
            upsert.indexes[i],
            count,
          );
        }
      }
    };

    _hookSelectColumns(querySelf, primaryKeys, (aliasedPrimaryKeys) => {
      createAliasedPrimaryKeys = aliasedPrimaryKeys;

      if (create && createAs) {
        for (let i = 0; i < create.items.length; i++) {
          for (const item of create.items[i]) {
            setRawSqlPlaceholderRecordFromCte(
              item,
              foreignKeys,
              createAs,
              aliasedPrimaryKeys,
              create.indexes[i],
              count,
            );
          }
        }
      }

      if (connect && connectAs) {
        for (let i = 0; i < connect.items.length; i++) {
          setRawSqlPlaceholderRecordFromCte(
            connect.items[i],
            foreignKeys,
            connectAs,
            aliasedPrimaryKeys,
            connect.indexes[i],
            count,
          );
        }
      }

      if (connectOrCreate && connectOrCreateAs) {
        for (let i = 0; i < connectOrCreate.items.length; i++) {
          setRawSqlPlaceholderRecordFromCte(
            connectOrCreate.items[i],
            foreignKeys,
            connectOrCreateAs,
            aliasedPrimaryKeys,
            connectOrCreate.indexes[i],
            count,
          );
        }
      }

      if (upsert && upsertAs) {
        for (let i = 0; i < upsert.items.length; i++) {
          setRawSqlPlaceholderRecordFromCte(
            upsert.items[i],
            foreignKeys,
            upsertAs,
            aliasedPrimaryKeys,
            upsert.indexes[i],
            count,
          );
        }
      }

      setUpsertCreatePlaceholders();
    });

    const { create, connect, connectOrCreate, upsert } = nestedCreateItems;

    if (create) {
      let query: Query;
      if (querySelf.q.type === 'upsert') {
        createWhereExists = new RawSql('');
        createSelectAs = {};
        for (const key of foreignKeys) {
          createSelectAs[key] = new RawSql('');
        }

        const sourceQuery = _queryWhere(
          _queryTake(
            _querySelect(_clone(relQuery.qb), [createSelectAs as never]),
          ),
          [createWhereExists] as never,
        );

        // Plain INSERT ... VALUES cannot render a WHERE guard, so upsert
        // nested create uses INSERT ... SELECT FROM a guarded one-row query.
        query = _queryInsertManyFrom(
          _clone(relQuery) as unknown as CreateSelf,
          sourceQuery as never,
          create.items.flat() as never,
        ) as unknown as Query;
      } else {
        query = _queryInsertMany(
          _clone(relQuery) as unknown as CreateSelf,
          create.items.flat() as never,
        ) as unknown as Query;
      }

      if (querySelf.q.type === 'upsert') {
        _appendQueryOnUpsertCreate(querySelf, query, (as) => {
          upsertCreateAs = as;
          setUpsertCreatePlaceholders();
        });
      } else {
        _appendQuery(querySelf, query, (as) => (createAs = as));
      }
    }

    if (connect) {
      connect.values.forEach((value, i) => {
        const connectWhereExists =
          querySelf.q.type === 'upsert' ? new RawSql('') : undefined;

        const query = _queryUpdateOrThrow(
          relQuery.whereOneOf(...(value as never[])) as never,
          connect.items[i] as never,
        ) as Query;

        if (connectWhereExists) {
          // Only run nested connect when the parent upsert actually created a row.
          _queryWhere(query, [connectWhereExists] as never);
        }

        query.q.ensureCount = { expected: value.length };

        const appendQuery =
          querySelf.q.type === 'upsert'
            ? _appendQueryOnUpsertCreate
            : _appendQuery;

        appendQuery(querySelf, query, (as) => {
          upsertCreateAs = as;
          setUpsertCreatePlaceholders();
          connectAs = as;
          if (connectWhereExists) {
            connectWhereExists._sql = `EXISTS (SELECT 1 FROM "${as}")`;
          }
        });
      });
    }

    if (connectOrCreate) {
      connectOrCreate.values.forEach((array, i) => {
        const foreignKeyValues = connectOrCreate.items[i];
        for (const value of array as NestedInsertOneItemConnectOrCreate[]) {
          const connectOrCreateWhereExists =
            querySelf.q.type === 'upsert' ? new RawSql('') : undefined;
          const connectOrCreateSelectAs: RecordUnknown = {};
          if (connectOrCreateWhereExists) {
            for (const key of foreignKeys) {
              const value = foreignKeyValues[key] as RawSql;
              // These RawSql placeholders are selected by the insertFrom
              // source query, so select parsing needs the target column type.
              value.result = {
                value: relQuery.qb.shape[key],
              };
              connectOrCreateSelectAs[key] = value;
            }
          }

          const query = _queryUpsert(relQuery.where(value.where) as never, {
            update: foreignKeyValues,
            create: {
              ...value.create,
              ...foreignKeyValues,
            },
          });

          if (connectOrCreateWhereExists) {
            // Guard the update half of child upsert with the parent create CTE.
            _queryWhere(query, [connectOrCreateWhereExists] as never);

            // The insert half of child upsert ignores the update query WHERE.
            // Move relation FKs into an insertFrom source that becomes empty
            // when the parent create CTE is empty.
            const guardQuery = _queryWhere(
              _queryTake(
                _querySelect(_clone(relQuery.qb), [{ one: new RawSql('1') }]),
              ),
              [connectOrCreateWhereExists] as never,
            );

            const sourceQuery = _querySelect(
              (_clone(relQuery.qb) as Query).from(guardQuery as never),
              [connectOrCreateSelectAs as never],
            );

            const q = query.q;
            const columns = q.columns || [];
            const foreignKeysSet = new Set(foreignKeys);
            // FK columns now come from sourceQuery; keep user-provided insert
            // columns after them so INSERT column order matches SELECT output.
            q.columns = [
              ...foreignKeys,
              ...columns.filter((column) => !foreignKeysSet.has(column)),
            ];
            // Drop FK values from VALUES; their values are selected from
            // sourceQuery, while the remaining row data still comes from VALUES.
            q.values = q.values.map((row) =>
              row.filter((_, i) => !foreignKeysSet.has(columns[i])),
            );
            // Tells insert SQL how many leading columns are produced by
            // sourceQuery before appending the remaining VALUES columns.
            q.queryColumnsCount = foreignKeys.length;
            q.insertFrom = prepareSubQueryForSql(query, sourceQuery as never);
          }

          const appendQuery =
            querySelf.q.type === 'upsert'
              ? _appendQueryOnUpsertCreate
              : _appendQuery;

          appendQuery(querySelf, query, (as) => {
            upsertCreateAs = as;
            setUpsertCreatePlaceholders();
            connectOrCreateAs = as;
            if (connectOrCreateWhereExists) {
              connectOrCreateWhereExists._sql = `EXISTS (SELECT 1 FROM "${as}")`;
            }
          });
        }
      });
    }

    if (upsert) {
      upsert.values.forEach((array, i) => {
        const foreignKeyValues = upsert.items[i];
        for (const value of array as NestedUpdateManyUpsert[]) {
          const upsertWhereExists =
            querySelf.q.type === 'upsert' ? new RawSql('') : undefined;
          const upsertSelectAs: RecordUnknown = {};
          if (upsertWhereExists) {
            for (const key of foreignKeys) {
              const foreignKeyValue = foreignKeyValues[key] as RawSql;
              foreignKeyValue.result = { value: relQuery.qb.shape[key] };
              upsertSelectAs[key] = foreignKeyValue;
            }
          }

          const query = _queryUpsert(
            relQuery.where(value.findBy as never) as never,
            {
              update: { ...value.update, ...foreignKeyValues },
              create: makeNestedUpdateUpsertData(value, foreignKeyValues)
                .create,
            },
          );

          if (upsertWhereExists) {
            _queryWhere(query, [upsertWhereExists] as never);

            const guardQuery = _queryWhere(
              _queryTake(
                _querySelect(_clone(relQuery.qb), [{ one: new RawSql('1') }]),
              ),
              [upsertWhereExists] as never,
            );

            const sourceQuery = _querySelect(
              (_clone(relQuery.qb) as Query).from(guardQuery as never),
              [upsertSelectAs as never],
            );

            const q = query.q;
            const columns = q.columns || [];
            const foreignKeysSet = new Set(foreignKeys);
            q.columns = [
              ...foreignKeys,
              ...columns.filter((column) => !foreignKeysSet.has(column)),
            ];
            q.values = q.values.map((row) =>
              row.filter((_, i) => !foreignKeysSet.has(columns[i])),
            );
            q.queryColumnsCount = foreignKeys.length;
            q.insertFrom = prepareSubQueryForSql(query, sourceQuery as never);
          }

          const appendQuery =
            querySelf.q.type === 'upsert'
              ? _appendQueryOnUpsertCreate
              : _appendQuery;

          appendQuery(querySelf, query, (as) => {
            upsertCreateAs = as;
            setUpsertCreatePlaceholders();
            upsertAs = as;
            if (upsertWhereExists) {
              upsertWhereExists._sql = `EXISTS (SELECT 1 FROM "${as}")`;
            }
          });
        }
      });
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
