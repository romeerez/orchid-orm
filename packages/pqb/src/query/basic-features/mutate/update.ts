import {
  isQuery,
  Query,
  QueryOrExpression,
  SetQueryReturnsAllResult,
  SetQueryReturnsPluckColumnResult,
  SetQueryReturnsRowCount,
  SetQueryReturnsRowCountMany,
  SetQueryResult,
} from '../../query';
import { throwIfNoWhere } from '../../query.utils';
import { QueryHasWhere } from '../where/where';
import {
  anyShape,
  Column,
  ColumnSchemaConfig,
  VirtualColumn,
} from '../../../columns';
import {
  _joinReturningArgs,
  JoinArgs,
  JoinCallbackArgs,
  JoinFirstArg,
  JoinResultFromArgs,
  joinSubQuery,
} from '../join/join';
import { _queryNone } from '../../extra-features/none/none';
import {
  PickQueryAs,
  PickQueryHasSelect,
  PickQueryHasWhere,
  PickQueryInputType,
  PickQueryRelations,
  PickQueryResult,
  PickQueryReturnType,
  PickQuerySelectable,
  PickQueryShape,
  PickQueryResultReturnTypeUniqueColumns,
  PickQueryUniqueProperties,
  PickQueryWithData,
} from '../../pick-query-types';
import { EmptyObject, RecordUnknown } from '../../../utils';
import { RelationConfigBase } from '../../relations';
import { Expression, isExpression } from '../../expressions/expression';
import { _clone } from '../clone/clone';
import { OrchidOrmInternalError } from '../../errors';
import { requirePrimaryKeys } from '../../query-columns/primary-keys';
import { resolveSubQueryCallback } from '../../sub-query/sub-query';
import { pushQueryValueImmutable } from '../../query-data';
import { ToSQLQuery } from '../../sql/to-sql';

export interface UpdateSelf
  extends PickQuerySelectable,
    PickQueryResult,
    PickQueryRelations,
    PickQueryWithData,
    PickQueryReturnType,
    PickQueryShape,
    PickQueryInputType,
    PickQueryAs,
    PickQueryHasSelect,
    PickQueryHasWhere {}

// Type of argument for `update` and `updateOrThrow`
//
// It maps the `inputType` of a table into object with column values.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
//
// It enables all forms of relation operations such as nested `create`, `connect`, etc.
export type UpdateData<T extends UpdateSelf> =
  EmptyObject extends T['relations']
    ? {
        [K in keyof T['inputType']]?: UpdateColumn<T, K>;
      }
    : {
        [K in
          | keyof T['inputType']
          | keyof T['relations']]?: K extends keyof T['inputType']
          ? UpdateColumn<T, K>
          : UpdateRelationData<T, T['relations'][K]>;
      };

// Type of available variants to provide for a specific column when updating.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
type UpdateColumn<T extends UpdateSelf, Key extends keyof T['inputType']> =
  | T['inputType'][Key]
  | ((q: {
      [K in keyof T['relations'] | keyof T]: K extends keyof T['relations']
        ? T['relations'][K]['query']
        : K extends keyof T
        ? T[K]
        : never;
    }) => QueryOrExpression<T['inputType'][Key]>);

// Add relation operations to the update argument.
type UpdateRelationData<
  T extends UpdateSelf,
  Rel extends RelationConfigBase,
> = T['returnType'] extends undefined | 'all'
  ? Rel['dataForUpdate']
  : Rel['dataForUpdateOne'];

// Type of argument for `update`.
// not available when there are no conditions on the query.
export type UpdateArg<T extends UpdateSelf> = T['__hasWhere'] extends true
  ? UpdateData<T>
  : 'Update statement must have where conditions. To update all prefix `update` with `all()`';

// `update` and `updateOrThrow` methods output type.
// Unless something was explicitly selected on the query, it's returning the count of updated records.
type UpdateResult<T extends UpdateSelf> = T['__hasSelect'] extends true
  ? T
  : T['returnType'] extends undefined | 'all'
  ? SetQueryReturnsRowCountMany<T>
  : SetQueryReturnsRowCount<T>;

export type NumericColumns<T extends UpdateSelf> = {
  [K in keyof T['inputType']]: Exclude<
    T['shape'][K]['queryType'],
    string
  > extends number | bigint | null
    ? K
    : never;
}[keyof T['inputType']];

// `increment` and `decrement` methods argument type.
// Accepts a column name to change, or an object with column names and number values to increment or decrement with.
export type ChangeCountArg<T extends UpdateSelf> =
  | NumericColumns<T>
  | {
      [K in NumericColumns<T>]?: T['shape'][K]['type'] extends number | null
        ? number
        : number | string | bigint;
    };

export interface UpdateCtxCollect {
  data: RecordUnknown;
}

const throwOnReadOnly = (q: unknown, column: Column.Pick.Data, key: string) => {
  if (column.data.appReadOnly || column.data.readOnly) {
    throw new OrchidOrmInternalError(
      q as Query,
      'Trying to update a readonly column',
      { column: key },
    );
  }
};

// Helper: require PK columns with their query types (for WHERE matching)
type ShapePrimaryKeyQueryTypes<Shape extends Column.QueryColumns> = {
  [K in keyof Shape as Shape[K] extends { data: { primaryKey: string } }
    ? K
    : never]: Shape[K]['queryType'];
};

// `type` instead of `interface`: PickQueryResultReturnTypeUniqueColumns and
// PickQueryUniqueProperties both declare `internal` with different shapes,
// which `interface extends` cannot merge.
type UpdateManyBySelf = UpdateSelf &
  PickQueryResultReturnTypeUniqueColumns &
  PickQueryUniqueProperties;

// Data type for updateMany / updateManyOptional (PK-based)
type UpdateManyData<T extends UpdateSelf> = (ShapePrimaryKeyQueryTypes<
  T['shape']
> & {
  [P in keyof T['inputType']]?: T['inputType'][P] | Expression;
})[];

// Valid keys for updateManyBy: a single unique column name or a compound tuple
type UpdateManyByKeys<T extends UpdateManyBySelf> =
  | T['internal']['uniqueColumnNames']
  | T['internal']['uniqueColumnTuples'];

// Extract key column names from a string or tuple
type UpdateManyByKeyColumns<Keys> = Keys extends string
  ? Keys
  : Keys extends unknown[]
  ? Keys[number] & string
  : never;

// Data type for updateManyBy / updateManyByOptional (custom keys)
// Inlined to minimize mapped type instantiations
type UpdateManyByData<T extends UpdateSelf, K extends string> = ({
  [P in K & keyof T['inputType']]-?: T['inputType'][P];
} & {
  [P in keyof T['inputType'] as P extends K ? never : P]?:
    | T['inputType'][P]
    | Expression;
})[];

// Return type for updateMany/updateManyBy — mirrors InsertManyResult
type UpdateManyResult<T extends UpdateSelf> = T['__hasSelect'] extends true
  ? T['returnType'] extends 'one' | 'oneOrThrow'
    ? SetQueryReturnsAllResult<T, T['result']>
    : T['returnType'] extends 'value' | 'valueOrThrow'
    ? SetQueryReturnsPluckColumnResult<T, T['result']>
    : SetQueryResult<T, T['result']>
  : SetQueryReturnsRowCountMany<T>;

const _queryUpdateMany = <T extends UpdateSelf>(
  self: T,
  keys: string[],
  data: RecordUnknown[],
  strict: boolean,
): T => {
  const query = self as unknown as Query;
  const { q } = query;

  // Keys validation
  if (!keys.length) {
    throw new OrchidOrmInternalError(
      query,
      'updateMany requires at least one key column',
    );
  }
  const { shape } = q;
  for (const key of keys) {
    if (!shape[key]) {
      throw new OrchidOrmInternalError(query, `Unknown key column: ${key}`, {
        column: key,
      });
    }
  }

  // Normalize return type
  q.type = 'update';
  const returnCount = !q.select;
  if (returnCount) {
    if (q.returnType !== 'void') {
      q.returningMany = true;
      q.returnType = 'valueOrThrow';
      q.returning = true;
    }
  } else {
    // When select is present, ensure many-return semantics
    const rt = q.returnType;
    if (rt === 'one' || rt === 'oneOrThrow') {
      q.returningMany = true;
      q.returnType = 'all';
    } else if (rt === 'value' || rt === 'valueOrThrow') {
      q.returningMany = true;
      q.returnType = 'pluck';
    } else {
      q.returningMany = !rt || rt === 'all';
    }
  }

  if (!data.length) {
    return _queryNone(query) as never;
  }

  // Validate keys, check for duplicates, determine setColumns, validate consistency
  const seenKeys = new Set<string>();
  const keysSet = new Set(keys);
  const setColumns: string[] = [];
  let setColumnsSet = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Key validation + dedup
    const keyParts: unknown[] = [];
    for (const key of keys) {
      const val = row[key];
      if (isExpression(val)) {
        throw new OrchidOrmInternalError(
          query,
          `Key column "${key}" must be a concrete value, not an expression, in row ${i}`,
        );
      }
      keyParts.push(val);
    }
    const keyStr =
      keyParts.length === 1 ? String(keyParts[0]) : JSON.stringify(keyParts);
    if (seenKeys.has(keyStr)) {
      throw new OrchidOrmInternalError(
        query,
        `Duplicate key in updateMany data at row ${i}`,
      );
    }
    seenKeys.add(keyStr);

    // Determine setColumns from first row, validate subsequent rows match
    const rowCols: string[] = [];
    for (const key in row) {
      if (keysSet.has(key)) continue;
      if (row[key] === undefined) continue;

      const column = shape[key];
      if (!column) continue;
      if (column.data.virtual) continue;
      throwOnReadOnly(query, column, key);

      rowCols.push(key);
    }

    if (i === 0) {
      setColumns.push(...rowCols);
      setColumnsSet = new Set(setColumns);
    } else if (
      rowCols.length !== setColumns.length ||
      rowCols.some((c) => !setColumnsSet.has(c))
    ) {
      throw new OrchidOrmInternalError(
        query,
        `Row ${i} has different columns than row 0. Expected: [${setColumns.join(
          ', ',
        )}], got: [${rowCols.join(', ')}]`,
      );
    }
  }

  const columns = [...keys, ...setColumns];

  const values: unknown[][] = [];
  for (const row of data) {
    const encoded: unknown[] = [];
    for (const col of columns) {
      let value = row[col];
      if (value !== null && value !== undefined && !isExpression(value)) {
        const encode = shape[col]?.data.encode;
        if (encode) value = encode(value);
      }
      encoded.push(value);
    }
    values.push(encoded);
  }

  q.updateMany = {
    keys,
    columns,
    setColumns,
    values,
    count: data.length,
    strict,
  };

  return query as never;
};

// apply `increment` or a `decrement`,
// mutates the `queryData` of a query.
export const _queryChangeCounter = <T extends UpdateSelf>(
  self: T,
  op: string,
  data: ChangeCountArg<T>,
) => {
  const q = (self as unknown as Query).q;
  q.type = 'update';

  if (!q.select) {
    if (q.returnType === 'oneOrThrow' || q.returnType === 'valueOrThrow') {
      q.throwOnNotFound = true;
    }
    q.returningMany = !q.returnType || q.returnType === 'all';
    q.returnType = 'valueOrThrow';
    q.returning = true;
  }

  let map: { [K: string]: { op: string; arg: number } };
  if (typeof data === 'object') {
    map = {};
    for (const key in data) {
      map[key] = { op, arg: data[key as never] as number };

      const column = self.shape[key];
      if (column) {
        throwOnReadOnly(self, column as unknown as Column.Pick.Data, key);
      }
    }
  } else {
    map = { [data as string]: { op, arg: 1 } };

    const column = self.shape[data as string];
    if (column) {
      throwOnReadOnly(
        self,
        column as unknown as Column.Pick.Data,
        data as string,
      );
    }
  }

  pushQueryValueImmutable(self as unknown as Query, 'updateData', map);
  return self as never;
};

export const _queryUpdate = <T extends UpdateSelf>(
  updateSelf: T,
  arg: UpdateArg<T>,
): UpdateResult<T> => {
  const query = updateSelf as unknown as Query;
  const { q } = query;

  q.type = 'update';
  const returnCount = !q.select;

  const set = { ...(arg as RecordUnknown) };
  pushQueryValueImmutable(query, 'updateData', set);

  const { shape } = q;

  let selectQuery: Query | undefined;

  for (const key in arg) {
    const item = shape[key];
    if (!item && shape !== anyShape) {
      delete set[key];
    } else if (item.data.virtual) {
      (item as VirtualColumn<ColumnSchemaConfig>).update?.(query, set);
      delete set[key];
    } else {
      if (item) throwOnReadOnly(query, item, key);

      let value = set[key];
      if (typeof value === 'function') {
        if (!selectQuery) {
          selectQuery = query.clone();
          selectQuery.q.type = undefined;
        }

        value = resolveSubQueryCallback(
          selectQuery,
          value as (q: ToSQLQuery) => ToSQLQuery,
        );
        if (
          isQuery(value) &&
          (value as Query).q.type &&
          (value as Query).q.subQuery
        ) {
          throw new OrchidOrmInternalError(
            value,
            `Only selecting queries are allowed inside a callback of update, ${
              (value as Query).q.type
            } is given instead.`,
          );
        }

        set[key] = joinSubQuery(query, value as Query);
      }

      if (
        value !== null &&
        value !== undefined &&
        !isExpression(value) &&
        !isQuery(value)
      ) {
        const encode = item?.data.encode;
        if (encode) set[key] = encode(value);
      }
    }
  }

  // Skip returnType normalization when updateMany is set —
  // _queryUpdateMany already configured these, and .set() must not override them.
  if (returnCount && !q.updateMany) {
    q.returningMany = !q.returnType || q.returnType === 'all';
    q.returnType = 'valueOrThrow';
    q.returning = true;
  }

  // assuming conditions are set by `updateFrom` or `updateMany`
  if (!q.updateFrom && !q.updateMany) {
    throwIfNoWhere(query, 'update');
  }

  return query as never;
};

export const _queryUpdateOrThrow = <T extends UpdateSelf>(
  q: T,
  arg: UpdateArg<T>,
): UpdateResult<T> => {
  (q as unknown as Query).q.throwOnNotFound = true;
  return _queryUpdate(q, arg);
};

export class QueryUpdate {
  /**
   * `update` takes an object with columns and values to update records.
   *
   * By default, `update` will return a count of updated records.
   *
   * Use `select`, `selectAll`, `get`, or `pluck` alongside `update` to specify
   * returning columns.
   *
   * You need to provide `where`, `findBy`, or `find` conditions before calling `update`.
   * To ensure that the whole table won't be updated by accident, updating without where conditions will result in TypeScript and runtime errors.
   *
   * Use `all()` to update ALL records without conditions:
   *
   * ```ts
   * await db.table.all().update({ name: 'new name' });
   * ```
   *
   * If `select` and `where` were specified before the update it will return an array of updated records.
   *
   * If `select` and `take`, `find`, or similar were specified before the update it will return one updated record.
   *
   * For a column value you can provide a specific value, raw SQL, a query object that returns a single value, or a callback with a sub-query.
   *
   * The callback is allowed to select a single value from a relation (see `fromRelation` column below),
   * or to use a [jsonSet](/guide/advanced-queries.html#jsonset),
   * [jsonInsert](/guide/advanced-queries.html#jsoninsert),
   * and [jsonRemove](/guide/advanced-queries.html#jsonremove) for a JSON column (see `jsonColumn` below).
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // returns number of updated records by default
   * const updatedCount = await db.table
   *   .where({ name: 'old name' })
   *   .update({ name: 'new name' });
   *
   * // returning only `id`
   * const id = await db.table.find(1).get('id').update({ name: 'new name' });
   *
   * // `selectAll` + `find` will return a full record
   * const oneFullRecord = await db.table
   *   .selectAll()
   *   .find(1)
   *   .update({ name: 'new name' });
   *
   * // `selectAll` + `where` will return array of full records
   * const recordsArray = await db.table
   *   .select('id', 'name')
   *   .where({ id: 1 })
   *   .update({ name: 'new name' });
   *
   * await db.table.where({ ...conditions }).update({
   *   // set the column to a specific value
   *   value: 123,
   *
   *   // use custom SQL to update the column
   *   fromSql: () => sql`2 + 2`,
   *
   *   // use query that returns a single value
   *   // returning multiple values will result in Postgres error
   *   fromQuery: () => db.otherTable.get('someColumn'),
   *
   *   // select a single value from a related record
   *   fromRelation: (q) => q.relatedTable.get('someColumn'),
   *
   *   // set a new value to the `.foo.bar` path into a JSON column
   *   jsonColumn: (q) => q.jsonSet('jsonColumn', ['foo', 'bar'], 'new value'),
   * });
   * ```
   *
   * `update` can be used in [with](/guide/advanced-queries#with) expressions:
   *
   * ```ts
   * db.$qb
   *   // update record in one table
   *   .with('a', db.table.find(1).select('id').update(data))
   *   // update record in other table using the first table record id
   *   .with('b', (q) =>
   *     db.otherTable
   *       .find(1)
   *       .select('id')
   *       .update({
   *         ...otherData,
   *         aId: () => q.from('a').get('id'),
   *       }),
   *   )
   *   .from('b');
   *
   * `update` can be used in {@link WithMethods.with} expressions:
   *
   * ```ts
   * db.$qb
   *   // update record in one table
   *   .with('a', db.table.find(1).select('id').update(data))
   *   // update record in other table using the first table record id
   *   .with('b', (q) =>
   *     db.otherTable
   *       .find(1)
   *       .select('id')
   *       .update({
   *         ...otherData,
   *         aId: () => q.from('a').get('id'),
   *       }),
   *   )
   *   .from('b');
   * ```
   *
   * ### sub-queries
   *
   * In all `create`, `update`, `upsert` methods,
   * you can use sub queries that are either selecting a single value,
   * or creating/updating/deleting a record and return a single value.
   *
   * ```ts
   * await db.table.where({ ...conditions }).update({
   *   // `column` will be set to a value of the `otherColumn` of the created record.
   *   column: () => db.otherTable.get('otherColumn').create({ ...data }),
   *
   *   // `column2` will be set to a value of the `otherColumn` of the updated record.
   *   column2: () =>
   *     db.otherTable
   *       .get('otherColumn')
   *       .findBy({ ...conditions })
   *       .update({ key: 'value' }),
   *
   *   // `column3` will be set to a value of the `otherColumn` of the deleted record.
   *   column3: () =>
   *     db.otherTable
   *       .get('otherColumn')
   *       .findBy({ ...conditions })
   *       .delete(),
   * });
   * ```
   *
   * This is achieved by defining a `WITH` clause under the hood, it produces such a query:
   *
   * ```sql
   * WITH q AS (
   *   INSERT INTO "otherTable"(col1, col2, col3)
   *   VALUES ('val1', 'val2', 'val3')
   *   RETURNING "otherTable"."selectedColumn"
   * )
   * -- In a case of create
   * INSERT INTO "table"("column") VALUES ((SELECT * FROM "q"))
   * -- In a case of update
   * UPDATE "table"
   * SET "column" = (SELECT * FROM "q")
   * ```
   *
   * The query is atomic.
   * No changes will persist in the database if the sub-query fails, or if the top-level query fails, or if multiple rows are returned from a sub-query.
   *
   * [//]: # 'not supported in create because cannot query related records for a thing that is not created yet'
   * [//]: # 'modificational sub queries are not allowed in update because it would be too hard to join a with statement to the update query'
   *
   * Only selective sub-queries are supported in `update` queries when the sub-query is using a relation:
   *
   * ```ts
   * db.book.update({
   *   authorName: (q) => q.author.get('name'),
   * });
   * ```
   *
   * ### null, undefined, unknown columns
   *
   * - `null` value will set a column to `NULL`
   * - `undefined` value will be ignored
   * - unknown columns will be ignored
   *
   * ```ts
   * db.table.findBy({ id: 1 }).update({
   *   name: null, // updates to null
   *   age: undefined, // skipped, no effect
   *   lalala: 123, // skipped
   * });
   * ```
   *
   * ### empty set
   *
   * When trying to query update with an empty object, it will be transformed seamlessly to a `SELECT` query:
   *
   * ```ts
   * // imagine the data is an empty object
   * const data = req.body;
   *
   * // query is transformed to `SELECT count(*) WHERE key = 'value'`
   * const count = await db.table.where({ key: 'value' }).update(data);
   *
   * // will select a full record by id
   * const record = await db.table.find(1).selectAll().update(data);
   *
   * // will select a single column by id
   * const name = await db.table.find(1).get('name').update(data);
   * ```
   *
   * If the table has `updatedAt` [timestamp](/guide/common-column-methods.html#timestamps), it will be updated even for an empty data.
   *
   * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
   */
  update<T extends UpdateSelf>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    return _queryUpdate(_clone(this), arg as never) as never;
  }

  /**
   * To make sure that at least one row was updated use `updateOrThrow`:
   *
   * ```ts
   * import { NotFoundError } from 'orchid-orm';
   *
   * try {
   *   // updatedCount is guaranteed to be greater than 0
   *   const updatedCount = await db.table
   *     .where(conditions)
   *     .updateOrThrow({ name: 'name' });
   *
   *   // updatedRecords is guaranteed to be a non-empty array
   *   const updatedRecords = await db.table
   *     .where(conditions)
   *     .select('id')
   *     .updateOrThrow({ name: 'name' });
   * } catch (err) {
   *   if (err instanceof NotFoundError) {
   *     // handle error
   *   }
   * }
   * ```
   *
   * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
   */
  updateOrThrow<T extends UpdateSelf>(
    this: T,
    arg: UpdateArg<T>,
  ): UpdateResult<T> {
    return _queryUpdateOrThrow(_clone(this), arg as never) as never;
  }

  /**
   * Use `updateFrom` to update records in one table based on a query result from another table or CTE.
   *
   * `updateFrom` accepts the same arguments as {@link Query.join}.
   *
   * ```ts
   * // save all author names to their books by using a relation name:
   * db.books.updateFrom('author').set({ authorName: (q) => q.ref('author.name') });
   *
   * // update from authors that match the condition:
   * db.books
   *   .updateFrom((q) => q.author.where({ writingSkills: 'good' }))
   *   .set({ authorName: (q) => q.ref('author.name') });
   *
   * // update from any table using custom `on` conditions:
   * db.books
   *   .updateFrom(
   *     () => db.authors,
   *     (q) => q.on('authors.id', 'books.authorId'),
   *   )
   *   .set({ authorName: (q) => q.ref('author.name') });
   *
   * // conditions after `updateFrom` can reference both tables:
   * db.books
   *   .updateFrom(() => db.authors)
   *   .where({
   *     'authors.id': (q) => q.ref('books.authorId'),
   *   })
   *   .set({ authorName: (q) => q.ref('author.name') });
   *
   * // can join and use another table in between `updateFrom` and `set`:
   * db.books
   *   .updateFrom('author')
   *   .join('publisher')
   *   .set({
   *     authorName: (q) => q.ref('author.name'),
   *     publisherName: (q) => q.ref('publisher.name'),
   *   });
   *
   * // updating from a CTE
   * db.books
   *   .with('a', () =>
   *     db.authors.where({ writingSkills: 'good' }).select('id', 'name').limit(10),
   *   )
   *   .updateFrom('a', (q) => q.on('a.id', 'books.authorId'))
   *   .set({ authorName: (q) => q.ref('author.name') });
   * ```
   */
  updateFrom<
    T extends UpdateSelf,
    Arg extends JoinFirstArg<T>,
    Cb extends JoinCallbackArgs<T, Arg>,
  >(
    this: T,
    arg: Arg,
    ...args: Cb | JoinArgs<T, Arg>
  ): JoinResultFromArgs<T, Arg, Cb, true, true> & QueryHasWhere {
    const q = _clone(this);

    const joinArgs = _joinReturningArgs(
      q,
      true,
      arg as never,
      args as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      true,
    );
    if (!joinArgs) {
      return _queryNone(q) as never;
    }

    joinArgs.u = true;
    q.q.updateFrom = joinArgs;

    return q as never;
  }

  /**
   * Use after {@link updateFrom}
   */
  set<T extends UpdateSelf>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    return _queryUpdate(_clone(this), arg as never) as never;
  }

  /**
   * Increments a column by `1`, returns a count of updated records by default.
   *
   * ```ts
   * const updatedCount = await db.table
   *   .where(...conditions)
   *   .increment('numericColumn');
   * ```
   *
   * When using `find` or `get` it will throw `NotFoundError` when no records found.
   *
   * ```ts
   * // throws when not found
   * const updatedCount = await db.table.find(1).increment('numericColumn');
   *
   * // also throws when not found
   * const updatedCount2 = await db.table
   *   .where(...conditions)
   *   .get('columnName')
   *   .increment('numericColumn');
   * ```
   *
   * Provide an object to increment multiple columns with different values.
   * Use `select` to specify columns to return.
   *
   * ```ts
   * // increment someColumn by 5 and otherColumn by 10, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .increment({
   *     someColumn: 5,
   *     otherColumn: 10,
   *   });
   * ```
   *
   * @param data - name of the column to increment, or an object with columns and values to add
   */
  increment<T extends UpdateSelf>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return _queryChangeCounter(_clone(this), '+', data as never);
  }

  /**
   * Decrements a column by `1`, returns a count of updated records by default.
   *
   * ```ts
   * const updatedCount = await db.table
   *   .where(...conditions)
   *   .decrement('numericColumn');
   * ```
   *
   * When using `find` or `get` it will throw `NotFoundError` when no records found.
   *
   * ```ts
   * // throws when not found
   * const updatedCount = await db.table.find(1).decrement('numericColumn');
   *
   * // also throws when not found
   * const updatedCount2 = await db.table
   *   .where(...conditions)
   *   .get('columnName')
   *   .decrement('numericColumn');
   * ```
   *
   * Provide an object to decrement multiple columns with different values.
   * Use `select` to specify columns to return.
   *
   * ```ts
   * // decrement someColumn by 5 and otherColumn by 10, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .decrement({
   *     someColumn: 5,
   *     otherColumn: 10,
   *   });
   * ```
   *
   * @param data - name of the column to decrement, or an object with columns and values to subtract
   */
  decrement<T extends UpdateSelf>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return _queryChangeCounter(_clone(this), '-', data as never);
  }

  /**
   * Updates multiple records with different per-row data in a single query.
   *
   * Each row must include the primary key and the columns to update.
   * All rows must have the same set of non-key columns.
   *
   * Returns a count of updated records by default.
   * Use `select`, `selectAll`, `get`, or `pluck` alongside `updateMany` to return
   * updated records.
   *
   * Throws {@link NotFoundError} if any record is not found.
   * Use {@link updateManyOptional} to skip missing records without throwing.
   *
   * ```ts
   * // returns count of updated records
   * const count = await db.table.updateMany([
   *   { id: 1, name: 'Alice', age: 30 },
   *   { id: 2, name: 'Bob', age: 25 },
   * ]);
   *
   * // returns array of updated records
   * const records = await db.table.select('id', 'name').updateMany([
   *   { id: 1, name: 'Alice' },
   *   { id: 2, name: 'Bob' },
   * ]);
   * ```
   *
   * `.set()` applies shared values to all rows.
   * `.set()` values take precedence over per-row values for the same column.
   *
   * ```ts
   * await db.table
   *   .updateMany([
   *     { id: 1, name: 'Alice' },
   *     { id: 2, name: 'Bob' },
   *   ])
   *   .set({ updatedBy: currentUser.id });
   * ```
   */
  updateMany<T extends UpdateSelf>(
    this: T,
    data: UpdateManyData<T>,
  ): UpdateManyResult<T> & QueryHasWhere {
    const q = _clone(this) as unknown as Query;
    return _queryUpdateMany(
      q as never,
      requirePrimaryKeys(q, 'updateMany requires a primary key'),
      data as RecordUnknown[],
      true,
    ) as never;
  }

  /**
   * Same as {@link updateMany}, but skips missing records rather than throwing.
   *
   * ```ts
   * // updates what it can, doesn't throw for missing id: 999
   * const count = await db.table.updateManyOptional([
   *   { id: 1, name: 'Alice' },
   *   { id: 999, name: 'Ghost' },
   * ]);
   * ```
   */
  updateManyOptional<T extends UpdateSelf>(
    this: T,
    data: UpdateManyData<T>,
  ): UpdateManyResult<T> & QueryHasWhere {
    const q = _clone(this) as unknown as Query;
    return _queryUpdateMany(
      q as never,
      requirePrimaryKeys(q, 'updateMany requires a primary key'),
      data as RecordUnknown[],
      false,
    ) as never;
  }

  /**
   * Like {@link updateMany}, but matches rows by a unique column or a compound unique constraint instead of the primary key.
   *
   * Throws {@link NotFoundError} if any record is not found.
   * Use {@link updateManyByOptional} to skip records with no matching key without throwing.
   *
   * ```ts
   * // single unique column
   * await db.table.updateManyBy('email', [
   *   { email: 'alice@test.com', name: 'Alice' },
   *   { email: 'bob@test.com', name: 'Bob' },
   * ]);
   *
   * // compound unique constraint
   * await db.table.updateManyBy(['firstName', 'lastName'], [
   *   { firstName: 'John', lastName: 'Doe', bio: 'updated' },
   * ]);
   * ```
   */
  updateManyBy<
    T extends UpdateManyBySelf,
    Keys extends UpdateManyByKeys<T>,
    K extends string = UpdateManyByKeyColumns<Keys>,
  >(
    this: T,
    keys: Keys,
    data: UpdateManyByData<T, K>,
  ): UpdateManyResult<T> & QueryHasWhere {
    return _queryUpdateMany(
      _clone(this) as never,
      typeof keys === 'string' ? [keys] : (keys as unknown as string[]),
      data as RecordUnknown[],
      true,
    ) as never;
  }

  /**
   * Same as {@link updateManyBy}, but skips records with no matching key rather than throwing.
   *
   * ```ts
   * await db.table.updateManyByOptional('email', [
   *   { email: 'alice@test.com', name: 'Alice' },
   *   { email: 'unknown@test.com', name: 'Ghost' },
   * ]);
   * ```
   */
  updateManyByOptional<
    T extends UpdateManyBySelf,
    Keys extends UpdateManyByKeys<T>,
    K extends string = UpdateManyByKeyColumns<Keys>,
  >(
    this: T,
    keys: Keys,
    data: UpdateManyByData<T, K>,
  ): UpdateManyResult<T> & QueryHasWhere {
    return _queryUpdateMany(
      _clone(this) as never,
      typeof keys === 'string' ? [keys] : (keys as unknown as string[]),
      data as RecordUnknown[],
      false,
    ) as never;
  }
}
