import { Query } from 'pqb';
import {
  CreateCtx,
  CreateSelf,
  getFreeAlias,
  RawSql,
  RecordUnknown,
  _orCreate,
  _prependWith,
  _queryWhere,
  _querySelect,
  _queryTake,
  _queryInsertMany,
  _queryInsertManyFrom,
  _clone,
  _onUpsertUpdate,
  _prependWithOnUpsertCreate,
} from 'pqb/internal';
import {
  NestedInsertOneItemCreate,
  selectCteColumnFromManySql,
  selectCteColumnMustExistSql,
  setForeignKeysFromCte,
} from '../common/utils';
import { RelationToOneDataForCreateSameQuery } from '../relations';

export interface BelongsToDataForCreate<
  Name extends string,
  FK extends string,
  Required,
  Q extends Query,
> {
  columns: FK;
  nested: Q extends Query.Pick.IsNotReadOnly
    ? Required extends true
      ? {
          [Key in Name]: RelationToOneDataForCreateSameQuery<Q>;
        }
      : {
          [Key in Name]?: RelationToOneDataForCreateSameQuery<Q>;
        }
    : {
        [Key in Name]?: never;
      };
}

export interface BelongsToCreateState {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
}

export const belongsToCreate = (
  key: string,
  state: BelongsToCreateState,
  q: CreateSelf,
  ctx: CreateCtx,
  items: RecordUnknown[],
) => {
  const queryForCreate = q as unknown as Query;
  const { query, primaryKeys, foreignKeys } = state;

  interface NestedCreateItem {
    items: RecordUnknown[];
    values: RecordUnknown[];
  }

  interface NestedCreateItems {
    create?: NestedCreateItem;
    connect?: NestedCreateItem;
    connectOrCreate?: NestedCreateItem;
  }

  let nestedCreateItems: NestedCreateItems | undefined;

  items.forEach((item) => {
    const value = item[key] as NestedInsertOneItemCreate;
    const kind = value.create
      ? 'create'
      : value.connect
        ? 'connect'
        : value.connectOrCreate
          ? 'connectOrCreate'
          : undefined;

    if (kind) {
      const nestedCreateItem = ((nestedCreateItems ??= {})[kind] ??= {
        items: [],
        values: [],
      });
      nestedCreateItem.items.push(item);
      nestedCreateItem.values.push(value[kind] as RecordUnknown);

      if (kind === 'create' || kind === 'connectOrCreate') {
        for (const key of foreignKeys) {
          item[key] = new RawSql('');
        }
      }
    }
  });

  if (!nestedCreateItems) {
    return;
  }

  for (const key of foreignKeys) {
    if (!ctx.columns.has(key)) {
      ctx.columns.set(key, ctx.columns.size);
    }
  }

  const { create, connect, connectOrCreate } = nestedCreateItems;
  if (create) {
    const selectPKeys = query.select(...primaryKeys);

    let createQuery: Query;
    if (queryForCreate.q.type === 'upsert') {
      const createWhereNotExists = new RawSql('');
      _onUpsertUpdate(queryForCreate, (as) => {
        createWhereNotExists._sql = `NOT EXISTS (SELECT 1 FROM "${as}")`;
      });

      const sourceQuery = _queryWhere(
        _queryTake(_querySelect(_clone(query.qb), [{}])),
        [createWhereNotExists] as never,
      );

      // Plain INSERT ... VALUES cannot render a WHERE guard, so upsert
      // nested create uses INSERT ... SELECT FROM a guarded one-row query.
      createQuery = _queryInsertManyFrom(
        selectPKeys as unknown as CreateSelf,
        sourceQuery as never,
        create.values,
      ) as unknown as Query;
    } else {
      createQuery = _queryInsertMany(
        selectPKeys as unknown as CreateSelf,
        create.values,
      ) as unknown as Query;
    }

    const setForeignKeys = (as: string) => {
      const count = create.items.length;
      foreignKeys.forEach((foreignKey, i) => {
        const primaryKey = primaryKeys[i];
        create.items.forEach((item, i) => {
          (item[foreignKey] as RawSql)._sql = selectCteColumnFromManySql(
            as,
            primaryKey,
            i,
            count,
          );
        });
      });
    };

    if (queryForCreate.q.type === 'upsert') {
      _prependWithOnUpsertCreate(queryForCreate, setForeignKeys, createQuery);
    } else {
      _prependWith(queryForCreate, setForeignKeys, createQuery);
    }
  }

  if (connect) {
    connect.values.forEach((value, itemI) => {
      const as = getFreeAlias(queryForCreate.q.withShapes, 'q');
      const prependWith =
        queryForCreate.q.type === 'upsert'
          ? _prependWithOnUpsertCreate
          : _prependWith;

      prependWith(
        queryForCreate,
        as,
        query.select(...primaryKeys).findBy(value),
      );

      foreignKeys.map((foreignKey, i) => {
        connect.items[itemI][foreignKey] = new RawSql(
          selectCteColumnMustExistSql(i, as, primaryKeys[i]),
        );
      });
    });
  }

  if (connectOrCreate) {
    connectOrCreate.values.forEach((value, itemI) => {
      const asFn = setForeignKeysFromCte(
        connectOrCreate.items[itemI],
        primaryKeys,
        foreignKeys,
      );

      const selectPKeys = query.select(...primaryKeys);

      const prependWith =
        queryForCreate.q.type === 'upsert'
          ? _prependWithOnUpsertCreate
          : _prependWith;

      prependWith(
        queryForCreate,
        asFn,
        _orCreate(
          _queryWhere(selectPKeys, [(value as { where: never }).where]),
          (value as { create: never }).create,
        ),
      );
    });
  }
};
