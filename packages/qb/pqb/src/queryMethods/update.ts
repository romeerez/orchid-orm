import {
  Query,
  QueryReturnsAll,
  SetQueryKind,
  SetQueryReturnsRowCount,
} from '../query/query';
import {
  pushQueryValue,
  saveSearchAlias,
  throwIfNoWhere,
} from '../query/queryUtils';
import { RelationConfigBase, RelationQueryBase } from '../relations';
import { _queryWhereIn, WhereResult } from './where/where';
import { JsonItem, ToSQLQuery } from '../sql';
import { VirtualColumn } from '../columns';
import { anyShape, Db } from '../query/db';
import {
  isExpression,
  Expression,
  QueryThen,
  callWithThis,
  TemplateLiteralArgs,
  emptyObject,
} from 'orchid-core';
import { QueryResult } from '../adapter';
import { JsonModifiers } from './json';
import { RawSQL } from '../sql/rawSql';
import { resolveSubQueryCallback } from '../common/utils';
import { OrchidOrmInternalError } from '../errors';
import { CloneSelfKeys } from '../query/queryBase';

export type UpdateSelf = Pick<
  Query,
  'meta' | 'inputType' | 'relations' | keyof JsonModifiers | CloneSelfKeys
>;

// Type of argument for `update` and `updateOrThrow`
//
// It maps the `inputType` of a table into object with column values.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
//
// It enables all forms of relation operations such as nested `create`, `connect`, etc.
export type UpdateData<T extends UpdateSelf> = {
  [K in keyof T['inputType']]?: UpdateColumn<T, K>;
} & {
  [K in keyof T['relations']]?: UpdateRelationData<
    T,
    T['relations'][K]['relationConfig']
  >;
};

// Type of available variants to provide for a specific column when updating.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
type UpdateColumn<T extends UpdateSelf, Key extends keyof T['inputType']> =
  | T['inputType'][Key]
  | Expression
  | {
      [K in keyof Query]: K extends 'then'
        ? QueryThen<T['inputType'][Key]>
        : Query[K];
    }
  | ((
      q: {
        [K in keyof JsonModifiers]: K extends 'selectable'
          ? T['meta']['selectable']
          : T[K];
      } & T['relations'],
    ) => JsonItem | (RelationQueryBase & { meta: { kind: 'select' } }));

// Add relation operations to the update argument.
type UpdateRelationData<
  T extends UpdateSelf,
  Rel extends RelationConfigBase,
> = QueryReturnsAll<T['returnType']> extends true
  ? Rel['dataForUpdate']
  : Rel['one'] extends true
  ? Rel['dataForUpdate'] | Rel['dataForUpdateOne']
  : Rel['dataForUpdate'] & Rel['dataForUpdateOne'];

// Type of argument for `update`.
// not available when there are no conditions on the query.
export type UpdateArg<T extends UpdateSelf> = T['meta']['hasWhere'] extends true
  ? UpdateData<T>
  : never;

// Type of argument for `updateRaw`.
// not available when there are no conditions on the query.
type UpdateRawArgs<T extends UpdateSelf> = T['meta']['hasWhere'] extends true
  ? [sql: Expression] | TemplateLiteralArgs
  : never;

// `update` and `updateOrThrow` methods output type.
// Unless something was explicitly selected on the query, it's returning the count of updated records.
type UpdateResult<T extends UpdateSelf> = T['meta']['hasSelect'] extends true
  ? SetQueryKind<T, 'update'>
  : SetQueryReturnsRowCount<SetQueryKind<T, 'update'>>;

// `increment` and `decrement` methods argument type.
// Accepts a column name to change, or an object with column names and number values to increment or decrement with.
type ChangeCountArg<T extends Pick<Query, 'shape'>> =
  | keyof T['shape']
  | Partial<Record<keyof T['shape'], number>>;

// Context object for `update` logic used internally.
// It's being used by relations logic in the ORM.
export type UpdateCtx = {
  queries?: ((queryResult: QueryResult) => Promise<void>)[];
  updateData?: Record<string, unknown>;
};

// apply `increment` or a `decrement`,
// mutates the `queryData` of a query.
export const _queryChangeCounter = <T extends UpdateSelf>(
  self: T,
  op: string,
  data: ChangeCountArg<T>,
) => {
  self.q.type = 'update';

  if (!self.q.select) {
    if (
      self.q.returnType === 'oneOrThrow' ||
      self.q.returnType === 'valueOrThrow'
    ) {
      self.q.throwOnNotFound = true;
    }
    self.q.returnType = 'rowCount';
  }

  let map: Record<string, { op: string; arg: number }>;
  if (typeof data === 'object') {
    map = {};
    for (const key in data) {
      map[key] = { op, arg: data[key] as number };
    }
  } else {
    map = { [data as string]: { op, arg: 1 } };
  }

  pushQueryValue(self, 'updateData', map);
  return self as unknown as UpdateResult<T>;
};

// sets query type, `returnType`, casts type from Query to UpdateResult
const update = <T extends UpdateSelf>(q: T): UpdateResult<T> => {
  q.q.type = 'update';

  if (!q.q.select) {
    q.q.returnType = 'rowCount';
  }

  throwIfNoWhere(q, 'update');

  return q as unknown as UpdateResult<T>;
};

export const _queryUpdate = <T extends UpdateSelf>(
  query: T,
  arg: UpdateArg<T>,
): UpdateResult<T> => {
  const { q } = query;

  const set: Record<string, unknown> = { ...arg };
  pushQueryValue(query, 'updateData', set);

  const { shape } = q;

  const ctx: UpdateCtx = {};

  for (const key in arg) {
    const item = shape[key];
    if (item instanceof VirtualColumn && item.update) {
      item.update(query, ctx, set);
      delete set[key];
    } else if (
      (!shape[key] || shape[key].data.computed) &&
      shape !== anyShape
    ) {
      delete set[key];
    } else {
      let value = set[key];
      if (typeof value === 'function') {
        value = resolveSubQueryCallback(
          query.baseQuery,
          value as (q: ToSQLQuery) => ToSQLQuery,
        );
        if (value instanceof Db && value.q.type) {
          throw new OrchidOrmInternalError(
            value,
            `Only selecting queries are allowed inside callback of update, ${value.q.type} is given instead.`,
          );
        }

        set[key] = value;
      }

      if (value !== null && value !== undefined && !isExpression(value)) {
        if (value instanceof Db) {
          // if it is not a select query,
          // move it into `WITH` statement and select from it with a raw SQL
          if (value.q.type) {
            const as = saveSearchAlias(query, 'q', 'withShapes');
            pushQueryValue(query, 'with', [as, emptyObject, value]);

            set[key] = new RawSQL(`(SELECT * FROM "${as}")`);
          }
        } else {
          // encode if not a query object
          const encode = shape[key].encodeFn;
          if (encode) set[key] = encode(value);
        }
      }
    }
  }

  const { queries } = ctx;
  if (queries) {
    q.patchResult = async (_, queryResult) => {
      await Promise.all(queries.map(callWithThis, queryResult));

      if (ctx.updateData) {
        const t = query.baseQuery.clone();
        const keys = (query as unknown as Query).primaryKeys;

        (
          _queryWhereIn as unknown as (
            q: Query,
            keys: string[],
            values: unknown[][],
          ) => Query
        )(
          t,
          keys,
          queryResult.rows.map((item) => keys.map((key) => item[key])),
        );

        _queryUpdate(
          t as WhereResult<Query>,
          ctx.updateData as UpdateData<WhereResult<Query>>,
        );

        for (const row of queryResult.rows) {
          Object.assign(row, ctx.updateData);
        }
      }
    };
  }

  return update(query);
};

export const _queryUpdateRaw = <T extends UpdateSelf>(
  q: T,
  sql: Expression,
): UpdateResult<T> => {
  pushQueryValue(q, 'updateData', sql);

  q.q.type = 'update';

  return update(q);
};

export const _queryUpdateOrThrow = <T extends UpdateSelf>(
  q: T,
  arg: UpdateArg<T>,
): UpdateResult<T> => {
  q.q.throwOnNotFound = true;
  return _queryUpdate(q, arg);
};

export class Update {
  /**
   * `update` takes an object with columns and values to update records.
   *
   * By default, `update` will return a count of updated records.
   *
   * Place `select`, `selectAll`, or `get` before `update` to specify returning columns.
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
   *   column1: 123,
   *
   *   // use raw SQL to update the column
   *   column2: db.table.sql`2 + 2`,
   *
   *   // use query that returns a single value
   *   // returning multiple values will result in Postgres error
   *   column3: db.otherTable.get('someColumn'),
   *
   *   // select a single value from a related record
   *   fromRelation: (q) => q.relatedTable.get('someColumn'),
   *
   *   // set a new value to the `.foo.bar` path into a JSON column
   *   jsonColumn: (q) => q.jsonSet('jsonColumn', ['foo', 'bar'], 'new value'),
   * });
   * ```
   *
   * ### sub-queries
   *
   * In addition to sub-queries that are simply selecting a single value, it's supported to update a column with a result of the provided `create`, `update`, or `delete` sub-query.
   *
   * ```ts
   * await db.table.where({ ...conditions }).update({
   *   // `column` will be set to a value of the `otherColumn` of the created record.
   *   column: db.otherTable.get('otherColumn').create({ ...data }),
   *
   *   // `column2` will be set to a value of the `otherColumn` of the updated record.
   *   column2: db.otherTable
   *     .get('otherColumn')
   *     .findBy({ ...conditions })
   *     .update({ key: 'value' }),
   *
   *   // `column3` will be set to a value of the `otherColumn` of the deleted record.
   *   column3: db.otherTable
   *     .get('otherColumn')
   *     .findBy({ ...conditions })
   *     .delete(),
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
   * UPDATE "table"
   * SET "column" = (SELECT * FROM "q")
   * ```
   *
   * The query is atomic, and if the sub-query fails, or the update part fails, or if multiple rows are returned from a sub-query, no changes will persist in the database.
   *
   * Though it's possible to select a single value from a callback for the column to update:
   *
   * ```ts
   * await db.table.find(1).update({
   *   // update column `one` with the value of column `two` of the related record.
   *   one: (q) => q.relatedTable.get('two'),
   * })
   * ```
   *
   * It is **not** supported to use `create`, `update`, or `delete` kinds of sub-query on related tables:
   *
   * ```ts
   * await db.table.find(1).update({
   *   // TS error, this is not allowed:
   *   one: (q) => q.relatedTable.get('two').create({ ...data }),
   * })
   * ```
   *
   * It is not supported because query inside `WITH` cannot reference the table in `UPDATE`.
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
    return _queryUpdate(this.clone(), arg);
  }

  /**
   * `updateRaw` is for updating records with raw expression.
   *
   * The behavior is the same as a regular `update` method has:
   * `find` or `where` must precede calling this method,
   * it returns an updated count by default,
   * you can customize returning data by using `select`.
   *
   * ```ts
   * const value = 'new name';
   *
   * // update with SQL template string
   * const updatedCount = await db.table.find(1).updateRaw`name = ${value}`;
   *
   * // or update with `sql` function:
   * await db.table.find(1).updateRaw(db.table.sql`name = ${value}`);
   * ```
   * @param args - raw SQL via a template string or by using a `sql` method
   */
  updateRaw<T extends UpdateSelf>(
    this: T,
    ...args: UpdateRawArgs<T>
  ): UpdateResult<T> {
    const q = this.clone();

    if (Array.isArray(args[0])) {
      const sql = new RawSQL(args as TemplateLiteralArgs);
      return _queryUpdateRaw(q as T & { meta: { hasWhere: true } }, sql);
    }

    return _queryUpdateRaw(q, args[0] as Expression);
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
    return _queryUpdateOrThrow(this.clone(), arg);
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
    return _queryChangeCounter(this.clone(), '+', data);
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
    return _queryChangeCounter(this.clone(), '-', data);
  }
}
