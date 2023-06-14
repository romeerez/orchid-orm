import {
  Query,
  QueryReturnsAll,
  queryTypeWithLimitOne,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
} from '../query';
import {
  BelongsToRelation,
  HasAndBelongsToManyRelation,
  HasManyRelation,
  HasOneRelation,
  RelationsBase,
} from '../relations';
import { InsertQueryData, OnConflictItem, OnConflictMergeUpdate } from '../sql';
import { WhereArg } from './where';
import { VirtualColumn } from '../columns';
import { anyShape } from '../db';
import {
  RawExpression,
  EmptyObject,
  SetOptional,
  StringKey,
  QueryThen,
} from 'orchid-core';

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
  T extends Query,
  Data = SetOptional<
    { [K in keyof T['inputType']]: CreateColumn<T, K> },
    keyof T['meta']['defaults']
  >,
> = [keyof T['relations']] extends [never]
  ? Data
  : OmitBelongsToForeignKeys<T['relations'], Data> & CreateRelationData<T>;

// Type of available variants to provide for a specific column when creating
type CreateColumn<T extends Query, Key extends keyof T['inputType']> =
  | T['inputType'][Key]
  | {
      [K in keyof Query]: K extends 'then'
        ? QueryThen<T['inputType'][Key]>
        : Query[K];
    };

// Omit `belongsTo` foreign keys to be able to create records
// with `db.book.create({ authorId: 123 })`
// or with `db.book.create({ author: authorData })`
type OmitBelongsToForeignKeys<R extends RelationsBase, Data> = Omit<
  Data,
  {
    [K in keyof R]: R[K] extends BelongsToRelation
      ? R[K]['options']['foreignKey']
      : never;
  }[keyof R]
>;

// Adds relation operations such as nested `create`, `connect`, and others to use when creating
type CreateRelationData<T extends Query> = {
  [K in keyof T['relations']]: T['relations'][K] extends BelongsToRelation
    ? CreateBelongsToData<T, K, T['relations'][K]>
    : T['relations'][K] extends HasOneRelation
    ? CreateHasOneData<T, K, T['relations'][K]>
    : T['relations'][K] extends HasManyRelation | HasAndBelongsToManyRelation
    ? CreateHasManyData<T, K, T['relations'][K]>
    : EmptyObject;
}[keyof T['relations']];

// `belongsTo` relation data available for create. It supports:
// - `create` to create a related record
// - `connect` to find existing record and use its primary key
// - `connectOrCreate` to first try connecting to an existing record, and create it if not found
type CreateBelongsToData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends BelongsToRelation,
  FKeys = {
    [K in Rel['options']['foreignKey']]: Rel['options']['foreignKey'] extends keyof T['inputType']
      ? T['inputType'][Rel['options']['foreignKey']]
      : never;
  },
> =
  | {
      [K in keyof FKeys]: K extends keyof T['meta']['defaults']
        ? { [L in K]?: FKeys[L] }
        : { [L in K]: FKeys[L] };
    }[keyof FKeys]
  | {
      [K in Key]:
        | {
            create: CreateData<Rel['nestedCreateQuery']>;
            connect?: never;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect: WhereArg<Rel['table']>;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect?: never;
            connectOrCreate: {
              where: WhereArg<Rel['table']>;
              create: CreateData<Rel['nestedCreateQuery']>;
            };
          };
    };

// `hasOne` relation data available for create. It supports:
// - `create` to create a related record
// - `connect` to find existing record and update its foreign key with the new id
// - `connectOrCreate` to first try connecting to an existing record, and create it if not found
type CreateHasOneData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends HasOneRelation,
> = 'through' extends Rel['options']
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : {
      [K in Key]?:
        | {
            create: CreateData<Rel['nestedCreateQuery']>;
            connect?: never;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect: WhereArg<Rel['table']>;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect?: never;
            connectOrCreate: {
              where?: WhereArg<Rel['table']>;
              create?: CreateData<Rel['nestedCreateQuery']>;
            };
          };
    };

// `hasMany` and `hasAndBelongsToMany` relation data available for create. It supports:
// - `create` to create related records
// - `connect` to find existing records by `where` conditions and update their foreign keys with the new id
// - `connectOrCreate` to first try finding records by `where` conditions, and create them if not found
type CreateHasManyData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends HasManyRelation | HasAndBelongsToManyRelation,
> = 'through' extends Rel['options']
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : {
      [K in Key]?: {
        create?: CreateData<Rel['nestedCreateQuery']>[];
        connect?: WhereArg<Rel['table']>[];
        connectOrCreate?: {
          where: WhereArg<Rel['table']>;
          create: CreateData<Rel['nestedCreateQuery']>;
        }[];
      };
    };

// `create` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns multiple, forces it to return one record.
// - otherwise, query result remains as is.
type CreateResult<T extends Query> = T extends { isCount: true }
  ? T
  : QueryReturnsAll<T['returnType']> extends true
  ? SetQueryReturnsOne<T>
  : T;

// `createMany` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns a single record, forces it to return multiple.
// - otherwise, query result remains as is.
type CreateManyResult<T extends Query> = T extends { isCount: true }
  ? T
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAll<T>
  : T;

// `createRaw` method argument.
// Contains array of columns and a raw SQL for values.
type CreateRawData<T extends Query> = {
  columns: (keyof T['shape'])[];
  values: RawExpression;
};

// `createManyRaw` method argument.
// Contains array of columns and an array of raw SQL for values.
type CreateManyRawData<T extends Query> = {
  columns: (keyof T['shape'])[];
  values: RawExpression[];
};

type RawRequiredColumns<T extends Query> = {
  [K in keyof T['inputType'] as K extends keyof T['meta']['defaults']
    ? never
    : null extends T['inputType'][K]
    ? never
    : undefined extends T['inputType'][K]
    ? never
    : K]: true;
};

type CreateRawArgs<
  T extends Query,
  Arg extends { columns: (keyof T['shape'])[] },
> = keyof RawRequiredColumns<T> extends Arg['columns'][number]
  ? [data: Arg]
  : [
      `Missing required columns: ${Exclude<
        StringKey<keyof RawRequiredColumns<T>>,
        Arg['columns'][number]
      >}`,
    ];

type OnConflictArg<T extends Query> =
  | keyof T['shape']
  | (keyof T['shape'])[]
  | RawExpression;

export type CreateCtx = {
  columns: Map<string, number>;
  returnTypeAll?: true;
  resultAll: Record<string, unknown>[];
};

type Encoder = (input: unknown) => unknown;

const handleSelect = (q: Query) => {
  const select = q.query.select?.[0];

  if (
    q.query.returnType === 'void' ||
    (typeof select === 'object' &&
      'function' in select &&
      select.function === 'count')
  ) {
    q.query.select = undefined;
  } else if (!q.query.select) {
    q.query.select = ['*'];
  }
};

const processCreateItem = (
  q: Query,
  item: Record<string, unknown>,
  rowIndex: number,
  ctx: CreateCtx,
  encoders: Record<string, Encoder>,
) => {
  const { shape } = q.query;
  Object.keys(item).forEach((key) => {
    if (shape[key] instanceof VirtualColumn) {
      (shape[key] as VirtualColumn).create?.(q, ctx, item, rowIndex);
    } else if (!ctx.columns.has(key) && (shape[key] || shape === anyShape)) {
      ctx.columns.set(key, ctx.columns.size);
      encoders[key] = shape[key]?.encodeFn as Encoder;
    }
  });
};

const createCtx = (): CreateCtx => ({
  columns: new Map(),
  resultAll: undefined as unknown as Record<string, unknown>[],
});

const mapColumnValues = (
  columns: string[],
  encoders: Record<string, Encoder>,
  data: Record<string, unknown>,
) => {
  return columns.map((key) =>
    encoders[key] ? encoders[key](data[key]) : data[key],
  );
};

const handleOneData = (q: Query, data: CreateData<Query>, ctx: CreateCtx) => {
  const encoders: Record<string, Encoder> = {};
  const defaults = q.query.defaults;

  if (defaults) {
    data = { ...defaults, ...data };
  }

  processCreateItem(q, data, 0, ctx, encoders);

  const columns = Array.from(ctx.columns.keys());
  const values = [mapColumnValues(columns, encoders, data)];

  return { columns, values };
};

const handleManyData = (
  q: Query,
  data: CreateData<Query>[],
  ctx: CreateCtx,
) => {
  const encoders: Record<string, Encoder> = {};
  const defaults = q.query.defaults;

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

const insert = (
  self: Query,
  {
    columns,
    values,
  }: {
    columns: string[];
    values: InsertQueryData['values'];
  },
  many?: boolean,
) => {
  const q = self as Query & { query: InsertQueryData };

  delete q.query.and;
  delete q.query.or;

  q.query.type = 'insert';
  q.query.columns = columns;
  q.query.values = values;

  const { select, returnType = 'all' } = q.query;

  if (!select) {
    if (returnType !== 'void') q.query.returnType = 'rowCount';
  } else if (many) {
    if (returnType === 'one' || returnType === 'oneOrThrow')
      q.query.returnType = 'all';
  } else if (returnType === 'all') {
    q.query.returnType =
      'from' in values ? values.from.query.returnType : 'one';
  }

  return q;
};

const getFromSelectColumns = (
  from: Query,
  obj?: { columns: string[] },
  many?: boolean,
) => {
  if (!many && !queryTypeWithLimitOne[from.query.returnType]) {
    throw new Error(
      'Cannot create based on a query which returns multiple records',
    );
  }

  const queryColumns: string[] = [];
  from.query.select?.forEach((item) => {
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

const createFromQuery = <
  T extends Query,
  Q extends Query,
  Many extends boolean,
>(
  q: T,
  from: Q,
  many: Many,
  data?: Omit<CreateData<T>, keyof Q['result']>,
): Many extends true ? CreateManyResult<T> : CreateResult<T> => {
  handleSelect(q);

  const ctx = createCtx();

  const obj = data && handleOneData(q, data, ctx);

  const columns = getFromSelectColumns(from, obj, many);

  return insert(q, {
    columns,
    values: { from, values: obj?.values },
  }) as Many extends true ? CreateManyResult<T> : CreateResult<T>;
};

export type CreateMethodsNames =
  | 'create'
  | '_create'
  | 'createMany'
  | '_createMany'
  | 'createRaw'
  | '_createRaw'
  | 'createFrom'
  | '_createFrom';

export class Create {
  /**
   * `create` will create one record.
   *
   * Each column may accept a specific value, a raw SQL, or a query that returns a single value.
   *
   * ```ts
   * const oneRecord = await db.table.create({
   *   name: 'John',
   *   password: '1234',
   * });
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
   * @param data - data for the record, may have values, raw SQL, queries, relation operations
   */
  create<T extends Query>(this: T, data: CreateData<T>): CreateResult<T> {
    return this.clone()._create(data);
  }
  _create<T extends Query>(this: T, data: CreateData<T>): CreateResult<T> {
    handleSelect(this);
    const ctx = createCtx();
    const obj = handleOneData(this, data, ctx) as {
      columns: string[];
      values: InsertQueryData['values'];
    };

    const values = (this.query as InsertQueryData).values;
    if (values && 'from' in values) {
      obj.columns = getFromSelectColumns(values.from, obj);
      values.values = obj.values as unknown[][];
      obj.values = values;
    }

    return insert(this, obj) as CreateResult<T>;
  }

  /**
   * `createMany` will create a batch of records.
   *
   * Each column may be set with a specific value, a raw SQL, or a query, the same as in [create](#create).
   *
   * In case one of the objects has fewer fields, the `DEFAULT` SQL keyword will be placed in its place in the `VALUES` statement.
   *
   * ```ts
   * const manyRecords = await db.table.createMany([
   *   { key: 'value', otherKey: 'other value' },
   *   { key: 'value' }, // default will be used for `otherKey`
   * ]);
   * ```
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations
   */
  createMany<T extends Query>(
    this: T,
    data: CreateData<T>[],
  ): CreateManyResult<T> {
    return this.clone()._createMany(data);
  }
  _createMany<T extends Query>(
    this: T,
    data: CreateData<T>[],
  ): CreateManyResult<T> {
    handleSelect(this);
    const ctx = createCtx();
    return insert(
      this,
      handleManyData(this, data, ctx),
      true,
    ) as CreateManyResult<T>;
  }

  /**
   * `createRaw` is for creating one record with a raw expression.
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
  createRaw<T extends Query, Arg extends CreateRawData<T>>(
    this: T,
    ...args: CreateRawArgs<T, Arg>
  ): CreateResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._createRaw(args[0] as any);
  }
  _createRaw<T extends Query, Arg extends CreateRawData<T>>(
    this: T,
    ...args: CreateRawArgs<T, Arg>
  ): CreateResult<T> {
    handleSelect(this);
    return insert(
      this,
      args[0] as { columns: string[]; values: RawExpression },
    ) as CreateResult<T>;
  }

  /**
   * `createRaw` is for creating many record with raw expressions.
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
  createManyRaw<T extends Query, Arg extends CreateManyRawData<T>>(
    this: T,
    ...args: CreateRawArgs<T, Arg>
  ): CreateManyResult<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.clone()._createManyRaw(args[0] as any);
  }
  _createManyRaw<T extends Query, Arg extends CreateManyRawData<T>>(
    this: T,
    ...args: CreateRawArgs<T, Arg>
  ): CreateManyResult<T> {
    handleSelect(this);
    return insert(
      this,
      args[0] as { columns: string[]; values: RawExpression[] },
    ) as CreateManyResult<T>;
  }

  /**
   * This method is for creating a single record, for batch creating see `createManyFrom`.
   *
   * `createFrom` is to perform the `INSERT ... SELECT ...` SQL statement, it does select and insert in a single query.
   *
   * The first argument is a query for a **single** record, it should have `find`, `take`, or similar.
   *
   * The second optional argument is a data which will be merged with columns returned from the select query.
   *
   * The data for the second argument is the same as in [create](#create) and [createMany](#createMany).
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
    T extends Query,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data?: Omit<CreateData<T>, keyof Q['result']>,
  ): CreateResult<T> {
    return this.clone()._createFrom(query, data);
  }
  _createFrom<
    T extends Query,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data?: Omit<CreateData<T>, keyof Q['result']>,
  ): CreateResult<T> {
    return createFromQuery(this, query, false, data);
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
  createManyFrom<T extends Query, Q extends Query>(
    this: T,
    query: Q,
  ): CreateManyResult<T> {
    return this.clone()._createManyFrom(query);
  }
  _createManyFrom<T extends Query, Q extends Query>(
    this: T,
    query: Q,
  ): CreateManyResult<T> {
    return createFromQuery(this, query, true);
  }

  /**
   * `.defaults` allows setting values that will be used later in `.create`.
   *
   * Columns provided in `.defaults` are marked as optional in the following `.create`.
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
  defaults<T extends Query, Data extends Partial<CreateData<T>>>(
    this: T,
    data: Data,
  ): T & {
    meta: {
      defaults: Record<keyof Data, true>;
    };
  } {
    return (this.clone() as T)._defaults(data);
  }
  _defaults<T extends Query, Data extends Partial<CreateData<T>>>(
    this: T,
    data: Data,
  ): T & { meta: { defaults: Record<keyof Data, true> } } {
    this.query.defaults = data;
    return this as T & { meta: { defaults: Record<keyof Data, true> } };
  }

  /**
   * A modifier for creating queries that specify alternative behavior in the case of a conflict.
   * A conflict occurs when a table has a `PRIMARY KEY` or a `UNIQUE` index on a column
   * (or a composite index on a set of columns) and a row being created has the same value as a row
   * that already exists in the table in this column(s).
   * The default behavior in case of conflict is to raise an error and abort the query.
   * Using this method you can change this behavior to either silently ignore the error by using .onConflict().ignore()
   * or to update the existing row with new data (perform an "UPSERT") by using .onConflict().merge().
   *
   * ```ts
   * // leave without argument to ignore or merge on any conflict
   * Target.create(data).onConflict().ignore();
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
   * The column(s) specified by this method must either be the table's PRIMARY KEY or have a UNIQUE index on them, or the query will fail to execute.
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
   *   // ignore only on email conflict and active is true.
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
  onConflict<T extends Query, Arg extends OnConflictArg<T>>(
    this: T,
    arg?: Arg,
  ): OnConflictQueryBuilder<T, Arg> {
    return this.clone()._onConflict(arg);
  }
  _onConflict<
    T extends Query,
    Arg extends OnConflictArg<T> | undefined = undefined,
  >(this: T, arg?: Arg): OnConflictQueryBuilder<T, Arg> {
    return new OnConflictQueryBuilder(this, arg as Arg);
  }
}

export class OnConflictQueryBuilder<
  T extends Query,
  Arg extends OnConflictArg<T> | undefined,
> {
  constructor(private query: T, private onConflict: Arg) {}

  /**
   * Available only after `.onConflict`.
   *
   * Modifies a create query, and causes it to be silently dropped without an error if a conflict occurs.
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
   */
  ignore(): T {
    (this.query.query as InsertQueryData).onConflict = {
      type: 'ignore',
      expr: this.onConflict as OnConflictItem,
    };
    return this.query;
  }

  /**
   * Available only after `.onConflict`.
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
   * `.merge` also accepts raw expression:
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
      | RawExpression,
  ): T {
    (this.query.query as InsertQueryData).onConflict = {
      type: 'merge',
      expr: this.onConflict as OnConflictItem,
      update: update as OnConflictMergeUpdate,
    };
    return this.query;
  }
}
