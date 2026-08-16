import { Query } from 'pqb';
import {
  _appendQuery,
  _appendQueryOnUpsertCreate,
  _clone,
  _hookSelectColumns,
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
  prepareSubQueryForSql,
  RawSql,
  RecordUnknown,
  UpdateSelf,
  WhereArg,
} from 'pqb/internal';
import {
  hasRelationHandleCreate,
  NestedInsertOneItem,
  NestedInsertOneItemConnectOrCreate,
  NestedInsertOneItemCreate,
  selectCteColumnFromManySql,
} from '../common/utils';

export type HasOneNestedInsert = (
  query: Query,
  data: [selfData: RecordUnknown, relationData: NestedInsertOneItem][],
) => Promise<void>;

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
}

export const nestedInsert = ({
  query,
  primaryKeys,
  foreignKeys,
}: State): HasOneNestedInsert => {
  return (async (_, data) => {
    const t = query.clone();

    // array to store specific items will be reused
    const items: unknown[] = [];
    for (const item of data) {
      if (item[1].connect || item[1].connectOrCreate) {
        items.push(item);
      }
    }

    let connected: number[];
    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, item] = items[i] as [RecordUnknown, RecordUnknown];

        const data: RecordUnknown = {};
        primaryKeys.forEach((primaryKey, i) => {
          data[foreignKeys[i]] = selfData[primaryKey];
        });

        items[i] =
          'connect' in item
            ? _queryUpdateOrThrow(
                t.where(item.connect as WhereArg<Query>) as never,
                data as never,
              )
            : _queryUpdate(
                t.where(
                  (item.connectOrCreate as RecordUnknown)
                    .where as WhereArg<Query>,
                ) as never,
                data as never,
              );
      }

      connected = (await Promise.all(items)) as number[];
    } else {
      connected = [];
    }

    let connectedI = 0;
    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        if (!connected[connectedI++]) {
          items.push(item);
        }
      } else if (item[1].create) {
        items.push(item);
      }
    }

    if (items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const [selfData, item] = items[i] as [RecordUnknown, RecordUnknown];
        const data: RecordUnknown = {
          ...('create' in item
            ? (item.create as NestedInsertOneItemCreate)
            : (item.connectOrCreate as NestedInsertOneItemConnectOrCreate)
                .create),
        };

        for (let i = 0; i < primaryKeys.length; i++) {
          data[foreignKeys[i]] = selfData[primaryKeys[i]];
        }

        items[i] = data;
      }

      await t.insertMany(items as RecordUnknown[]);
    }
  }) as HasOneNestedInsert;
};

export const hasOneCreate = (
  key: string,
  state: State,
  nestedInsertFn: HasOneNestedInsert,
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
      values: RecordUnknown[];
    }

    interface NestedCreateItems {
      create?: NestedCreateItem;
      connect?: NestedCreateItem;
      connectOrCreate?: NestedCreateItem;
    }

    const { query: rel, primaryKeys, foreignKeys } = state;

    let nestedCreateItems: NestedCreateItems | undefined;

    items.forEach((item, i) => {
      const value = item[key] as NestedInsertOneItem;
      const kind = value.create
        ? 'create'
        : value.connect
          ? 'connect'
          : 'connectOrCreate';

      if (kind) {
        const nestedCreateItem = ((nestedCreateItems ??= {})[kind] ??= {
          indexes: [],
          items: [],
          values: [],
        });
        nestedCreateItem.indexes.push(rowIndexes[i]);
        nestedCreateItem.values.push(value[kind] as RecordUnknown);

        const data = value.create ? { ...value.create } : {};

        for (const key of foreignKeys) {
          data[key] = new RawSql('');
        }

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
        foreignKeys.forEach((key, keyI) => {
          const primaryKey = aliasedPrimaryKeys[keyI];
          for (let i = 0; i < connect.items.length; i++) {
            (connect.items[i][key] as RawSql)._sql = selectCteColumnFromManySql(
              upsertCreateAs as string,
              primaryKey,
              connect.indexes[i],
              count,
            );
          }
        });
      }

      if (connectOrCreate) {
        foreignKeys.forEach((key, keyI) => {
          const primaryKey = aliasedPrimaryKeys[keyI];
          for (let i = 0; i < connectOrCreate.items.length; i++) {
            (connectOrCreate.items[i][key] as RawSql)._sql =
              selectCteColumnFromManySql(
                upsertCreateAs as string,
                primaryKey,
                connectOrCreate.indexes[i],
                count,
              );
          }
        });
      }
    };

    _hookSelectColumns(querySelf, primaryKeys, (aliasedPrimaryKeys) => {
      createAliasedPrimaryKeys = aliasedPrimaryKeys;

      foreignKeys.forEach((key, keyI) => {
        const primaryKey = aliasedPrimaryKeys[keyI];

        if (create && createAs) {
          for (let i = 0; i < create.items.length; i++) {
            (create.items[i][key] as RawSql)._sql = selectCteColumnFromManySql(
              createAs,
              primaryKey,
              create.indexes[i],
              count,
            );
          }
        }

        if (connect && connectAs) {
          for (let i = 0; i < connect.items.length; i++) {
            (connect.items[i][key] as RawSql)._sql = selectCteColumnFromManySql(
              connectAs,
              primaryKey,
              connect.indexes[i],
              count,
            );
          }
        }

        if (connectOrCreate && connectOrCreateAs) {
          for (let i = 0; i < connectOrCreate.items.length; i++) {
            (connectOrCreate.items[i][key] as RawSql)._sql =
              selectCteColumnFromManySql(
                connectOrCreateAs,
                primaryKey,
                connectOrCreate.indexes[i],
                count,
              );
          }
        }
      });

      setUpsertCreatePlaceholders();
    });

    const { create, connect, connectOrCreate } = nestedCreateItems;

    if (create) {
      let query: Query;
      if (querySelf.q.type === 'upsert') {
        createWhereExists = new RawSql('');
        createSelectAs = {};
        for (const key of foreignKeys) {
          createSelectAs[key] = new RawSql('');
        }

        const sourceQuery = _queryWhere(
          _queryTake(_querySelect(_clone(rel.qb), [createSelectAs as never])),
          [createWhereExists] as never,
        );

        // Plain INSERT ... VALUES cannot render a WHERE guard, so upsert
        // nested create uses INSERT ... SELECT FROM a guarded one-row query.
        query = _queryInsertManyFrom(
          _clone(rel) as unknown as CreateSelf,
          sourceQuery as never,
          create.items as never,
        ) as unknown as Query;
      } else {
        query = _queryInsertMany(
          _clone(rel) as unknown as CreateSelf,
          create.items as never,
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
          rel.where(value as never) as unknown as UpdateSelf,
          connect.items[i] as never,
        ) as unknown as Query;

        if (connectWhereExists) {
          // Only run nested connect when the parent upsert actually created a row.
          _queryWhere(query, [connectWhereExists] as never);
        }

        query.q.ensureCount = { expected: 1 };

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
      connectOrCreate.values.forEach((value, i) => {
        const foreignKeyValues = connectOrCreate.items[i];
        const connectOrCreateWhereExists =
          querySelf.q.type === 'upsert' ? new RawSql('') : undefined;
        const connectOrCreateSelectAs: RecordUnknown = {};
        if (connectOrCreateWhereExists) {
          for (const key of foreignKeys) {
            const value = foreignKeyValues[key] as RawSql;
            // These RawSql placeholders are selected by the insertFrom
            // source query, so select parsing needs the target column type.
            value.result = {
              value: rel.qb.shape[key],
            };
            connectOrCreateSelectAs[key] = value;
          }
        }

        const query = _queryUpsert(rel.where(value.where as never) as Query, {
          update: foreignKeyValues,
          create: {
            ...(value.create as RecordUnknown),
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
              _querySelect(_clone(rel.qb), [{ one: new RawSql('1') }]),
            ),
            [connectOrCreateWhereExists] as never,
          );

          const sourceQuery = _querySelect(
            (_clone(rel.qb) as Query).from(guardQuery as never),
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
