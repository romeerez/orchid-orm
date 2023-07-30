import {
  Query,
  QueryReturnsAll,
  SetQueryKind,
  SetQueryReturnsRowCount,
} from '../query';
import {
  pushQueryValue,
  saveSearchAlias,
  throwIfNoWhere,
} from '../queryDataUtils';
import {
  BelongsToRelation,
  HasAndBelongsToManyRelation,
  HasManyRelation,
  HasOneRelation,
  Relation,
  RelationQueryBase,
} from '../relations';
import { WhereArg, WhereResult } from './where/where';
import { CreateData } from './create';
import { JsonItem, QueryData, UpdateQueryData } from '../sql';
import { VirtualColumn } from '../columns';
import { anyShape, Db } from '../db';
import {
  isExpression,
  Expression,
  EmptyObject,
  MaybeArray,
  QueryThen,
  isObjectEmpty,
  callWithThis,
  TemplateLiteralArgs,
  emptyObject,
} from 'orchid-core';
import { QueryResult } from '../adapter';
import { JsonModifiers } from './json';
import { RawSQL } from '../sql/rawSql';
import { resolveSubQueryCallback } from '../utils';
import { OrchidOrmInternalError } from '../errors';

// Type of argument for `update` and `updateOrThrow`
//
// It maps the `inputType` of a table into object with column values.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
//
// It enables all forms of relation operations such as nested `create`, `connect`, etc.
export type UpdateData<T extends Query> = {
  [K in keyof T['inputType']]?: UpdateColumn<T, K>;
} & (T['relations'] extends Record<string, Relation>
  ? {
      [K in keyof T['relations']]?: T['relations'][K] extends BelongsToRelation
        ? UpdateBelongsToData<T, T['relations'][K]>
        : T['relations'][K] extends HasOneRelation
        ? UpdateHasOneData<T, T['relations'][K]>
        : T['relations'][K] extends HasManyRelation
        ? UpdateHasManyData<T, T['relations'][K]>
        : T['relations'][K] extends HasAndBelongsToManyRelation
        ? UpdateHasAndBelongsToManyData<T['relations'][K]>
        : never;
    }
  : EmptyObject) & {
    __raw?: never; // forbid Expression argument
  };

// Type of available variants to provide for a specific column when updating.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
type UpdateColumn<T extends Query, Key extends keyof T['inputType']> =
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
          ? T['selectable']
          : T[K];
      } & { [K in keyof T['relations']]: T[K] },
    ) => JsonItem | (RelationQueryBase & { meta: { kind: 'select' } }));

// `belongsTo` relation data available for update. It supports:
// - `disconnect` to nullify a foreign key for the relation
// - `set` to update the foreign key with a relation primary key found by conditions
// - `delete` to delete the related record, nullify the foreign key
// - `update` to update the related record
// - `create` to create the related record
//
// Only for records that updates a single record:
// - `upsert` to update or create the related record
type UpdateBelongsToData<T extends Query, Rel extends BelongsToRelation> =
  | { disconnect: boolean }
  | { set: WhereArg<Rel['table']> }
  | { delete: boolean }
  | { update: UpdateData<Rel['table']> }
  | {
      create: CreateData<Rel['nestedCreateQuery']>;
    }
  | (QueryReturnsAll<T['returnType']> extends true
      ? never
      : {
          upsert: {
            update: UpdateData<Rel['table']>;
            create:
              | CreateData<Rel['nestedCreateQuery']>
              | (() => CreateData<Rel['nestedCreateQuery']>);
          };
        });

// `hasOne` relation data available for update. It supports:
// - `disconnect` to nullify a foreign key of the related record
// - `delete` to delete the related record
// - `update` to update the related record
//
// Only for records that updates a single record:
// - `set` to update the foreign key of related record found by condition
// - `upsert` to update or create the related record
// - `create` to create a related record
type UpdateHasOneData<T extends Query, Rel extends HasOneRelation> =
  | { disconnect: boolean }
  | { delete: boolean }
  | { update: UpdateData<Rel['table']> }
  | (QueryReturnsAll<T['returnType']> extends true
      ? never
      :
          | { set: WhereArg<Rel['table']> }
          | {
              upsert: {
                update: UpdateData<Rel['table']>;
                create:
                  | CreateData<Rel['nestedCreateQuery']>
                  | (() => CreateData<Rel['nestedCreateQuery']>);
              };
            }
          | {
              create: CreateData<Rel['nestedCreateQuery']>;
            });

// `hasMany` relation data available for update. It supports:
// - `disconnect` to nullify foreign keys of the related records
// - `delete` to delete related record found by conditions
// - `update` to update related records found by conditions with a provided data
//
// Only for records that updates a single record:
// - `set` to update foreign keys of related records found by conditions
// - `create` to create related records
type UpdateHasManyData<T extends Query, Rel extends HasManyRelation> = {
  disconnect?: MaybeArray<WhereArg<Rel['table']>>;
  delete?: MaybeArray<WhereArg<Rel['table']>>;
  update?: {
    where: MaybeArray<WhereArg<Rel['table']>>;
    data: UpdateData<Rel['table']>;
  };
} & (QueryReturnsAll<T['returnType']> extends true
  ? EmptyObject
  : {
      set?: MaybeArray<WhereArg<Rel['table']>>;
      create?: CreateData<Rel['nestedCreateQuery']>[];
    });

// `hasAndBelongsToMany` relation data available for update. It supports:
// - `disconnect` to delete join table records for related records found by conditions
// - `set` to create join table records for related records found by conditions
// - `delete` to delete join table records and related records found by conditions
// - `update` to update related records found by conditions with a provided data
// - `create` to create related records and a join table records
type UpdateHasAndBelongsToManyData<Rel extends HasAndBelongsToManyRelation> = {
  disconnect?: MaybeArray<WhereArg<Rel['table']>>;
  set?: MaybeArray<WhereArg<Rel['table']>>;
  delete?: MaybeArray<WhereArg<Rel['table']>>;
  update?: {
    where: MaybeArray<WhereArg<Rel['table']>>;
    data: UpdateData<Rel['table']>;
  };
  create?: CreateData<Rel['nestedCreateQuery']>[];
};

// Type of argument for `update`.
// not available when there are no conditions on the query.
type UpdateArg<T extends Query> = T['meta']['hasWhere'] extends true
  ? UpdateData<T>
  : never;

// Type of argument for `updateRaw`.
// not available when there are no conditions on the query.
type UpdateRawArgs<T extends Query> = T['meta']['hasWhere'] extends true
  ? [sql: Expression] | TemplateLiteralArgs
  : never;

// `update` and `updateOrThrow` methods output type.
// Unless something was explicitly selected on the query, it's returning the count of updated records.
type UpdateResult<T extends Query> = T['meta']['hasSelect'] extends true
  ? SetQueryKind<T, 'update'>
  : SetQueryReturnsRowCount<SetQueryKind<T, 'update'>>;

// `increment` and `decrement` methods argument type.
// Accepts a column name to change, or an object with column names and number values to increment or decrement with.
type ChangeCountArg<T extends Query> =
  | keyof T['shape']
  | Partial<Record<keyof T['shape'], number>>;

// Context object for `update` logic used internally.
// It's being used by relations logic in the ORM.
export type UpdateCtx = {
  willSetKeys?: true;
  queries?: ((queryResult: QueryResult) => Promise<void>)[];
  updateData?: Record<string, unknown>;
};

// apply `increment` or a `decrement`,
// mutates the `queryData` of a query.
const applyCountChange = <T extends Query>(
  self: T,
  op: string,
  data: ChangeCountArg<T>,
) => {
  self.q.type = 'update';

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

// check if there is nothing to update for the table.
//
// It may happen when user is using `update` to only update relations,
// and there are no columns to update in the table of this query.
const checkIfUpdateIsEmpty = (q: QueryData) => {
  return !(q as UpdateQueryData).updateData?.some(
    (item) => isExpression(item) || !isObjectEmpty(item),
  );
};

// sets query type, `returnType`, casts type from Query to UpdateResult
const update = <T extends Query>(q: T): UpdateResult<T> => {
  q.q.type = 'update';

  if (!q.q.select) {
    q.q.returnType = 'rowCount';
  }

  throwIfNoWhere(q, 'update');

  return q as unknown as UpdateResult<T>;
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
   * ### null and undefined
   *
   * `null` value will set a column to `NULL`, but the `undefined` value will be ignored:
   *
   * ```ts
   * db.table.findBy({ id: 1 }).update({
   *   name: null, // updates to null
   *   age: undefined, // skipped, no effect
   * });
   * ```
   *
   * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
   */
  update<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    const q = this.clone() as T;
    return q._update(arg);
  }
  _update<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    const { q } = this;

    const set: Record<string, unknown> = { ...arg };
    pushQueryValue(this, 'updateData', set);

    const { shape } = q;

    const ctx: UpdateCtx = {};

    for (const key in arg) {
      const item = shape[key];
      if (item instanceof VirtualColumn && item.update) {
        item.update(this, ctx, set);
        delete set[key];
      } else if (!shape[key] && shape !== anyShape) {
        delete set[key];
      } else {
        let value = set[key];
        if (typeof value === 'function') {
          value = resolveSubQueryCallback(this, value as (q: Query) => Query);
          if (value instanceof Db && value.q.type) {
            throw new OrchidOrmInternalError(
              value,
              `Only the selecting queries are allowed inside callback of update, ${value.q.type} is given instead.`,
            );
          }

          set[key] = value;
        }

        if (!isExpression(value)) {
          const encode = shape[key].encodeFn;
          if (encode) set[key] = encode(value);

          if (value instanceof Db && value.q.type) {
            const as = saveSearchAlias(this, 'q', 'withShapes');
            pushQueryValue(this, 'with', [as, emptyObject, value]);

            set[key] = new RawSQL(`(SELECT * FROM "${as}")`);
          }
        }
      }
    }

    if (!ctx.willSetKeys && checkIfUpdateIsEmpty(q)) {
      delete q.type;
    }

    const { queries } = ctx;
    if (queries) {
      q.patchResult = async (_, queryResult) => {
        await Promise.all(queries.map(callWithThis, queryResult));

        if (ctx.updateData) {
          const t = this.baseQuery.clone();
          const keys = this.primaryKeys;

          (
            t._whereIn as unknown as (
              keys: string[],
              values: unknown[][],
            ) => Query
          )(
            keys,
            queryResult.rows.map((item) => keys.map((key) => item[key])),
          );

          await (t as WhereResult<Query>)._update(ctx.updateData);

          for (const row of queryResult.rows) {
            Object.assign(row, ctx.updateData);
          }
        }
      };
    }

    return update(this);
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
  updateRaw<T extends Query>(
    this: T,
    ...args: UpdateRawArgs<T>
  ): UpdateResult<T> {
    const q = this.clone() as T;
    return q._updateRaw(...args);
  }
  _updateRaw<T extends Query>(
    this: T,
    ...args: UpdateRawArgs<T>
  ): UpdateResult<T> {
    if (Array.isArray(args[0])) {
      const sql = new RawSQL(args as TemplateLiteralArgs);
      return (this as T & { meta: { hasWhere: true } })._updateRaw(sql);
    }

    pushQueryValue(this, 'updateData', args[0]);
    return update(this);
  }

  /**
   * To make sure that at least one row was updated use `updateOrThrow`:
   *
   * ```ts
   * import { NotFoundError } from 'pqb';
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
  updateOrThrow<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    const q = this.clone() as T;
    return q._updateOrThrow(arg);
  }
  _updateOrThrow<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    this.q.throwOnNotFound = true;
    return this._update(arg);
  }

  /**
   * Increments a column value by the specified amount. Optionally takes `returning` argument.
   *
   * ```ts
   * // increment numericColumn column by 1, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .increment('numericColumn');
   *
   * // increment someColumn by 5 and otherColumn by 10, return updated records
   * const result2 = await db.table
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
  increment<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return this.clone()._increment(data) as unknown as UpdateResult<T>;
  }
  _increment<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return applyCountChange(this, '+', data);
  }

  /**
   * Decrements a column value by the specified amount. Optionally takes `returning` argument.
   *
   * ```ts
   * // decrement numericColumn column by 1, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .decrement('numericColumn');
   *
   * // decrement someColumn by 5 and otherColumn by 10, return updated records
   * const result2 = await db.table
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
  decrement<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return this.clone()._decrement(data) as unknown as UpdateResult<T>;
  }
  _decrement<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return applyCountChange(this, '-', data);
  }
}
