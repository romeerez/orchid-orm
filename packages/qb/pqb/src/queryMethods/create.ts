import {
  Query,
  QueryOrExpression,
  QueryReturnsAll,
  queryTypeWithLimitOne,
  SetQueryKind,
  SetQueryKindResult,
  SetQueryReturnsAllKind,
  SetQueryReturnsAllKindResult,
  SetQueryReturnsColumnKind,
  SetQueryReturnsColumnKindResult,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsOneKind,
  SetQueryReturnsOneKindResult,
  SetQueryReturnsOneOptional,
  SetQueryReturnsPluckColumnKind,
  SetQueryReturnsPluckColumnKindResult,
  SetQueryReturnsRowCount,
} from '../query/query';
import { RelationConfigDataForCreate, RelationsBase } from '../relations';
import {
  CreateKind,
  InsertQueryData,
  OnConflictMerge,
  ToSQLQuery,
} from '../sql';
import { VirtualColumn } from '../columns';
import { anyShape } from '../query/db';
import {
  Expression,
  ColumnSchemaConfig,
  RecordUnknown,
  PickQueryUniqueProperties,
  QueryColumn,
  FnUnknownToUnknown,
  isExpression,
} from 'orchid-core';
import { isSelectingCount } from './aggregate';
import { QueryBase } from '../query/queryBase';
import { resolveSubQueryCallback } from '../common/utils';

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
  BelongsToData = CreateBelongsToData<T>,
> = RelationsBase extends T['relations']
  ? // if no relations, don't load TS with extra calculations
    CreateDataWithDefaults<T, keyof T['meta']['defaults']>
  : CreateRelationsData<T, BelongsToData>;

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
> =
  | T['inputType'][K]
  | QueryOrExpression<T['inputType'][K]>
  | ((q: T) => QueryOrExpression<T['inputType'][K]>);

// Combine data of the table with data that can be set for relations
export type CreateRelationsData<T extends CreateSelf, BelongsToData> =
  // Data except `belongsTo` foreignKeys: { name: string, fooId: number } -> { name: string }
  CreateDataWithDefaultsForRelations<
    T,
    keyof T['meta']['defaults'],
    T['relations'][keyof T['relations']]['relationConfig']['omitForeignKeyInCreate']
  > &
    BelongsToData &
    // Union of the rest relations objects, intersection is not needed here because there are no required properties:
    // { foo: object } | { bar: object }
    T['relations'][keyof T['relations']]['relationConfig']['optionalDataForCreate'];

// Intersection of objects for `belongsTo` relations:
// ({ fooId: number } | { foo: object }) & ({ barId: number } | { bar: object })
export type CreateBelongsToData<T extends CreateSelf> =
  CreateRelationsDataOmittingFKeys<
    T,
    T['relations'][keyof T['relations']]['relationConfig']['dataForCreate']
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
          keyof Union['columns'] extends keyof T['meta']['defaults']
            ? Omit<Union['columns'], keyof T['meta']['defaults']> & {
                [P in keyof T['meta']['defaults'] &
                  keyof Union['columns']]?: Union['columns'][P];
              } & Partial<Union['nested']>
            : Union['columns'] | Union['nested'],
        ) => void
      : never
  ) extends // must be handled as a function argument, belongsTo.test relies on this
  (u: infer Obj extends RecordUnknown) => void
    ? Obj
    : never;

// `create` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
type CreateResult<T extends CreateSelf, BT> = T extends { isCount: true }
  ? SetQueryKind<T, 'create'>
  : QueryReturnsAll<T['returnType']> extends true
  ? SetQueryReturnsOneKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : T['returnType'] extends 'pluck'
  ? SetQueryReturnsColumnKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>;

type CreateRawOrFromResult<T extends CreateSelf> = T extends { isCount: true }
  ? SetQueryKind<T, 'create'>
  : QueryReturnsAll<T['returnType']> extends true
  ? SetQueryReturnsOneKind<T, 'create'>
  : T['returnType'] extends 'pluck'
  ? SetQueryReturnsColumnKind<T, 'create'>
  : SetQueryKind<T, 'create'>;

// `insert` method output type
// - query returns inserted row count by default.
// - returns a record with selected columns if the query has a select.
// - if the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
type InsertResult<
  T extends CreateSelf,
  BT,
> = T['meta']['hasSelect'] extends true
  ? QueryReturnsAll<T['returnType']> extends true
    ? SetQueryReturnsOneKindResult<T, 'create', NarrowCreateResult<T, BT>>
    : T['returnType'] extends 'pluck'
    ? SetQueryReturnsColumnKindResult<T, 'create', NarrowCreateResult<T, BT>>
    : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryReturnsRowCount<T, 'create'>;

type InsertRawOrFromResult<T extends CreateSelf> =
  T['meta']['hasSelect'] extends true
    ? QueryReturnsAll<T['returnType']> extends true
      ? SetQueryReturnsOneKind<T, 'create'>
      : T['returnType'] extends 'pluck'
      ? SetQueryReturnsColumnKind<T, 'create'>
      : SetQueryKind<T, 'create'>
    : SetQueryReturnsRowCount<T, 'create'>;

// `createMany` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns a single record, forces it to return multiple.
// - otherwise, query result remains as is.
type CreateManyResult<T extends CreateSelf, BT> = T extends { isCount: true }
  ? SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAllKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : T['returnType'] extends 'value' | 'valueOrThrow'
  ? SetQueryReturnsPluckColumnKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>;

type CreateManyRawOrFromResult<T extends CreateSelf> = T extends {
  isCount: true;
}
  ? SetQueryKind<T, 'create'>
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAllKind<T, 'create'>
  : T['returnType'] extends 'value' | 'valueOrThrow'
  ? SetQueryReturnsPluckColumnKind<T, 'create'>
  : SetQueryKind<T, 'create'>;

// `insertMany` method output type
// - query returns inserted row count by default.
// - returns records with selected columns if the query has a select.
// - if the query returns a single record, forces it to return multiple records.
type InsertManyResult<
  T extends CreateSelf,
  BT,
> = T['meta']['hasSelect'] extends true
  ? T['returnType'] extends 'one' | 'oneOrThrow'
    ? SetQueryReturnsAllKindResult<T, 'create', NarrowCreateResult<T, BT>>
    : T['returnType'] extends 'value' | 'valueOrThrow'
    ? SetQueryReturnsPluckColumnKindResult<
        T,
        'create',
        NarrowCreateResult<T, BT>
      >
    : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryReturnsRowCount<T, 'create'>;

type InsertManyRawOrFromResult<T extends CreateSelf> =
  T['meta']['hasSelect'] extends true
    ? T['returnType'] extends 'one' | 'oneOrThrow'
      ? SetQueryReturnsAllKind<T, 'create'>
      : T['returnType'] extends 'value' | 'valueOrThrow'
      ? SetQueryReturnsPluckColumnKind<T, 'create'>
      : SetQueryKind<T, 'create'>
    : SetQueryReturnsRowCount<T, 'create'>;

/**
 * When creating a record with a *belongs to* nested record,
 * un-nullify foreign key columns of the result.
 *
 * The same should work as well with any non-null columns passed to `create`, but it's to be implemented later.
 */
type NarrowCreateResult<T extends CreateSelf, BT> = [
  T['relations'][keyof T['relations'] &
    keyof BT]['relationConfig']['omitForeignKeyInCreate'],
] extends [never]
  ? T['result']
  : {
      [K in keyof T['result']]: K extends T['relations'][keyof T['relations'] &
        keyof BT]['relationConfig']['omitForeignKeyInCreate']
        ? QueryColumn<
            Exclude<T['result'][K]['type'], null>,
            T['result'][K]['operators']
          >
        : T['result'][K];
    };

// `onConflictDoNothing()` method output type:
// overrides query return type from 'oneOrThrow' to 'one', from 'valueOrThrow' to 'value',
// because `ignore` won't return any data in case of a conflict.
type IgnoreResult<T extends CreateSelf> = T['returnType'] extends 'oneOrThrow'
  ? SetQueryReturnsOneOptional<T>
  : T['returnType'] extends 'valueOrThrow'
  ? SetQueryReturnsColumnOptional<T, T['result']['value']>
  : T;

// `createRaw` method argument.
// Contains array of columns and a raw SQL for values.
interface CreateRawData<T extends CreateSelf> {
  columns: (keyof T['shape'])[];
  values: Expression;
}

// `createManyRaw` method argument.
// Contains array of columns and an array of raw SQL for values.
interface CreateManyRawData<T extends CreateSelf> {
  columns: (keyof T['shape'])[];
  values: Expression[];
}

// Record<(column name), true> where the column doesn't have a default, and it is not nullable.
type RawRequiredColumns<T extends CreateSelf> = {
  [K in keyof T['inputType'] as K extends keyof T['meta']['defaults']
    ? never
    : null | undefined extends T['inputType'][K]
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

// Type of `encodeFn` of columns.
interface RecordEncoder {
  [K: string]: FnUnknownToUnknown;
}

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
  encoders: RecordEncoder,
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
    } else {
      if (typeof item[key] === 'function') {
        item[key] = resolveSubQueryCallback(
          q as unknown as ToSQLQuery,
          item[key] as (q: ToSQLQuery) => ToSQLQuery,
        );
      }

      if (
        !ctx.columns.has(key) &&
        ((shape[key] && !shape[key].data.computed) || shape === anyShape)
      ) {
        ctx.columns.set(key, ctx.columns.size);
        encoders[key] = shape[key]?.encodeFn as FnUnknownToUnknown;
      }
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
  encoders: RecordEncoder,
  data: RecordUnknown,
): unknown[] => {
  return columns.map((key) =>
    encoders[key] && !isExpression(data[key])
      ? encoders[key](data[key])
      : data[key],
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
  const encoders: RecordEncoder = {};
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
  const encoders: RecordEncoder = {};
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
  delete q.scopes;

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
  data?: Omit<CreateData<T, never>, keyof Q['result']>,
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

export const _queryCreate = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>,
): CreateResult<T, BT> => {
  createSelect(q);
  return _queryInsert(q, data) as never;
};

export const _queryInsert = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>,
): InsertResult<T, BT> => {
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

  return insert(q, obj, 'object') as never;
};

export const _queryCreateMany = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>[],
): CreateManyResult<T, BT> => {
  createSelect(q);
  return _queryInsertMany(q, data as never) as never;
};

export const _queryInsertMany = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>[],
): InsertManyResult<T, BT> => {
  const ctx = createCtx();
  let result = insert(
    q,
    handleManyData(q, data, ctx),
    'object',
    true,
  ) as InsertManyResult<T, BT>;
  if (!data.length)
    result = (result as Query).none() as InsertManyResult<T, BT>;
  return result;
};

export const _queryCreateRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateRawData<T>>,
): CreateRawOrFromResult<T> => {
  createSelect(q);
  return insert(
    q,
    args[0] as { columns: string[]; values: Expression },
    'raw',
  ) as never;
};

export const _queryInsertRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateRawData<T>>,
): InsertRawOrFromResult<T> => {
  return insert(
    q,
    args[0] as { columns: string[]; values: Expression },
    'raw',
  ) as never;
};

export const _queryCreateManyRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateManyRawData<T>>,
): CreateManyRawOrFromResult<T> => {
  createSelect(q);
  return _queryInsertManyRaw(q, args as never) as never;
};

export const _queryInsertManyRaw = <T extends CreateSelf>(
  q: T,
  args: CreateRawArgs<T, CreateManyRawData<T>>,
): InsertManyRawOrFromResult<T> => {
  return insert(
    q,
    args[0] as { columns: string[]; values: Expression[] },
    'raw',
    true,
  ) as never;
};

export const _queryCreateFrom = <
  T extends CreateSelf,
  Q extends Query & { returnType: 'one' | 'oneOrThrow' },
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
): CreateRawOrFromResult<T> => {
  createSelect(q);
  return insertFromQuery(q, query, false, data as never) as never;
};

export const _queryInsertFrom = <
  T extends CreateSelf,
  Q extends Query & { returnType: 'one' | 'oneOrThrow' },
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
): InsertRawOrFromResult<T> => {
  return insertFromQuery(q, query, false, data as never) as never;
};

export const _queryCreateManyFrom = <T extends CreateSelf>(
  q: T,
  query: Query,
): CreateManyRawOrFromResult<T> => {
  createSelect(q);
  return insertFromQuery(q, query, true) as never;
};

export const _queryInsertManyFrom = <T extends CreateSelf>(
  q: T,
  query: Query,
): InsertManyRawOrFromResult<T> => {
  return insertFromQuery(q, query, true) as never;
};

export const _queryDefaults = <
  T extends CreateSelf,
  Data extends Partial<CreateData<T, CreateBelongsToData<T>>>,
>(
  q: T,
  data: Data,
): AddQueryDefaults<T, { [K in keyof Data]: true }> => {
  q.q.defaults = data;
  return q as never;
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
   * // When using `.onConflictDoNothing()`,
   * // the record may be not created and the `createdCount` will be 0.
   * const createdCount = await db.table.insert(data).onConflictDoNothing();
   *
   * await db.table.create({
   *   // raw SQL
   *   column1: (q) => q.sql`'John' || ' ' || 'Doe'`,
   *
   *   // query that returns a single value
   *   // returning multiple values will result in Postgres error
   *   column2: db.otherTable.get('someColumn'),
   * });
   * ```
   *
   * `create` and `insert` can be used in {@link WithMethods.with} expressions:
   *
   * ```ts
   * db.$queryBuilder
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
  create<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>,
  ): CreateResult<T, BT> {
    return _queryCreate(this.clone(), data);
  }

  /**
   * Works exactly as {@link create}, except that it returns inserted row count by default.
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations.
   */
  insert<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>,
  ): InsertResult<T, BT> {
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
   * Because of a limitation of Postgres protocol, queries having more than **65535** of values are going to fail in runtime.
   * To solve this seamlessly, OrchidORM will automatically batch such queries, and wrap them into a transaction, unless they are already in a transaction.
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
  createMany<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>[],
  ): CreateManyResult<T, BT> {
    return _queryCreateMany(this.clone(), data);
  }

  /**
   * Works exactly as {@link createMany}, except that it returns inserted row count by default.
   *
   * @param data - array of records data, may have values, raw SQL, queries, relation operations
   */
  insertMany<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>[],
  ): InsertManyResult<T, BT> {
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
   *   values: sql`'name', random()`,
   * });
   * ```
   *
   * @param args - object with columns list and raw SQL for values
   */
  createRaw<T extends CreateSelf>(
    this: T,
    ...args: CreateRawArgs<T, CreateRawData<T>>
  ): CreateRawOrFromResult<T> {
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
  ): InsertRawOrFromResult<T> {
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
   *   values: [sql`'one', 2`, sql`'three', 4`],
   * });
   * ```
   *
   * @param args - object with columns list and array of raw SQL for values
   */
  createManyRaw<T extends CreateSelf>(
    this: T,
    ...args: CreateRawArgs<T, CreateManyRawData<T>>
  ): CreateManyRawOrFromResult<T> {
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
  ): InsertManyRawOrFromResult<T> {
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
    data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
  ): CreateRawOrFromResult<T> {
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
    data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
  ): InsertRawOrFromResult<T> {
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
  ): CreateManyRawOrFromResult<T> {
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
  ): InsertManyRawOrFromResult<T> {
    return _queryInsertManyFrom(this.clone(), query);
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
  defaults<
    T extends CreateSelf,
    Data extends Partial<CreateData<T, CreateBelongsToData<T>>>,
  >(this: T, data: Data): AddQueryDefaults<T, { [K in keyof Data]: true }> {
    return _queryDefaults(this.clone(), data);
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
    return new OnConflictQueryBuilder(this, arg as Arg);
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
    const q = this.clone();
    (q.q as InsertQueryData).onConflict = {
      target: arg,
    };

    if (q.q.returnType === 'oneOrThrow') {
      q.q.returnType = 'one';
    } else if (q.q.returnType === 'valueOrThrow') {
      q.q.returnType = 'value';
    }

    return q as never;
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
   * Updates the record with a given data when conflict occurs.
   *
   * ```ts
   * db.table.create(data).onConflict('column').set({
   *   description: 'setting different data on conflict',
   * });
   * ```
   *
   * The `set` can take a raw SQL expression:
   *
   * ```ts
   * db.table
   *   .create(data)
   *   .onConflict()
   *   .set(sql`raw SQL expression`);
   *
   * // update records only on certain conditions
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .set({ key: 'value' })
   *   .where({ ...certainConditions });
   * ```
   *
   * @param set - object containing new column values, or raw SQL
   */
  set(set: Partial<T['inputType']> | Expression): T {
    (this.query.q as InsertQueryData).onConflict = {
      target: this.onConflict,
      set,
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
   * You can exclude certain columns from being merged by passing the `exclude` option.
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
    (this.query.q as InsertQueryData).onConflict = {
      target: this.onConflict,
      merge: merge as OnConflictMerge,
    };
    return this.query;
  }
}
