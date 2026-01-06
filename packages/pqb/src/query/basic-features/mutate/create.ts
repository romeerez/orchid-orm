import {
  Query,
  SetQueryReturnsColumnOptional,
  QueryTakeOptional,
  SetQueryReturnsRowCount,
  SetQueryReturnsRowCountMany,
  QueryOrExpression,
  QueryBase,
  IsQuery,
  isQuery,
  SetQueryReturnsAllResult,
  SetQueryReturnsOneResult,
  SetQueryReturnsColumnResult,
  SetQueryResult,
  SetQueryReturnsPluckColumnResult,
} from '../../query';
import {
  anyShape,
  Column,
  ColumnSchemaConfig,
  VirtualColumn,
} from '../../../columns';
import { isSelectingCount } from '../aggregate/aggregate';
import {
  CreateFromMethodNames,
  CreateManyFromMethodNames,
  getFromSelectColumns,
} from './create-from';
import { _querySelectAll } from '../select/select';
import { prepareSubQueryForSql } from '../../sub-query/sub-query-for-sql';
import {
  PickQueryHasSelect,
  PickQueryInputType,
  PickQueryMeta,
  PickQueryQ,
  PickQueryRelations,
  PickQueryResult,
  PickQueryReturnType,
  PickQueryShape,
  PickQueryUniqueProperties,
  PickQueryWithData,
} from '../../pick-query-types';
import { EmptyObject, FnUnknownToUnknown, RecordUnknown } from '../../../utils';
import { RelationConfigDataForCreate } from '../../relations';
import { Expression, isExpression } from '../../expressions/expression';
import { _getQueryFreeAlias, _setQueryAlias } from '../as/as';
import { _clone } from '../clone/clone';

import { joinSubQuery } from '../join/join';
import { resolveSubQueryCallback } from '../../sub-query/sub-query';
import { OrchidOrmInternalError } from '../../errors';
import { OnConflictMerge } from './insert.sql';
import { ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';

export interface CreateSelf
  extends IsQuery,
    PickQueryHasSelect,
    PickQueryMeta,
    PickQueryResult,
    PickQueryRelations,
    PickQueryWithData,
    PickQueryReturnType,
    PickQueryShape,
    PickQueryUniqueProperties,
    PickQueryInputType {}

// Type of argument for `create`, `createMany`, optional argument for `createOneFrom`,
// `defaults` use a Partial of it.
//
// It maps `inputType` of the table into object to accept a corresponding type,
// or raw SQL per column, or a sub-query for a column.
//
// It allows to omit `belongsTo` foreign keys when a `belongsTo` record is provided by a relation name.
// For example, it allows to create with `db.book.create({ authorId: 123 })`
// or with `db.book.create({ author: authorData })`
//
// It enables all forms of relation operations such as nested `create`, `connect`, etc.
export type CreateData<T extends CreateSelf> =
  EmptyObject extends T['relations']
    ? // if no relations, don't load TS with extra calculations
      CreateDataWithDefaults<T, keyof T['meta']['defaults']>
    : CreateRelationsData<T>;

type CreateDataWithDefaults<
  T extends CreateSelf,
  Defaults extends PropertyKey,
> = {
  [K in keyof T['inputType'] as K extends Defaults
    ? never
    : K]: K extends Defaults ? never : CreateColumn<T, K>;
} & {
  [K in Defaults]?: K extends keyof T['inputType'] ? CreateColumn<T, K> : never;
};

type CreateDataWithDefaultsForRelations<
  T extends CreateSelf,
  Defaults extends keyof T['inputType'],
  OmitFKeys extends PropertyKey,
> = {
  [K in keyof T['inputType'] as K extends Defaults | OmitFKeys
    ? never
    : K]: K extends Defaults | OmitFKeys ? never : CreateColumn<T, K>;
} & {
  [K in Defaults as K extends OmitFKeys ? never : K]?: CreateColumn<T, K>;
};

// Type of available variants to provide for a specific column when creating
export type CreateColumn<
  T extends CreateSelf,
  K extends keyof T['inputType'],
> = T['inputType'][K] | ((q: T) => QueryOrExpression<T['inputType'][K]>);

// Combine data of the table with data that can be set for relations
export type CreateRelationsData<T extends CreateSelf> =
  // Data except `belongsTo` foreignKeys: { name: string, fooId: number } -> { name: string }
  CreateDataWithDefaultsForRelations<
    T,
    keyof T['meta']['defaults'],
    T['relations'][keyof T['relations']]['omitForeignKeyInCreate']
  > &
    CreateBelongsToData<T> &
    // Union of the rest relations objects, intersection is not needed here because there are no required properties:
    // { foo: object } | { bar: object }
    T['relations'][keyof T['relations']]['optionalDataForCreate'];

// Intersection of objects for `belongsTo` relations:
// ({ fooId: number } | { foo: object }) & ({ barId: number } | { bar: object })
export type CreateBelongsToData<T extends CreateSelf> = [
  T['relations'][keyof T['relations']]['dataForCreate'],
] extends [never]
  ? EmptyObject
  : CreateRelationsDataOmittingFKeys<
      T,
      T['relations'][keyof T['relations']]['dataForCreate']
    >;

// Intersection of relations that may omit foreign key (belongsTo):
// ({ fooId: number } | { foo: object }) & ({ barId: number } | { bar: object })
export type CreateRelationsDataOmittingFKeys<
  T extends CreateSelf,
  // Collect a union of `belongsTo` relation objects.
  Union,
> =
  // Based on UnionToIntersection from here https://stackoverflow.com/a/50375286
  (
    Union extends RelationConfigDataForCreate
      ? (
          u: // omit relation columns if they are in defaults, is tested in factory.test.ts
          Union['columns'] extends keyof T['meta']['defaults']
            ? {
                [P in Exclude<
                  Union['columns'] & keyof T['inputType'],
                  keyof T['meta']['defaults']
                >]: CreateColumn<T, P>;
              } & {
                [P in keyof T['meta']['defaults'] &
                  Union['columns']]?: CreateColumn<T, P>;
              } & Partial<Union['nested']>
            :
                | {
                    [P in Union['columns'] &
                      keyof T['inputType']]: CreateColumn<T, P>;
                  }
                | Union['nested'],
        ) => void
      : never
  ) extends // must be handled as a function argument, belongsTo.test relies on this
  (u: infer Obj) => void
    ? Obj
    : never;

// `create` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
export type CreateResult<T extends CreateSelf> = T extends { isCount: true }
  ? T
  : T['returnType'] extends undefined | 'all'
  ? SetQueryReturnsOneResult<T, NarrowCreateResult<T>>
  : T['returnType'] extends 'pluck'
  ? SetQueryReturnsColumnResult<T, NarrowCreateResult<T>>
  : SetQueryResult<T, NarrowCreateResult<T>>;

// `insert` method output type
// - query returns inserted row count by default.
// - returns a record with selected columns if the query has a select.
// - if the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
type InsertResult<T extends CreateSelf> = T['__hasSelect'] extends true
  ? T['returnType'] extends undefined | 'all'
    ? SetQueryReturnsOneResult<T, NarrowCreateResult<T>>
    : T['returnType'] extends 'pluck'
    ? SetQueryReturnsColumnResult<T, NarrowCreateResult<T>>
    : SetQueryResult<T, NarrowCreateResult<T>>
  : SetQueryReturnsRowCount<T>;

// `createMany` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns a single record, forces it to return multiple.
// - otherwise, query result remains as is.
type CreateManyResult<T extends CreateSelf> = T extends { isCount: true }
  ? SetQueryResult<T, NarrowCreateResult<T>>
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAllResult<T, NarrowCreateResult<T>>
  : T['returnType'] extends 'value' | 'valueOrThrow'
  ? SetQueryReturnsPluckColumnResult<T, NarrowCreateResult<T>>
  : SetQueryResult<T, NarrowCreateResult<T>>;

// `insertMany` method output type
// - query returns inserted row count by default.
// - returns records with selected columns if the query has a select.
// - if the query returns a single record, forces it to return multiple records.
type InsertManyResult<T extends CreateSelf> = T['__hasSelect'] extends true
  ? T['returnType'] extends 'one' | 'oneOrThrow'
    ? SetQueryReturnsAllResult<T, NarrowCreateResult<T>>
    : T['returnType'] extends 'value' | 'valueOrThrow'
    ? SetQueryReturnsPluckColumnResult<T, NarrowCreateResult<T>>
    : SetQueryResult<T, NarrowCreateResult<T>>
  : SetQueryReturnsRowCountMany<T>;

/**
 * When creating a record with a *belongs to* nested record,
 * un-nullify foreign key columns of the result.
 *
 * The same should work as well with any non-null columns passed to `create`, but it's to be implemented later.
 */
type NarrowCreateResult<T extends CreateSelf> =
  EmptyObject extends T['relations']
    ? T['result']
    : {
        [K in keyof T['result']]: K extends T['relations'][keyof T['relations']]['omitForeignKeyInCreate']
          ? Column.Pick.QueryColumnOfTypeAndOps<
              string,
              Exclude<T['result'][K]['type'], null>,
              T['result'][K]['operators']
            >
          : T['result'][K];
      };

// `onConflictDoNothing()` method output type:
// overrides query return type from 'oneOrThrow' to 'one', from 'valueOrThrow' to 'value',
// because `ignore` won't return any data in case of a conflict.
type IgnoreResult<T extends CreateSelf> = T['returnType'] extends 'oneOrThrow'
  ? QueryTakeOptional<T>
  : T['returnType'] extends 'valueOrThrow'
  ? SetQueryReturnsColumnOptional<T, T['result']['value']>
  : T;

// Argument of `onConflict`, can be:
// - a unique column name
// - an array of unique column names
// - raw or other kind of Expression
type OnConflictArg<T extends PickQueryUniqueProperties> =
  | T['internal']['uniqueColumnNames']
  | T['internal']['uniqueColumnTuples']
  | Expression
  | { constraint: T['internal']['uniqueConstraints'] };

export type AddQueryDefaults<T extends CreateSelf, Defaults> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'defaults'
          ? T['meta']['defaults'] & Defaults
          : T['meta'][K];
      }
    : T[K];
};

/**
 * Used by ORM to access the context of current create query.
 * Is passed to the `create` method of a {@link VirtualColumn}
 */
export interface CreateCtx {
  columns: Map<string, number>;
  returnTypeAll?: true;
  resultAll: RecordUnknown[];
}

// Type of `encode` of columns.
interface RecordEncoder {
  [K: string]: FnUnknownToUnknown;
}

// Function called by all `create` methods to override query select.
// Clears select if query returning nothing or a count.
// Otherwise, selects all if query doesn't have select.
export const createSelect = (q: Query) => {
  if (q.q.returnType === 'void' || isSelectingCount(q)) {
    q.q.select = undefined;
  } else if (!q.q.select) {
    _querySelectAll(q);
    q.q.returning = true;
  }
};

/**
 * Processes arguments of data to create.
 * If the passed key is for a {@link VirtualColumn}, calls `create` of the virtual column.
 * Otherwise, ignores keys that aren't relevant to the table shape,
 * collects columns to the `ctx.columns` set, collects columns encoders.
 *
 * @param q - query object.
 * @param item - argument of data to create.
 * @param rowIndex - index of record's data in `createMany` args array.
 * @param ctx - context of create query to be shared with a {@link VirtualColumn}.
 * @param encoders - to collect `encode`s of columns.
 */
const processCreateItem = (
  q: CreateSelf,
  item: RecordUnknown,
  rowIndex: number,
  ctx: CreateCtx,
  encoders: RecordEncoder,
) => {
  const { shape } = (q as Query).q;
  for (const key in item) {
    const column = shape[key];
    if (!column) continue;

    if (column.data.virtual) {
      (column as VirtualColumn<ColumnSchemaConfig>).create?.(
        q,
        ctx,
        item,
        rowIndex,
      );
      continue;
    }

    throwOnReadOnly(q, column, key);

    let value = item[key];

    if (typeof value === 'function') {
      value = item[key] = resolveSubQueryCallback(
        q as unknown as ToSQLQuery,
        value as (q: ToSQLQuery) => ToSQLQuery,
      );

      if (isQuery(value)) {
        value = item[key] = joinSubQuery(
          q as Query,
          prepareSubQueryForSql(q as Query, value as Query),
        );
      }
    }

    if (
      !ctx.columns.has(key) &&
      ((column && !column.data.readOnly) || shape === anyShape) &&
      value !== undefined
    ) {
      ctx.columns.set(key, ctx.columns.size);
      encoders[key] = column?.data.encode as FnUnknownToUnknown;
    }
  }
};

export const throwOnReadOnly = (
  q: unknown,
  column: Column.Pick.Data,
  key: string,
) => {
  if (column.data.appReadOnly || column.data.readOnly) {
    throw new OrchidOrmInternalError(
      q as Query,
      'Trying to insert a readonly column',
      { column: key },
    );
  }
};

// Creates a new context of create query.
export const createCtx = (): CreateCtx => ({
  columns: new Map(),
  resultAll: undefined as unknown as RecordUnknown[],
});

/**
 * Processes arguments of `create`, `insert`, `createOneFrom` and `insertOneFrom` when it has data.
 * Apply defaults that may be present on a query object to the data.
 * Maps data object into array of values, encodes values when the column has an encoder.
 *
 * @param q - query object.
 * @param data - argument with data for create.
 * @param ctx - context of the create query.
 */
export const handleOneData = (
  q: CreateSelf,
  data: RecordUnknown,
  ctx: CreateCtx,
): { columns: string[]; values: unknown[][] } => {
  const encoders: RecordEncoder = {};
  const defaults = (q as Query).q.defaults;

  data = defaults ? { ...defaults, ...data } : { ...data };

  processCreateItem(q, data, 0, ctx, encoders);

  const columns = Array.from(ctx.columns.keys());
  const values = [
    columns.map((key) =>
      // undefined values were stripped and no need to check for them
      encoders[key] && !isExpression(data[key]) && data[key] !== null
        ? encoders[key](data[key])
        : data[key],
    ),
  ];

  return { columns, values };
};

/**
 * Processes arguments of `createMany`, `insertMany`.
 * Apply defaults that may be present on a query object to the data.
 * Maps data objects into array of arrays of values, encodes values when the column has an encoder.
 *
 * @param q - query object.
 * @param data - arguments with data for create.
 * @param ctx - context of the create query.
 */
export const handleManyData = (
  q: CreateSelf,
  data: RecordUnknown[],
  ctx: CreateCtx,
): { columns: string[]; values: unknown[][] } => {
  const encoders: RecordEncoder = {};
  const defaults = (q as Query).q.defaults;

  data = data.map(
    defaults ? (item) => ({ ...defaults, ...item }) : (item) => ({ ...item }),
  );

  data.forEach((item, i) => {
    processCreateItem(q, item, i, ctx, encoders);
  });

  const values = Array(data.length);
  const columns = Array.from(ctx.columns.keys());

  data.forEach((item, i) => {
    (values as unknown[][])[i] = columns.map((key) =>
      encoders[key] && item[key] !== undefined && !isExpression(item[key])
        ? encoders[key](item[key])
        : item[key],
    );
  });

  return { columns, values };
};

/**
 * Core function that is used by all `create` and `insert` methods.
 * Sets query `type` to `insert` for `toSQL` to know it's for inserting.
 * Sets query columns and values.
 * Sets query kind, which is checked by `update` method when returning a query from callback.
 * Overrides query return type according to what is current create method supposed to return.
 *
 * @param self - query object.
 * @param columns - columns list of all values.
 * @param insertFrom - query of `createFrom` and alike
 * @param values - array of arrays matching columns
 * @param many - whether it's for creating one or many.
 * @param queryMany - whether is createForEachFrom
 */
export const insert = (
  self: CreateSelf,
  {
    columns,
    insertFrom,
    values,
  }: {
    insertFrom?: IsQuery;
    columns: string[];
    values: QueryData['values'];
  },
  many?: boolean,
  queryMany?: boolean,
) => {
  const { q } = self as unknown as { q: QueryData };

  if (!q.select?.length) {
    q.returning = true;
  }

  q.type = 'insert';

  insertFrom = insertFrom
    ? (q.insertFrom = prepareSubQueryForSql(self as never, insertFrom as Query))
    : q.insertFrom;

  if (insertFrom) {
    if (q.insertFrom) {
      const obj = getFromSelectColumns(
        self,
        q.insertFrom,
        {
          columns,
          values,
        },
        queryMany,
      );
      columns = obj.columns;
      values = obj.values;
      q.queryColumnsCount = obj.queryColumnsCount;
    }

    if (values.length > 1) {
      const insertValuesAs = _getQueryFreeAlias(q, 'v');
      _setQueryAlias(self as unknown as QueryBase, 'v', insertValuesAs);

      q.insertValuesAs = insertValuesAs;
    }
  }

  q.columns = columns;
  q.values = values;

  const { select, returnType } = q;

  if (!select) {
    if (returnType !== 'void') {
      q.returnType = 'valueOrThrow';
      if (many) q.returningMany = true;
    }
  } else if (many) {
    if (returnType === 'one' || returnType === 'oneOrThrow') {
      q.returnType = 'all';
    } else if (returnType === 'value' || returnType === 'valueOrThrow') {
      q.returnType = 'pluck';
    }
  } else if (!returnType || returnType === 'all') {
    q.returnType = insertFrom ? (insertFrom as Query).q.returnType : 'one';
  } else if (returnType === 'pluck') {
    q.returnType = 'valueOrThrow';
  }

  return self;
};

export const _queryCreate = <T extends CreateSelf>(
  q: T,
  data: CreateData<T>,
): CreateResult<T> => {
  createSelect(q as unknown as Query);
  return _queryInsert(q, data) as never;
};

export const _queryInsert = <T extends CreateSelf>(
  query: T,
  data: CreateData<T>,
): InsertResult<T> => {
  const ctx = createCtx();
  const obj = handleOneData(query, data, ctx) as {
    columns: string[];
    values: QueryData['values'];
  };

  return insert(query, obj) as never;
};

export const _queryCreateMany = <T extends CreateSelf>(
  q: T,
  data: CreateData<T>[],
): CreateManyResult<T> => {
  createSelect(q as unknown as Query);
  return _queryInsertMany(q, data as never) as never;
};

export const _queryInsertMany = <T extends CreateSelf>(
  q: T,
  data: CreateData<T>[],
): InsertManyResult<T> => {
  const ctx = createCtx();
  let result = insert(q, handleManyData(q, data, ctx), true) as never;
  if (!data.length) result = (result as Query).none() as never;
  return result;
};

export const _queryDefaults = <
  T extends CreateSelf,
  Data extends Partial<CreateData<T>>,
>(
  q: T,
  data: Data,
): AddQueryDefaults<T, { [K in keyof Data]: true }> => {
  (q as unknown as Query).q.defaults = data;
  return q as never;
};

/**
 * Names of all create methods,
 * is used in relational query to remove these methods if chained relation shouldn't have them,
 * for the case of has one/many through.
 */
export type CreateMethodsNames =
  | 'create'
  | 'insert'
  | 'createMany'
  | 'insertMany'
  | CreateFromMethodNames;

export type CreateManyMethodsNames =
  | 'createMany'
  | 'insertMany'
  | CreateManyFromMethodNames;

export class QueryCreate {
  /**
   * `create` and `insert` create a single record.
   *
   * Each column may accept a specific value, a raw SQL, or a query that returns a single value.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * const oneRecord = await db.table.create({
   *   name: 'John',
   *   password: '1234',
   * });
   *
   * // When using `.onConflictDoNothing()`,
   * // the record may be not created and the `createdCount` will be 0.
   * const createdCount = await db.table.insert(data).onConflictDoNothing();
   *
   * await db.table.create({
   *   // raw SQL
   *   column1: () => sql`'John' || ' ' || 'Doe'`,
   *
   *   // query that returns a single value
   *   // returning multiple values will result in Postgres error
   *   column2: () => db.otherTable.get('someColumn'),
   *
   *   // nesting creates, updates, deletes produces a single SQL
   *   column4: () => db.otherTable.create(data).get('someColumn'),
   *   column5: (q) => q.relatedTable.find(id).update(data).get('someColumn'),
   * });
   * ```
   *
   * Creational methods can be used in {@link WithMethods.with} expressions:
   *
   * ```ts
   * db.$qb
   *   // create a record in one table
   *   .with('a', db.table.select('id').create(data))
   *   // create a record in other table using the first table record id
   *   .with('b', (q) =>
   *     db.otherTable.select('id').create({
   *       ...otherData,
   *       aId: () => q.from('a').get('id'),
   *     }),
   *   )
   *   .from('b');
   * ```
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations.
   */
  create<T extends CreateSelf>(this: T, data: CreateData<T>): CreateResult<T> {
    return _queryCreate(_clone(this), data) as never;
  }

  /**
   * Works exactly as {@link create}, except that it returns inserted row count by default.
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations.
   */
  insert<T extends CreateSelf>(this: T, data: CreateData<T>): InsertResult<T> {
    return _queryInsert(_clone(this), data) as never;
  }

  /**
   * `createMany` and `insertMany` will create a batch of records.
   *
   * Each column may be set with a specific value, a raw SQL, or a query, the same as in {@link create}.
   *
   * In case one of the objects has fewer fields, the `DEFAULT` SQL keyword will be placed in its place in the `VALUES` statement.
   *
   * ```ts
   * const manyRecords = await db.table.createMany([
   *   { key: 'value', otherKey: 'other value' },
   *   { key: 'value' }, // default will be used for `otherKey`
   * ]);
   *
   * // `createdCount` will be 3.
   * const createdCount = await db.table.insertMany([data, data, data]);
   * ```
   *
   * When nesting creates, a separate create query will be executed for every time it's used:
   *
   * ```ts
   * // will be performed twice, even though it is defined once
   * const nestedCreate = db.otherTable.create(data).get('column');
   *
   * await db.table.createMany([{ column: nestedCreate }, { column: nestedCreate }]);
   * ```
   *
   * Because of a limitation of Postgres protocol, queries having more than **65535** of values are going to fail in runtime.
   * To solve this seamlessly, `OrchidORM` will automatically batch such queries, and wrap them into a transaction, unless they are already in a transaction.
   *
   * ```ts
   * // OK: executes 2 inserts wrapped into a transaction
   * await db.table.createMany(
   *   Array.from({ length: 65536 }, () => ({ text: 'text' })),
   * );
   * ```
   *
   * However, this only works in the case shown above. This **won't** work if you're using the `createMany` in `with` statement,
   * or if the insert is used as a sub-query in other query part.
   *
   * @param data - array of records data, may have values, raw SQL, queries, relation operations
   */
  createMany<T extends CreateSelf>(
    this: T,
    data: CreateData<T>[],
  ): CreateManyResult<T> {
    return _queryCreateMany(_clone(this), data) as never;
  }

  /**
   * Works exactly as {@link createMany}, except that it returns inserted row count by default.
   *
   * @param data - array of records data, may have values, raw SQL, queries, relation operations
   */
  insertMany<T extends CreateSelf>(
    this: T,
    data: CreateData<T>[],
  ): InsertManyResult<T> {
    return _queryInsertMany(_clone(this), data) as never;
  }

  /**
   * `defaults` allows setting values that will be used later in `create`.
   *
   * Columns provided in `defaults` are marked as optional in the following `create`.
   *
   * Default data is the same as in {@link create} and {@link createMany},
   * so you can provide a raw SQL, or a query with a query.
   *
   * ```ts
   * // Will use firstName from defaults and lastName from create argument:
   * db.table
   *   .defaults({
   *     firstName: 'first name',
   *     lastName: 'last name',
   *   })
   *   .create({
   *     lastName: 'override the last name',
   *   });
   * ```
   *
   * @param data - default values for `create` and `createMany` which will follow `defaults`
   */
  defaults<T extends CreateSelf, Data extends Partial<CreateData<T>>>(
    this: T,
    data: Data,
  ): AddQueryDefaults<T, { [K in keyof Data]: true }> {
    return _queryDefaults(_clone(this) as never, data as never);
  }

  /**
   * By default, violating unique constraint will cause the creative query to throw,
   * you can define what to do on a conflict: to ignore it, or to merge the existing record with a new data.
   *
   * A conflict occurs when a table has a primary key or a unique index on a column,
   * or a composite primary key unique index on a set of columns,
   * and a row being created has the same value as a row that already exists in the table in this column(s).
   *
   * Use {@link onConflictDoNothing} to suppress the error and continue without updating the record,
   * or the `merge` to update the record with new values automatically,
   * or the `set` to specify own values for the update.
   *
   * `onConflict` only accepts column names that are defined in `primaryKey` or `unique` in the table definition.
   * To specify a constraint, its name also must be explicitly set in `primaryKey` or `unique` in the table code.
   *
   * Postgres has a limitation that a single `INSERT` query can have only a single `ON CONFLICT` clause that can target only a single unique constraint
   * for updating the record.
   *
   * If your table has multiple potential reasons for unique constraint violation, such as username and email columns in a user table,
   * consider using `upsert` instead.
   *
   * ```ts
   * // leave `onConflict` without argument to ignore or merge on any conflict
   * db.table.create(data).onConflictDoNothing();
   *
   * // single column:
   * // (this requires a composite primary key or unique index, see below)
   * db.table.create(data).onConflict('email').merge();
   *
   * // array of columns:
   * db.table.create(data).onConflict(['email', 'name']).merge();
   *
   * // constraint name
   * db.table.create(data).onConflict({ constraint: 'unique_index_name' }).merge();
   *
   * // raw SQL expression:
   * db.table
   *   .create(data)
   *   .onConflict(sql`(email) where condition`)
   *   .merge();
   * ```
   *
   * :::info
   * A primary key or a unique index for a **single** column can be fined on a column:
   *
   * ```ts
   * export class MyTable extends BaseTable {
   *   columns = this.setColumns((t) => ({
   *     pkey: t.uuid().primaryKey(),
   *     unique: t.string().unique(),
   *   }));
   * }
   * ```
   *
   * But for composite primary keys or indexes (having multiple columns), define it in a separate function:
   *
   * ```ts
   * export class MyTable extends BaseTable {
   *   columns = this.setColumns(
   *     (t) => ({
   *       one: t.integer(),
   *       two: t.string(),
   *       three: t.boolean(),
   *     }),
   *     (t) => [t.primaryKey(['one', 'two']), t.unique(['two', 'three'])],
   *   );
   * }
   * ```
   * :::
   *
   * You can use the `sql` function exported from your `BaseTable` file in onConflict.
   * It can be useful to specify a condition when you have a partial index:
   *
   * ```ts
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *     active: true,
   *   })
   *   // ignore only when having conflicting email and when active is true.
   *   .onConflict(sql`(email) where active`)
   *   .ignore();
   * ```
   *
   * For `merge` and `set`, you can append `where` to update data only for the matching rows:
   *
   * ```ts
   * const timestamp = Date.now();
   *
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .set({
   *     name: 'John Doe',
   *     updatedAt: timestamp,
   *   })
   *   .where({ updatedAt: { lt: timestamp } });
   * ```
   *
   * @param arg - optionally provide an array of columns
   */
  onConflict<T extends CreateSelf, Arg extends OnConflictArg<T>>(
    this: T,
    arg: Arg,
  ): OnConflictQueryBuilder<T, Arg> {
    return new OnConflictQueryBuilder(this, arg as never);
  }

  /**
   * Use `onConflictDoNothing` to suppress unique constraint violation error when creating a record.
   *
   * Adds `ON CONFLICT (columns) DO NOTHING` clause to the insert statement, columns are optional.
   *
   * Can also accept a constraint name.
   *
   * ```ts
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *   })
   *   // on any conflict:
   *   .onConflictDoNothing()
   *   // or, for a specific column:
   *   .onConflictDoNothing('email')
   *   // or, for a specific constraint:
   *   .onConflictDoNothing({ constraint: 'unique_index_name' });
   * ```
   *
   * When there is a conflict, nothing can be returned from the database, so `onConflictDoNothing` adds `| undefined` part to the response type.
   *
   * ```ts
   * const maybeRecord: RecordType | undefined = await db.table
   *   .create(data)
   *   .onConflictDoNothing();
   *
   * const maybeId: number | undefined = await db.table
   *   .get('id')
   *   .create(data)
   *   .onConflictDoNothing();
   * ```
   *
   * When creating multiple records, only created records will be returned. If no records were created, array will be empty:
   *
   * ```ts
   * // array can be empty
   * const arr = await db.table.createMany([data, data, data]).onConflictDoNothing();
   * ```
   */
  onConflictDoNothing<T extends CreateSelf, Arg extends OnConflictArg<T>>(
    this: T,
    arg?: Arg,
  ): IgnoreResult<T> {
    const q = _clone(this);
    q.q.onConflict = {
      target: arg as never,
    };

    if (q.q.returnType === 'oneOrThrow') {
      q.q.returnType = 'one';
    } else if (q.q.returnType === 'valueOrThrow') {
      q.q.returnType = 'value';
    }

    return q as never;
  }
}

type OnConflictSet<T extends CreateSelf> = {
  [K in keyof T['inputType']]?:
    | T['inputType'][K]
    | (() => QueryOrExpression<T['inputType'][K]>);
};

export class OnConflictQueryBuilder<
  T extends CreateSelf,
  Arg extends OnConflictArg<T> | undefined,
> {
  constructor(private query: T, private onConflict: Arg) {}

  /**
   * Available only after `onConflict`.
   *
   * Updates the record with a given data when conflict occurs.
   *
   * ```ts
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .set({
   *     // supports plain values and SQL expressions
   *     key: 'value',
   *     fromSql: () => sql`custom sql`,
   *   })
   *   // to update records only on certain conditions
   *   .where({ ...certainConditions });
   * ```
   *
   * @param set - object containing new column values
   */
  set(set: OnConflictSet<T>): T {
    let resolved: RecordUnknown | undefined;
    for (const key in set) {
      const column = this.query.shape[key] as unknown as Column.Pick.Data;
      if (column) throwOnReadOnly(this.query, column, key);

      if (typeof set[key] === 'function') {
        if (!resolved) resolved = { ...set };

        resolved[key] = (set[key] as () => unknown)();
      }
    }

    (this.query as unknown as Query).q.onConflict = {
      target: this.onConflict as never,
      set: resolved || set,
    };
    return this.query;
  }

  /**
   * Available only after `onConflict`.
   *
   * Use this method to merge all the data you have passed into `create` to update the existing record on conflict.
   *
   * If the table has columns with **dynamic** default values, such values will be applied as well.
   *
   * You can exclude certain columns from being merged by passing the `except` option.
   *
   * ```ts
   * // merge the full data
   * db.table.create(data).onConflict('email').merge();
   *
   * // merge only a single column
   * db.table.create(data).onConflict('email').merge('name');
   *
   * // merge multiple columns
   * db.table.create(data).onConflict('email').merge(['name', 'quantity']);
   *
   * // merge all columns except some
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .merge({ except: ['name', 'quantity'] });
   *
   * // merge can be applied also for batch creates
   * db.table.createMany([data1, data2, data2]).onConflict('email').merge();
   *
   * // update records only on certain conditions
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .merge()
   *   .where({ ...certainConditions });
   * ```
   *
   * @param merge - no argument will merge all data, or provide a column(s) to merge, or provide `except` to update all except some.
   */
  merge(
    merge?:
      | keyof T['shape']
      | (keyof T['shape'])[]
      | { except: keyof T['shape'] | (keyof T['shape'])[] },
  ): T {
    (this.query as unknown as PickQueryQ).q.onConflict = {
      target: this.onConflict as never,
      merge: merge as OnConflictMerge,
    };
    return this.query;
  }
}
