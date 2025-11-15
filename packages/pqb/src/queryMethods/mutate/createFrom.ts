import {
  ColumnTypeBase,
  IsQuery,
  MaybeArray,
  QueryColumns,
  RecordUnknown,
} from '../../core';
import { _clone } from '../../query/queryUtils';
import {
  createCtx,
  CreateData,
  createSelect,
  CreateSelf,
  handleManyData,
  handleOneData,
  insert,
  throwOnReadOnly,
} from './create';
import {
  Query,
  SetQueryKind,
  SetQueryReturnsAllKind,
  SetQueryReturnsColumnKind,
  SetQueryReturnsOneKind,
  SetQueryReturnsPluckColumnKind,
  SetQueryReturnsRowCount,
  SetQueryReturnsRowCountMany,
  queryTypeWithLimitOne,
} from '../../query/query';
import { InsertQueryDataObjectValues, QueryData } from '../../sql/data';

export type CreateFromMethodNames =
  | 'createOneFrom'
  | 'insertOneFrom'
  | CreateManyFromMethodNames;

export type CreateManyFromMethodNames =
  | 'createManyFrom'
  | 'insertManyFrom'
  | 'createForEachFrom'
  | 'insertForEachFrom';

interface QueryReturningOne extends IsQuery {
  result: QueryColumns;
  returnType: 'one' | 'oneOrThrow';
}

type CreateRawOrFromResult<T extends CreateSelf> = T extends { isCount: true }
  ? SetQueryKind<T, 'create'>
  : T['returnType'] extends undefined | 'all'
  ? SetQueryReturnsOneKind<T, 'create'>
  : T['returnType'] extends 'pluck'
  ? SetQueryReturnsColumnKind<T, 'create'>
  : SetQueryKind<T, 'create'>;

type InsertRawOrFromResult<T extends CreateSelf> =
  T['meta']['hasSelect'] extends true
    ? T['returnType'] extends undefined | 'all'
      ? SetQueryReturnsOneKind<T, 'create'>
      : T['returnType'] extends 'pluck'
      ? SetQueryReturnsColumnKind<T, 'create'>
      : SetQueryKind<T, 'create'>
    : SetQueryReturnsRowCount<T, 'create'>;

type CreateManyFromResult<T extends CreateSelf> = T extends {
  isCount: true;
}
  ? SetQueryKind<T, 'create'>
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAllKind<T, 'create'>
  : T['returnType'] extends 'value' | 'valueOrThrow'
  ? SetQueryReturnsPluckColumnKind<T, 'create'>
  : SetQueryKind<T, 'create'>;

type InsertManyFromResult<T extends CreateSelf> =
  T['meta']['hasSelect'] extends true
    ? T['returnType'] extends 'one' | 'oneOrThrow'
      ? SetQueryReturnsAllKind<T, 'create'>
      : T['returnType'] extends 'value' | 'valueOrThrow'
      ? SetQueryReturnsPluckColumnKind<T, 'create'>
      : SetQueryKind<T, 'create'>
    : SetQueryReturnsRowCountMany<T, 'create'>;

/**
 * Is used by all create from queries methods.
 * Collects columns and values from the inner query and optionally from the given data,
 * calls {@link insert} with a 'from' kind of create query.
 *
 * @param query - query object.
 * @param from - inner query from which to create new records.
 * @param many - whether is createManyFrom or createForEachFrom.
 * @param queryMany - whether is createForEachFrom
 * @param data - optionally passed custom data when creating a single record.
 */
const insertFrom = (
  query: CreateSelf,
  from: IsQuery,
  many?: boolean,
  queryMany?: boolean,
  data?: MaybeArray<RecordUnknown>,
): CreateSelf => {
  const ctx = createCtx();

  const obj =
    data &&
    (Array.isArray(data)
      ? handleManyData(query, data, ctx)
      : handleOneData(query, data, ctx));

  return insert(
    query,
    {
      insertFrom: from,
      columns: obj?.columns || [],
      values: obj?.values || [],
    },
    many,
    queryMany,
  );
};

/**
 * Function to collect column names from the inner query of create `from` methods.
 *
 * @param q - the creating query
 * @param from - inner query to grab the columns from.
 * @param obj - optionally passed object with specific data, only available when creating a single record.
 * @param many - whether it's for `createForEachFrom`. If no, throws if the inner query returns multiple records.
 */
export const getFromSelectColumns = (
  q: CreateSelf,
  from: CreateSelf,
  obj?: {
    columns: string[];
    values: QueryData['values'];
  },
  many?: boolean,
): {
  columns: string[];
  queryColumnsCount: number;
  values: InsertQueryDataObjectValues;
} => {
  if (!many && !queryTypeWithLimitOne[(from as Query).q.returnType as string]) {
    throw new Error(
      'Cannot create based on a query which returns multiple records',
    );
  }

  const queryColumns = new Set<string>();
  (from as Query).q.select?.forEach((item) => {
    if (typeof item === 'string') {
      const index = item.indexOf('.');
      queryColumns.add(index === -1 ? item : item.slice(index + 1));
    } else if (item && 'selectAs' in item) {
      for (const column in item.selectAs) {
        queryColumns.add(column);
      }
    }
  });

  const allColumns = new Set<string>(queryColumns);
  const queryColumnsCount = queryColumns.size;
  const allValues: unknown[][] = [];
  if (obj?.columns) {
    for (const objectValues of obj.values as InsertQueryDataObjectValues) {
      const values: unknown[] = [];
      allValues.push(values);

      obj.columns.forEach((column, i) => {
        if (!queryColumns.has(column)) {
          allColumns.add(column);
          values.push(objectValues[i]);
        }
      });
    }
  }

  for (const key of queryColumns) {
    const column = q.shape[key] as ColumnTypeBase;
    if (column) throwOnReadOnly(from, column, key);
  }

  return {
    columns: [...allColumns],
    queryColumnsCount,
    values: allValues,
  };
};

export const _queryCreateOneFrom = <
  T extends CreateSelf,
  Q extends QueryReturningOne,
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T>, keyof Q['result']>,
): CreateRawOrFromResult<T> => {
  createSelect(q as unknown as Query);
  return insertFrom(q, query, false, false, data) as never;
};

export const _queryInsertOneFrom = <
  T extends CreateSelf,
  Q extends QueryReturningOne,
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T>, keyof Q['result']>,
): InsertRawOrFromResult<T> => {
  return insertFrom(q, query, false, false, data) as never;
};

export const _queryCreateManyFrom = <
  T extends CreateSelf,
  Q extends QueryReturningOne,
>(
  q: T,
  query: Q,
  data: Omit<CreateData<T>, keyof Q['result']>[],
): CreateManyFromResult<T> => {
  createSelect(q as unknown as Query);
  return insertFrom(q, query, true, false, data) as never;
};

export const _queryInsertManyFrom = <
  T extends CreateSelf,
  Q extends QueryReturningOne,
>(
  q: T,
  query: Q,
  data: Omit<CreateData<T>, keyof Q['result']>[],
): InsertManyFromResult<T> => {
  return insertFrom(q, query, true, false, data) as never;
};

export const _queryCreateForEachFrom = <T extends CreateSelf>(
  q: T,
  query: IsQuery,
): CreateManyFromResult<T> => {
  createSelect(q as unknown as Query);
  return insertFrom(q, query, true, true) as never;
};

export const _queryInsertForEachFrom = <T extends CreateSelf>(
  q: T,
  query: IsQuery,
): InsertManyFromResult<T> => {
  return insertFrom(q, query, true, true) as never;
};

export class QueryCreateFrom {
  /**
   * Inserts a single record based on a query that selects a single record.
   *
   * Performs a single SQL query based on `INSERT ... SELECT ... FROM`.
   *
   * See {@link createManyFrom} to insert multiple records based on a single record query,
   * and {@link createForEachFrom} to insert a record per every one found by the query.
   *
   * The first argument is a query of a **single** record, it should have `find`, `take`, or similar.
   *
   * The second optional argument is a data which will be merged with columns returned by the query.
   *
   * The data for the second argument is the same as in {@link create}.
   *
   * Columns with runtime defaults (defined with a callback) are supported here.
   * The value for such a column will be injected unless selected from a related table or provided in a data object.
   *
   * ```ts
   * const oneRecord = await db.table.createOneFrom(
   *   db.relatedTable
   *     // use select to map columns from one table to another
   *     .select({
   *       // relatedTable's id will be inserted as "relatedId"
   *       relatedId: 'id',
   *     })
   *     .findBy({ key: 'value' }),
   *   // optional argument:
   *   {
   *     key: 'value',
   *     // supports sql, nested select, create, update, delete queries
   *     fromSql: () => sql`custom sql`,
   *     fromQuery: () => db.otherTable.find(id).update(data).get('column'),
   *     fromRelated: (q) => q.relatedTable.create(data).get('column'),
   *   },
   * );
   * ```
   *
   * The query above will produce such a SQL (omitting `from*` values):
   *
   * ```sql
   * INSERT INTO "table"("relatedId", "key")
   * SELECT "relatedTable"."id" AS "relatedId", 'value'
   * FROM "relatedTable"
   * WHERE "relatedTable"."key" = 'value'
   * LIMIT 1
   * RETURNING *
   * ```
   *
   * @param query - query to create new records from
   * @param data - additionally you can set some columns
   */
  createOneFrom<T extends CreateSelf, Q extends QueryReturningOne>(
    this: T,
    query: Q,
    data?: Omit<CreateData<T>, keyof Q['result']>,
  ): CreateRawOrFromResult<T> {
    return _queryCreateOneFrom(_clone(this) as never, query, data);
  }

  /**
   * Works exactly as {@link createOneFrom}, except that it returns inserted row count by default.
   *
   * @param query - query to create new records from
   * @param data - additionally you can set some columns
   */
  insertOneFrom<T extends CreateSelf, Q extends QueryReturningOne>(
    this: T,
    query: Q,
    data?: Omit<CreateData<T>, keyof Q['result']>,
  ): InsertRawOrFromResult<T> {
    return _queryInsertOneFrom(_clone(this) as never, query, data);
  }

  /**
   * Inserts multiple records based on a query that selects a single record.
   *
   * Performs a single SQL query based on `INSERT ... SELECT ... FROM`.
   *
   * See {@link createOneFrom} to insert a single record based on a single record query,
   * and {@link createForEachFrom} to insert a record per every one found by the query.
   *
   * The first argument is a query of a **single** record, it should have `find`, `take`, or similar.
   *
   * The second argument is array of objects to be merged with columns returned by the query.
   *
   * The data for the second argument is the same as in {@link createMany}.
   *
   * Columns with runtime defaults (defined with a callback) are supported here.
   * The value for such a column will be injected unless selected from a related table or provided in a data object.
   *
   * ```ts
   * const twoRecords = await db.table.createManyFrom(
   *   db.relatedTable
   *     // use select to map columns from one table to another
   *     .select({
   *       // relatedTable's id will be inserted as "relatedId"
   *       relatedId: 'id',
   *     })
   *     .findBy({ key: 'value' }),
   *   [
   *     {
   *       key: 'value 1',
   *       // supports sql, nested select, create, update, delete queries
   *       fromSql: () => sql`custom sql`,
   *       fromQuery: () => db.otherTable.find(id).update(data).get('column'),
   *       fromRelated: (q) => q.relatedTable.create(data).get('column'),
   *     },
   *     {
   *       key: 'value 2',
   *     },
   *   ],
   * );
   * ```
   *
   * The query above will produce such a SQL (omitting `from*` values):
   *
   * ```sql
   * WITH "relatedTable" AS (
   *   SELECT "relatedTable"."id" AS "relatedId", 'value'
   *   FROM "relatedTable"
   *   WHERE "relatedTable"."key" = 'value'
   *   LIMIT 1
   * )
   * INSERT INTO "table"("relatedId", "key")
   * SELECT "relatedTable".*, v."key"::text
   * FROM "relatedTable", (VALUES ('value1'), ('value2')) v("key")
   * RETURNING *
   * ```
   *
   * @param query - query to create new records from
   * @param data - array of records to create
   */
  createManyFrom<T extends CreateSelf, Q extends QueryReturningOne>(
    this: T,
    query: Q,
    data: Omit<CreateData<T>, keyof Q['result']>[],
  ): CreateManyFromResult<T> {
    return _queryCreateManyFrom(_clone(this) as never, query, data);
  }

  /**
   * Works exactly as {@link createManyFrom}, except that it returns inserted row count by default.
   *
   * @param query - query to create new records from
   * @param data - array of records to create
   */
  insertManyFrom<T extends CreateSelf, Q extends QueryReturningOne>(
    this: T,
    query: Q,
    data: Omit<CreateData<T>, keyof Q['result']>[],
  ): InsertManyFromResult<T> {
    return _queryInsertManyFrom(_clone(this) as never, query, data);
  }

  /**
   * Inserts a single record per every record found in a given query.
   *
   * Performs a single SQL query based on `INSERT ... SELECT ... FROM`.
   *
   * Unlike {@link createOneFrom}, it doesn't accept second argument with data.
   *
   * Runtime defaults cannot work with it.
   *
   * ```ts
   * const manyRecords = await db.table.createForEachFrom(
   *   RelatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
   * );
   * ```
   *
   * @param query - query to create new records from
   */
  createForEachFrom<T extends CreateSelf>(
    this: T,
    query: IsQuery,
  ): CreateManyFromResult<T> {
    return _queryCreateForEachFrom(_clone(this) as never, query);
  }

  /**
   * Works exactly as {@link createForEachFrom}, except that it returns inserted row count by default.
   *
   * @param query - query to create new records from
   */
  insertForEachFrom<T extends CreateSelf>(
    this: T,
    query: IsQuery,
  ): InsertManyFromResult<T> {
    return _queryInsertForEachFrom(_clone(this) as never, query);
  }
}
