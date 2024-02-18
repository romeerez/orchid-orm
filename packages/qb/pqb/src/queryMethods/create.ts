import {
  Query,
  QueryReturnsAll,
  queryTypeWithLimitOne,
  SetQueryKind,
  SetQueryReturns,
  SetQueryReturnsAll,
  SetQueryReturnsColumn,
  SetQueryReturnsOne,
  SetQueryReturnsPluckColumn,
  SetQueryReturnsRowCount,
} from '../query/query';
import { RelationConfigDataForCreate, RelationsBase } from '../relations';
import {
  CreateKind,
  InsertQueryData,
  OnConflictItem,
  OnConflictMergeUpdate,
} from '../sql';
import { VirtualColumn } from '../columns';
import { anyShape } from '../query/db';
import {
  Expression,
  QueryThen,
  ColumnSchemaConfig,
  RecordKeyTrue,
  RecordUnknown,
} from 'orchid-core';
import { isSelectingCount } from './aggregate';
import { QueryBase } from '../query/queryBase';

export interface CreateSelf extends QueryBase {
  inputType: RecordUnknown;
}

// Type of argument for `create`, `createMany`, optional argument for `createFrom`,
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
export type CreateData<
  T extends CreateSelf,
  Defaults extends PropertyKey = keyof T['meta']['defaults'],
> = RelationsBase extends T['relations']
  ? // if no relations, don't load TS with extra calculations
    CreateDataWithDefaults<T['inputType'], Defaults>
  : CreateRelationsData<
      T['relations'],
      CreateDataWithDefaults<T['inputType'], Defaults>
    >;

type CreateDataWithDefaults<
  InputType extends RecordUnknown,
  Defaults extends PropertyKey,
> = {
  [K in keyof InputType as K extends Defaults ? never : K]: CreateColumn<
    InputType,
    K
  >;
} & {
  [K in Defaults]?: K extends keyof InputType
    ? CreateColumn<InputType, K>
    : never;
};

// Type of available variants to provide for a specific column when creating
export type CreateColumn<
  InputType extends RecordUnknown,
  Key extends keyof InputType,
> =
  | Expression
  | InputType[Key]
  | {
      __isQuery: true;
      then: QueryThen<InputType[Key]>;
    };

// Combine data of the table with data that can be set for relations
export type CreateRelationsData<Relations extends RelationsBase, Data> =
  // Data except `belongsTo` foreignKeys: { name: string, fooId: number } -> { name: string }
  Omit<
    Data,
    Relations[keyof Relations]['relationConfig']['omitForeignKeyInCreate']
  > &
    // Intersection of objects for `belongsTo` relations:
    // ({ fooId: number } | { foo: object }) & ({ barId: number } | { bar: object })
    CreateRelationsDataOmittingFKeys<Relations> &
    // Union of the rest relations objects, intersection is not needed here because there are no required properties:
    // { foo: object } | { bar: object }
    Relations[keyof Relations]['relationConfig']['optionalDataForCreate'];

// Intersection of relations that may omit foreign key (belongsTo):
// ({ fooId: number } | { foo: object }) & ({ barId: number } | { bar: object })
export type CreateRelationsDataOmittingFKeys<
  Relations extends RelationsBase,
  // Collect a union of `belongsTo` relation objects.
  Union = Relations[keyof Relations]['relationConfig']['dataForCreate'],
> =
  // Based on UnionToIntersection from here https://stackoverflow.com/a/50375286
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (
    Union extends RelationConfigDataForCreate
      ? (u: Union['columns' | 'nested']) => void
      : never
  ) extends (u: infer Obj extends RecordUnknown) => void
    ? Obj
    : never;

// `create` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
type CreateResult<T extends CreateSelf> = T extends { isCount: true }
  ? SetQueryKind<T, 'create'>
  : QueryReturnsAll<T['returnType']> extends true
  ? SetQueryReturnsOne<SetQueryKind<T, 'create'>>
  : T['returnType'] extends 'pluck'
  ? SetQueryReturnsColumn<SetQueryKind<T, 'create'>, T['result']['pluck']>
  : SetQueryKind<T, 'create'>;

// `insert` method output type
// - query returns inserted row count by default.
// - returns a record with selected columns if the query has a select.
// - if the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
type InsertResult<T extends CreateSelf> = T['meta']['hasSelect'] extends true
  ? QueryReturnsAll<T['returnType']> extends true
    ? SetQueryReturnsOne<SetQueryKind<T, 'create'>>
    : T['returnType'] extends 'pluck'
    ? SetQueryReturnsColumn<SetQueryKind<T, 'create'>, T['result']['pluck']>
    : SetQueryKind<T, 'create'>
  : SetQueryReturnsRowCount<SetQueryKind<T, 'create'>>;

// `createMany` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns a single record, forces it to return multiple.
// - otherwise, query result remains as is.
type CreateManyResult<T extends CreateSelf> = T extends { isCount: true }
  ? SetQueryKind<T, 'create'>
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAll<SetQueryKind<T, 'create'>>
  : T['returnType'] extends 'value' | 'valueOrThrow'
  ? SetQueryReturnsPluckColumn<SetQueryKind<T, 'create'>, T['result']['value']>
  : SetQueryKind<T, 'create'>;

// `insertMany` method output type
// - query returns inserted row count by default.
// - returns records with selected columns if the query has a select.
// - if the query returns a single record, forces it to return multiple records.
type InsertManyResult<T extends CreateSelf> =
  T['meta']['hasSelect'] extends true
    ? T['returnType'] extends 'one' | 'oneOrThrow'
      ? SetQueryReturnsAll<SetQueryKind<T, 'create'>>
      : T['returnType'] extends 'value' | 'valueOrThrow'
      ? SetQueryReturnsPluckColumn<
          SetQueryKind<T, 'create'>,
          T['result']['value']
        >
      : SetQueryKind<T, 'create'>
    : SetQueryReturnsRowCount<SetQueryKind<T, 'create'>>;

// `onConflict().ignore()` method output type:
// overrides query return type from 'oneOrThrow' to 'one', from 'valueOrThrow' to 'value',
// because `ignore` won't return any data in case of a conflict.
type IgnoreResult<T extends CreateSelf> = T['returnType'] extends 'oneOrThrow'
  ? SetQueryReturns<T, 'one'>
  : T['returnType'] extends 'valueOrThrow'
  ? SetQueryReturns<T, 'value'>
  : T;

// `createRaw` method argument.
// Contains array of columns and a raw SQL for values.
type CreateRawData<T extends CreateSelf> = {
  columns: (keyof T['shape'])[];
  values: Expression;
};

// `createManyRaw` method argument.
// Contains array of columns and an array of raw SQL for values.
type CreateManyRawData<T extends CreateSelf> = {
  columns: (keyof T['shape'])[];
  values: Expression[];
};

// Record<(column name), true> where the column doesn't have a default, and it is not nullable.
type RawRequiredColumns<T extends CreateSelf> = {
  [K in keyof T['inputType'] as K extends keyof T['meta']['defaults']
    ? never
    : null extends T['inputType'][K]
    ? never
    : undefined extends T['inputType'][K]
    ? never
    : K]: true;
};

// Arguments of `createRaw` and `createManyRaw`.
// TS error if not all required columns are specified.
type CreateRawArgs<
  T extends CreateSelf,
  Arg extends { columns: (keyof T['shape'])[] },
> = keyof RawRequiredColumns<T> extends Arg['columns'][number]
  ? [data: Arg]
  : [
      `Missing required columns: ${Exclude<
        keyof RawRequiredColumns<T> & string,
        Arg['columns'][number]
      >}`,
    ];

// Argument of `onConflict`, can be:
// - a column name
// - an array of column names
// - raw or other kind of Expression
type OnConflictArg<T extends CreateSelf> =
  | keyof T['shape']
  | (keyof T['shape'])[]
  | Expression;

export type AddQueryDefaults<
  T extends CreateSelf,
  Defaults extends RecordKeyTrue,
> = {
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
export type CreateCtx = {
  columns: Map<string, number>;
  returnTypeAll?: true;
  resultAll: RecordUnknown[];
};

// Type of `encodeFn` of columns.
type Encoder = (input: unknown) => unknown;

// Function called by all `create` methods to override query select.
// Clears select if query returning nothing or a count.
// Otherwise, selects all if query doesn't have select.
const createSelect = (q: CreateSelf) => {
  if (q.q.returnType === 'void' || isSelectingCount(q)) {
    q.q.select = undefined;
  } else if (!q.q.select) {
    q.q.select = ['*'];
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
 * @param encoders - to collect `encodeFn`s of columns.
 */
const processCreateItem = (
  q: CreateSelf,
  item: RecordUnknown,
  rowIndex: number,
  ctx: CreateCtx,
  encoders: Record<string, Encoder>,
) => {
  const { shape } = q.q;
  for (const key in item) {
    if (shape[key] instanceof VirtualColumn) {
      (shape[key] as VirtualColumn<ColumnSchemaConfig>).create?.(
        q,
        ctx,
        item,
        rowIndex,
      );
    } else if (
      !ctx.columns.has(key) &&
      ((shape[key] && !shape[key].data.computed) || shape === anyShape)
    ) {
      ctx.columns.set(key, ctx.columns.size);
      encoders[key] = shape[key]?.encodeFn as Encoder;
    }
  }
};

// Creates a new context of create query.
const createCtx = (): CreateCtx => ({
  columns: new Map(),
  resultAll: undefined as unknown as RecordUnknown[],
});

// Packs record values from the provided object into array of values.
// Encode values when the column has an encoder.
const mapColumnValues = (
  columns: string[],
  encoders: Record<string, Encoder>,
  data: RecordUnknown,
): unknown[] => {
  return columns.map((key) =>
    encoders[key] ? encoders[key](data[key]) : data[key],
  );
};

/**
 * Processes arguments of `create`, `insert`, `createFrom` and `insertFrom` when it has data.
 * Apply defaults that may be present on a query object to the data.
 * Maps data object into array of values, encodes values when the column has an encoder.
 *
 * @param q - query object.
 * @param data - argument with data for create.
 * @param ctx - context of the create query.
 */
const handleOneData = (
  q: CreateSelf,
  data: RecordUnknown,
  ctx: CreateCtx,
): { columns: string[]; values: unknown[][] } => {
  const encoders: Record<string, Encoder> = {};
  const defaults = q.q.defaults;

  if (defaults) {
    data = { ...defaults, ...data };
  }

  processCreateItem(q, data, 0, ctx, encoders);

  const columns = Array.from(ctx.columns.keys());
  const values = [mapColumnValues(columns, encoders, data)];

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
const handleManyData = (
  q: CreateSelf,
  data: RecordUnknown[],
  ctx: CreateCtx,
): { columns: string[]; values: unknown[][] } => {
  const encoders: Record<string, Encoder> = {};
  const defaults = q.q.defaults;

  if (defaults) {
    data = data.map((item) => ({ ...defaults, ...item }));
  }

  data.forEach((item, i) => {
    processCreateItem(q, item, i, ctx, encoders);
  });

  const values = Array(data.length);
  const columns = Array.from(ctx.columns.keys());

  data.forEach((item, i) => {
    (values as unknown[][])[i] = mapColumnValues(columns, encoders, item);
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
 * @param values - array of arrays matching columns, or can be an array of SQL expressions, or is a special object for `createFrom`.
 * @param kind - the kind of create query, can be 'object', 'raw', 'from'.
 * @param many - whether it's for creating one or many.
 */
const insert = (
  self: CreateSelf,
  {
    columns,
    values,
  }: {
    columns: string[];
    values: InsertQueryData['values'];
  },
  kind: CreateKind,
  many?: boolean,
) => {
  const { q } = self as { q: InsertQueryData };

  delete q.and;
  delete q.or;

  q.type = 'insert';
  q.columns = columns;
  q.values = values;

  // query kind may be already set by in the ORM
  // so that author.books.create(data) will actually perform the `from` kind of create
  if (!q.kind) q.kind = kind;

  const { select, returnType = 'all' } = q;

  if (!select) {
    if (returnType !== 'void') q.returnType = 'rowCount';
  } else if (many) {
    if (returnType === 'one' || returnType === 'oneOrThrow') {
      q.returnType = 'all';
    } else if (returnType === 'value' || returnType === 'valueOrThrow') {
      q.returnType = 'pluck';
    }
  } else if (returnType === 'all') {
    q.returnType = 'from' in values ? values.from.q.returnType : 'one';
  } else if (returnType === 'pluck') {
    q.returnType = 'valueOrThrow';
  }

  return self;
};

/**
 * Function to collect column names from the inner query of create `from` methods.
 *
 * @param from - inner query to grab the columns from.
 * @param obj - optionally passed object with specific data, only available when creating a single record.
 * @param many - whether it's for `createManyFrom`. If no, throws if the inner query returns multiple records.
 */
const getFromSelectColumns = (
  from: CreateSelf,
  obj?: { columns: string[] },
  many?: boolean,
) => {
  if (!many && !queryTypeWithLimitOne[from.q.returnType]) {
    throw new Error(
      'Cannot create based on a query which returns multiple records',
    );
  }

  const queryColumns: string[] = [];
  from.q.select?.forEach((item) => {
    if (typeof item === 'string') {
      const index = item.indexOf('.');
      queryColumns.push(index === -1 ? item : item.slice(index + 1));
    } else if ('selectAs' in item) {
      queryColumns.push(...Object.keys(item.selectAs));
    }
  });

  if (obj?.columns) {
    queryColumns.push(...obj.columns);
  }

  return queryColumns;
};

/**
 * Is used by all create from queries methods.
 * Collects columns and values from the inner query and optionally from the given data,
 * calls {@link insert} with a 'from' kind of create query.
 *
 * @param q - query object.
 * @param from - inner query from which to create new records.
 * @param many - whether creating many.
 * @param data - optionally passed custom data when creating a single record.
 */
const insertFromQuery = <
  T extends CreateSelf,
  Q extends Query,
  Many extends boolean,
>(
  q: T,
  from: Q,
  many: Many,
  data?: Omit<CreateData<T>, keyof Q['result']>,
) => {
  const ctx = createCtx();

  const obj = data && handleOneData(q, data, ctx);

  const columns = getFromSelectColumns(from, obj, many);

  return insert(
    q,
    {
      columns,
      values: { from, values: obj?.values },
    },
    'from',
    many,
  );
};

export const _queryCreate = <T extends CreateSelf>(
  q: T,
  data: CreateData<T>,
): CreateResult<T> => {
  createSelect(q);
  return _queryInsert(q, data) as unknown as CreateResult<T>;
};

export const _queryInsert = <T extends CreateSelf>(
  q: T,
  data: CreateData<T>,
): InsertResult<T> => {
  const ctx = createCtx();
  const obj = handleOneData(q, data, ctx) as {
    columns: string[];
    values: InsertQueryData['values'];
  };

  const values = (q.q as InsertQueryData).values;
  if (values && 'from' in values) {
    obj.columns = getFromSelectColumns(values.from, obj);
    values.values = obj.values as unknown[][];
    obj.values = values;
  }

  return insert(q, obj, 'object') as InsertResult<T>;
};

export const _queryCreateMany = <T extends CreateSelf>(
  q: T,
  data: CreateData<T>[],
): CreateManyResult<T> => {
  createSelect(q);
  return _queryInsertMany(q, data) as unknown as CreateManyResult<T>;
};

export const _queryInsertMany = <T extends CreateSelf>(
  q: T,
  data: CreateData<T>[],
) => {
  const ctx = createCtx();
  return insert(
    q,
    handleManyData(q, data, ctx),
    'object',
    true,
  ) as InsertManyResult<T>;
};

export const _queryCreateRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateRawData<T>>,
): CreateResult<T> => {
  createSelect(q);
  return insert(
    q,
    args[0] as { columns: string[]; values: Expression },
    'raw',
  ) as CreateResult<T>;
};

export const _queryInsertRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateRawData<T>>,
): InsertResult<T> => {
  return insert(
    q,
    args[0] as { columns: string[]; values: Expression },
    'raw',
  ) as InsertResult<T>;
};

export const _queryCreateManyRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateManyRawData<T>>,
): CreateManyResult<T> => {
  createSelect(q);
  return _queryInsertManyRaw(q, args) as CreateManyResult<T>;
};

export const _queryInsertManyRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateManyRawData<T>>,
): InsertManyResult<T> => {
  return insert(
    q,
    args[0] as { columns: string[]; values: Expression[] },
    'raw',
    true,
  ) as InsertManyResult<T>;
};

export const _queryCreateFrom = <
  T extends CreateSelf,
  Q extends Query & { returnType: 'one' | 'oneOrThrow' },
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T>, keyof Q['result']>,
): CreateResult<T> => {
  createSelect(q);
  return insertFromQuery(q, query, false, data) as CreateResult<T>;
};

export const _queryInsertFrom = <
  T extends CreateSelf,
  Q extends Query & { returnType: 'one' | 'oneOrThrow' },
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T>, keyof Q['result']>,
): InsertResult<T> => {
  return insertFromQuery(q, query, false, data) as InsertResult<T>;
};

export const _queryCreateManyFrom = <T extends CreateSelf>(
  q: T,
  query: Query,
): CreateManyResult<T> => {
  createSelect(q);
  return insertFromQuery(q, query, true) as CreateManyResult<T>;
};

export const _queryInsertManyFrom = <T extends CreateSelf>(
  q: T,
  query: Query,
): InsertManyResult<T> => {
  return insertFromQuery(q, query, true) as InsertManyResult<T>;
};

export const _queryDefaults = <
  T extends CreateSelf,
  Data extends Partial<CreateData<T>>,
>(
  q: T,
  data: Data,
): AddQueryDefaults<T, Record<keyof Data, true>> => {
  q.q.defaults = data;
  return q as AddQueryDefaults<T, Record<keyof Data, true>>;
};

/**
 * Names of all create methods,
 * is used in {@link RelationQuery} to remove these methods if chained relation shouldn't have them,
 * for the case of has one/many through.
 */
export type CreateMethodsNames =
  | 'create'
  | 'insert'
  | 'createMany'
  | 'insertMany'
  | 'createRaw'
  | 'insertRaw'
  | 'createFrom'
  | 'insertFrom'
  | 'createManyFrom'
  | 'insertManyFrom';

export class Create {
  /**
   * `create` and `insert` will create one record.
   *
   * Each column may accept a specific value, a raw SQL, or a query that returns a single value.
   *
   * ```ts
   * const oneRecord = await db.table.create({
   *   name: 'John',
   *   password: '1234',
   * });
   *
   * // When using `.onConflict().ignore()`,
   * // the record may be not created and the `createdCount` will be 0.
   * const createdCount = await db.table.insert(data).onConflict().ignore();
   *
   * await db.table.create({
   *   // raw SQL
   *   column1: db.table.sql`'John' | 'Doe'`,
   *
   *   // query that returns a single value
   *   // returning multiple values will result in Postgres error
   *   column2: db.otherTable.get('someColumn'),
   * });
   * ```
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations.
   */
  create<T extends CreateSelf>(this: T, data: CreateData<T>): CreateResult<T> {
    return _queryCreate(this.clone(), data);
  }

  /**
   * Works exactly as {@link create}, except that it returns inserted row count by default.
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations.
   */
  insert<T extends CreateSelf>(this: T, data: CreateData<T>): InsertResult<T> {
    return _queryInsert(this.clone(), data);
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
   * @param data - array of records data, may have values, raw SQL, queries, relation operations
   */
  createMany<T extends CreateSelf>(
    this: T,
    data: CreateData<T>[],
  ): CreateManyResult<T> {
    return _queryCreateMany(this.clone(), data);
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
    return _queryInsertMany(this.clone(), data);
  }

  /**
   * `createRaw` and `insertRaw` are for creating one record with a raw SQL expression.
   *
   * Provided SQL will be wrapped into parens for a single `VALUES` record.
   *
   * If the table has a column with runtime defaults (defined with callbacks), the value will be appended to your SQL.
   *
   * `columns` are type-checked to contain all required columns.
   *
   * ```ts
   * const oneRecord = await db.table.createRaw({
   *   columns: ['name', 'amount'],
   *   values: db.table.sql`'name', random()`,
   * });
   * ```
   *
   * @param args - object with columns list and raw SQL for values
   */
  createRaw<T extends CreateSelf>(
    this: T,
    ...args: CreateRawArgs<T, CreateRawData<T>>
  ): CreateResult<T> {
    return _queryCreateRaw(this.clone(), args);
  }

  /**
   * Works exactly as {@link createRaw}, except that it returns inserted row count by default.
   *
   * @param args - object with columns list and raw SQL for values
   */
  insertRaw<T extends CreateSelf>(
    this: T,
    ...args: CreateRawArgs<T, CreateRawData<T>>
  ): InsertResult<T> {
    return _queryInsertRaw(this.clone(), args);
  }

  /**
   * `createManyRaw` and `insertManyRaw` are for creating many record with raw SQL expressions.
   *
   * Takes array of SQL expressions, each of them will be wrapped into parens for `VALUES` records.
   *
   * If the table has a column with runtime defaults (defined with callbacks), function will be called for each SQL and the value will be appended.
   *
   * `columns` are type-checked to contain all required columns.
   *
   * ```ts
   * const manyRecords = await db.table.createManyRaw({
   *   columns: ['name', 'amount'],
   *   values: [db.table.sql`'one', 2`, db.table.sql`'three', 4`],
   * });
   * ```
   *
   * @param args - object with columns list and array of raw SQL for values
   */
  createManyRaw<T extends CreateSelf>(
    this: T,
    ...args: CreateRawArgs<T, CreateManyRawData<T>>
  ): CreateManyResult<T> {
    return _queryCreateManyRaw(this.clone(), args);
  }

  /**
   * Works exactly as {@link createManyRaw}, except that it returns inserted row count by default.
   *
   * @param args - object with columns list and array of raw SQL for values
   */
  insertManyRaw<T extends CreateSelf>(
    this: T,
    ...args: CreateRawArgs<T, CreateManyRawData<T>>
  ): InsertManyResult<T> {
    return _queryInsertManyRaw(this.clone(), args);
  }

  /**
   * These methods are for creating a single record, for batch creating see {@link createManyFrom}.
   *
   * `createFrom` is to perform the `INSERT ... SELECT ...` SQL statement, it does select and insert by performing a single query.
   *
   * The first argument is a query for a **single** record, it should have `find`, `take`, or similar.
   *
   * The second optional argument is a data which will be merged with columns returned from the select query.
   *
   * The data for the second argument is the same as in {@link create}.
   *
   * Columns with runtime defaults (defined with a callback) are supported here.
   * The value for such a column will be injected unless selected from a related table or provided in a data object.
   *
   * ```ts
   * const oneRecord = await db.table.createFrom(
   *   // In the select, key is a related table column, value is a column to insert as
   *   RelatedTable.select({ relatedId: 'id' }).findBy({ key: 'value' }),
   *   // optional argument:
   *   {
   *     key: 'value',
   *   },
   * );
   * ```
   *
   * The query above will produce such SQL:
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
  createFrom<
    T extends CreateSelf,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data?: Omit<CreateData<T>, keyof Q['result']>,
  ): CreateResult<T> {
    return _queryCreateFrom(this.clone(), query, data);
  }

  /**
   * Works exactly as {@link createFrom}, except that it returns inserted row count by default.
   *
   * @param query - query to create new records from
   * @param data - additionally you can set some columns
   */
  insertFrom<
    T extends CreateSelf,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data?: Omit<CreateData<T>, keyof Q['result']>,
  ): InsertResult<T> {
    return _queryInsertFrom(this.clone(), query, data);
  }

  /**
   * Similar to `createFrom`, but intended to create many records.
   *
   * Unlike `createFrom`, it doesn't accept second argument with data, and runtime defaults cannot work with it.
   *
   * ```ts
   * const manyRecords = await db.table.createManyFrom(
   *   RelatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
   * );
   * ```
   *
   * @param query - query to create new records from
   */
  createManyFrom<T extends CreateSelf>(
    this: T,
    query: Query,
  ): CreateManyResult<T> {
    return _queryCreateManyFrom(this.clone(), query);
  }

  /**
   * Works exactly as {@link createManyFrom}, except that it returns inserted row count by default.
   *
   * @param query - query to create new records from
   */
  insertManyFrom<T extends CreateSelf>(
    this: T,
    query: Query,
  ): InsertManyResult<T> {
    return _queryInsertManyFrom(this.clone(), query);
  }

  /**
   * `defaults` allows setting values that will be used later in `create`.
   *
   * Columns provided in `defaults` are marked as optional in the following `create`.
   *
   * Default data is the same as in [create](#create) and [createMany](#createMany),
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
  ): AddQueryDefaults<T, Record<keyof Data, true>> {
    return _queryDefaults(this.clone(), data);
  }

  /**
   * A modifier for creating queries that specify alternative behavior in the case of a conflict.
   * A conflict occurs when a table has a `PRIMARY KEY` or a `UNIQUE` index on a column
   * (or a composite index on a set of columns) and a row being created has the same value as a row
   * that already exists in the table in this column(s).
   * The default behavior in case of conflict is to raise an error and abort the query.
   *
   * Use `onConflict` to either ignore the error by using `.onConflict().ignore()`,
   * or to update the existing row with new data (perform an "UPSERT") by using `.onConflict().merge()`.
   *
   * ```ts
   * // leave `onConflict` without argument to ignore or merge on any conflict
   * db.table.create(data).onConflict().ignore();
   *
   * // single column:
   * db.table.create(data).onConfict('email');
   *
   * // array of columns:
   * db.table.create(data).onConfict(['email', 'name']);
   *
   * // raw expression:
   * db.table.create(data).onConfict(db.table.sql`(email) where condition`);
   * ```
   *
   * ::: info
   * The column(s) given to the `onConflict` must either be the table's PRIMARY KEY or have a UNIQUE index on them, or the query will fail to execute.
   * When specifying multiple columns, they must be a composite PRIMARY KEY or have a composite UNIQUE index.
   *
   * You can use the db.table.sql function in onConflict.
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
   *   .onConflict(db.table.sql`(email) where active`)
   *   .ignore();
   * ```
   *
   * :::
   *
   * See the documentation on the .ignore() and .merge() methods for more details.
   *
   * @param arg - optionally provide an array of columns
   */
  onConflict<T extends CreateSelf, Arg extends OnConflictArg<T>>(
    this: T,
    arg?: Arg,
  ): OnConflictQueryBuilder<T, Arg> {
    return new OnConflictQueryBuilder(this, arg as Arg);
  }
}

export class OnConflictQueryBuilder<
  T extends CreateSelf,
  Arg extends OnConflictArg<T> | undefined,
> {
  constructor(private query: T, private onConflict: Arg) {}

  /**
   * Available only after `onConflict`.
   *
   * `ignore` modifies a create query, and causes it to be silently dropped without an error if a conflict occurs.
   *
   * Adds the `ON CONFLICT (columns) DO NOTHING` clause to the insert statement.
   *
   * It produces `ON CONFLICT DO NOTHING` when no `onConflict` argument provided.
   *
   * ```ts
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *   })
   *   .onConflict('email')
   *   .ignore();
   * ```
   *
   *
   * When there is a conflict, nothing can be returned from the database, that's why `ignore` has to add `| undefined` part to the response type.
   *
   * `create` returns a full record by default, it becomes `RecordType | undefined` after applying `ignore`.
   *
   * ```ts
   * const maybeRecord: RecordType | undefined = await db.table
   *   .create(data)
   *   .onConflict()
   *   .ignore();
   *
   * const maybeId: number | undefined = await db.table
   *   .get('id')
   *   .create(data)
   *   .onConflict()
   *   .ignore();
   * ```
   *
   * When creating many records, only the created records will be returned. If no records were created, array will be empty:
   *
   * ```ts
   * // array can be empty
   * const arr = await db.table.createMany([data, data, data]).onConflict().ignore();
   * ```
   */
  ignore(): IgnoreResult<T> {
    const q = this.query;
    (q.q as InsertQueryData).onConflict = {
      type: 'ignore',
      expr: this.onConflict as OnConflictItem,
    };

    if (q.q.returnType === 'oneOrThrow') {
      q.q.returnType = 'one';
    } else if (q.q.returnType === 'valueOrThrow') {
      q.q.returnType = 'value';
    }

    return q as IgnoreResult<T>;
  }

  /**
   * Available only after `onConflict`.
   *
   * Modifies a create query, to turn it into an 'upsert' operation.
   *
   * Adds an `ON CONFLICT (columns) DO UPDATE` clause to the insert statement.
   *
   * When no `onConflict` argument provided,
   * it will automatically collect all table columns that have unique index and use them as a conflict target.
   *
   * ```ts
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *   })
   *   .onConflict('email')
   *   .merge();
   * ```
   *
   * This also works with batch creates:
   *
   * ```ts
   * db.table
   *   .createMany([
   *     { email: 'john@example.com', name: 'John Doe' },
   *     { email: 'jane@example.com', name: 'Jane Doe' },
   *     { email: 'alex@example.com', name: 'Alex Doe' },
   *   ])
   *   .onConflict('email')
   *   .merge();
   * ```
   *
   * It is also possible to specify a subset of the columns to merge when a conflict occurs.
   * For example, you may want to set a `createdAt` column when creating but would prefer not to update it if the row already exists:
   *
   * ```ts
   * const timestamp = Date.now();
   *
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *     createdAt: timestamp,
   *     updatedAt: timestamp,
   *   })
   *   .onConflict('email')
   *   // string argument for a single column:
   *   .merge('email')
   *   // array of strings for multiple columns:
   *   .merge(['email', 'name', 'updatedAt']);
   * ```
   *
   * It is also possible to specify data to update separately from the data to create.
   * This is useful if you want to make an update with different data than in creating.
   * For example, you may want to change a value if the row already exists:
   *
   * ```ts
   * const timestamp = Date.now();
   *
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *     createdAt: timestamp,
   *     updatedAt: timestamp,
   *   })
   *   .onConflict('email')
   *   .merge({
   *     name: 'John Doe The Second',
   *   });
   * ```
   *
   * It is also possible to add a WHERE clause to conditionally update only the matching rows:
   *
   * ```ts
   * const timestamp = Date.now();
   *
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *     createdAt: timestamp,
   *     updatedAt: timestamp,
   *   })
   *   .onConflict('email')
   *   .merge({
   *     name: 'John Doe',
   *     updatedAt: timestamp,
   *   })
   *   .where({ updatedAt: { lt: timestamp } });
   * ```
   *
   * `merge` also accepts raw expression:
   *
   * ```ts
   * db.table
   *   .create(data)
   *   .onConflict()
   *   .merge(db.table.sql`raw SQL expression`);
   * ```
   *
   * @param update - column, or array of columns, or object for new column values, or raw SQL
   */
  merge(
    update?:
      | keyof T['shape']
      | (keyof T['shape'])[]
      | Partial<T['inputType']>
      | Expression,
  ): T {
    (this.query.q as InsertQueryData).onConflict = {
      type: 'merge',
      expr: this.onConflict as OnConflictItem,
      update: update as OnConflictMergeUpdate,
    };
    return this.query;
  }
}
