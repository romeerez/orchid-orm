import { Code } from './code';
import { RawSQLBase } from '../raw';
import { QueryBaseCommon } from '../query';
import { OperatorBase } from './operators';
import { ColumnTypeSchemaArg } from './columnSchema';
import { RecordString } from '../utils';

// get columns object type where nullable columns or columns with a default are optional
export type ColumnShapeInput<
  Shape extends QueryColumnsInit,
  AppReadOnly = {
    [K in keyof Shape]: Shape[K]['data']['appReadOnly'] extends true
      ? K
      : never;
  }[keyof Shape],
  Optional extends keyof Shape = {
    [K in keyof Shape]: Shape[K]['data']['optional'] extends true ? K : never;
  }[keyof Shape],
> = {
  [K in Exclude<keyof Shape, AppReadOnly | Optional>]: Shape[K]['inputType'];
} & { [K in Exclude<Optional, AppReadOnly>]?: Shape[K]['inputType'] };

export type ColumnShapeInputPartial<Shape extends QueryColumnsInit> = {
  [K in keyof Shape]?: Shape[K]['inputType'];
};

// output of the shape of columns
export type ColumnShapeOutput<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['outputType'];
};

export type DefaultSelectOutput<Shape extends QueryColumnsInit> = {
  [K in keyof Shape as Shape[K]['data']['explicitSelect'] extends
    | true
    | undefined
    ? never
    : K]: Shape[K]['outputType'];
};

// type of columns shape to use in `where` and other query methods
export type ColumnShapeQueryType<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['queryType'];
};

// base type of object with columns
export interface ColumnsShapeBase {
  [K: string]: ColumnTypeBase;
}

// marks the column as a primary
export type PrimaryKeyColumn<T, Name extends string> = T & {
  data: {
    primaryKey: Name;
  };
};

export type UniqueColumn<T, Name extends string> = T & {
  data: {
    unique: Name;
  };
};

// marks the column as a nullable, adds `null` type to `type` and `inputType`
export type NullableColumn<
  T extends ColumnTypeBase,
  InputSchema,
  OutputSchema,
  QuerySchema,
> = {
  [K in keyof T]: K extends 'type'
    ? T['type'] | null
    : K extends 'inputType'
    ? T['inputType'] | null
    : K extends 'inputSchema'
    ? InputSchema
    : K extends 'outputType'
    ? T['outputType'] | (unknown extends T['nullType'] ? null : T['nullType'])
    : K extends 'outputSchema'
    ? OutputSchema
    : K extends 'queryType'
    ? T['queryType'] | null
    : K extends 'querySchema'
    ? QuerySchema
    : K extends 'data'
    ? T['data'] & DataNullable
    : K extends 'operators'
    ? // `Omit` here is faster than ternaries
      Omit<T['operators'], 'equals' | 'not'> & OperatorsNullable<T['queryType']>
    : T[K];
};

interface DataNullable {
  isNullable: true;
  optional: true;
}

export interface OperatorsNullable<T> {
  // allow `null` in .where({ column: { equals: null } }) and the same for `not`
  equals: OperatorBase<T | null>;
  not: OperatorBase<T | null>;
}

// change column type and all schemas to nullable
export function makeColumnNullable<
  T extends ColumnTypeBase,
  InputSchema,
  OutputSchema,
  QuerySchema,
>(
  column: T,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  querySchema: QuerySchema,
) {
  const c = setColumnData(column, 'isNullable', true);
  c.inputSchema = inputSchema;
  c.outputSchema = outputSchema;
  c.querySchema = querySchema;
  return c as unknown as NullableColumn<
    T,
    InputSchema,
    OutputSchema,
    QuerySchema
  >;
}

// change the input type of the column
export type EncodeColumn<T, InputSchema, Input> = {
  [K in keyof T]: K extends 'inputType'
    ? Input
    : K extends 'inputSchema'
    ? InputSchema
    : T[K];
};

// change the output type of the column
export type ParseColumn<T extends ColumnTypeBase, OutputSchema, Output> = {
  [K in keyof T]: K extends 'outputType'
    ? null extends T['type']
      ?
          | Exclude<Output, null>
          | (unknown extends T['nullType'] ? null : T['nullType'])
      : Output
    : K extends 'outputSchema'
    ? null extends T['type']
      ? OutputSchema | T['nullSchema']
      : OutputSchema
    : T[K];
};

// change the output type of null value
export type ParseNullColumn<T extends ColumnTypeBase, NullSchema, NullType> = {
  [K in keyof T]: K extends 'outputType'
    ? null extends T['type']
      ? Exclude<T['outputType'], null> | NullType
      : T['outputType']
    : K extends 'nullType'
    ? NullType
    : K extends 'outputSchema'
    ? null extends T['type']
      ? T['outputSchema'] | NullSchema
      : T['outputSchema']
    : K extends 'nullSchema'
    ? NullSchema
    : T[K];
};

export interface PickColumnBaseData {
  data: ColumnDataBase;
}

// adds default type to the column
// removes the default if the Value is null
export type ColumnWithDefault<T extends PickColumnBaseData, Value> = {
  [K in keyof T]: K extends 'data'
    ? {
        [K in keyof T['data']]: K extends 'default'
          ? Value extends null
            ? never
            : Value
          : K extends 'optional'
          ? true
          : T['data'][K];
      }
    : T[K];
};

// whether to select column by default or with *
export type ColumnDefaultSelect<
  T extends PickColumnBaseData,
  Value extends boolean,
> = {
  [K in keyof T]: K extends 'data'
    ? {
        [K in keyof T['data']]: K extends 'explicitSelect'
          ? Value extends true
            ? false
            : true
          : T['data'][K];
      }
    : T[K];
};

export interface ColumnDataAppReadOnly {
  data: {
    appReadOnly: true;
  };
}

export type ColumnTypesBase = { [K in string]: ColumnTypeBase }; // converting to interface harms

// type of columns selected by default, `hidden` columns are omitted
export type DefaultSelectColumns<S extends QueryColumnsInit> = {
  [K in keyof S]: S[K]['data']['explicitSelect'] extends true | undefined
    ? never
    : K;
}[keyof S];

// minimal table class type to use in the foreign key option
export interface ForeignKeyTable {
  new (): {
    schema?: string;
    table: string;
    columns: { shape: QueryColumns };
  };
}

// string union of available column names of the table
export type ColumnNameOfTable<Table extends ForeignKeyTable> =
  keyof InstanceType<Table>['columns']['shape'] & string;

// clone column type and set data to it
export const setColumnData = <
  T extends PickColumnBaseData,
  K extends keyof T['data'],
>(
  q: T,
  key: K,
  value: T['data'][K],
): T => {
  const cloned = Object.create(q);
  cloned.data = { ...q.data, [key]: value };
  return cloned;
};

// clone column type and push data to array property of it
export const pushColumnData = <
  T extends PickColumnBaseData,
  K extends keyof T['data'],
>(
  q: T,
  key: K,
  value: unknown,
) => {
  const arr = q.data[key as keyof typeof q.data] as unknown[];
  return setColumnData(
    q,
    key,
    (arr ? [...arr, value] : [value]) as unknown as T['data'][K],
  );
};

// Can be used to customize required and invalidType validation error message on any column.
// must be a type, because of zod typing
export type ErrorMessages = {
  required?: string;
  invalidType?: string;
};

// Parameter of column types to customize an error message.
export type ErrorMessage =
  | string
  | {
      message?: string;
    };

// Clone a column or a JSON type and set the value in its data.
export const setDataValue = <
  T extends PickColumnBaseData,
  Key extends string,
  Value,
>(
  item: T,
  key: Key,
  value: Value,
  params?: ErrorMessage,
): T => {
  const cloned = Object.create(item);
  cloned.data = { ...item.data, [key]: value };

  if (params && (typeof params === 'string' || params.message)) {
    (cloned.data.errors ??= {})[key] =
      typeof params === 'string' ? params : params.message;
  }

  return cloned as T;
};

// types to be assigned to the column with .asType
export interface ColumnDataTypes<
  Type = unknown,
  InputType = Type,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputSchema = any,
  OutputType = Type,
  OutputSchema = InputSchema,
  QueryType = InputType,
  QuerySchema = InputSchema,
> {
  type: Type;
  inputType: InputType;
  inputSchema: InputSchema;
  outputType: OutputType;
  outputSchema: OutputSchema;
  queryType: QueryType;
  querySchema: QuerySchema;
}

// base data of column
export interface ColumnDataBase {
  // column key is assigned when instantiating a table interface
  key: string;

  // name of the column in the database, if different from the code
  name?: string;

  // true when is nullable or has a default
  optional: true | undefined;

  // is null value allowed
  isNullable?: true;

  // true for primary key, string for primary key with a custom name
  primaryKey?: string;

  // if column has a default value, then it can be omitted in `create` method
  default: unknown;

  // to hide default from generated code
  defaultDefault: unknown;

  // if the `default` is a function, instantiating table query will set `runtimeDefault` to wrap the `default` function with `encode` if it is set.
  runtimeDefault?(): unknown;

  // column should not be implicitly selected
  explicitSelect?: boolean;

  // parse and encode a column to use it `as` another column
  as?: ColumnTypeBase;

  unique?: string;

  // hook for modifying base query object of the table
  // used for automatic updating of `updatedAt`
  modifyQuery?(q: QueryBaseCommon, column: ColumnTypeBase): void;

  // raw database check expression
  checks?: ColumnDataCheckBase[];

  // if the column is of domain or other user-defined type
  isOfCustomType?: boolean;

  // error messages: key is camelCased version of Zod, like invalidType, and the value is the message
  errors?: RecordString;

  // identify whether this column is from `timestamps()` helper for codegen purposes
  defaultTimestamp?: 'createdAt' | 'updatedAt';

  // alias of the type used as a column function name
  alias?: string;

  // name of extension that contains the column type, if it's not standard
  extension?: string;

  // encode value passed to `create` to an appropriate value for a database
  encode?(input: any): unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

  // parse value from a database into what is preferred by the app
  parse?(input: any): unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

  // parse value from a database when it is an element of database array type
  parseItem?(input: string): unknown;

  // replaces selected nulls with custom values
  parseNull?(): unknown;

  // this is used to cast column types in SQL when wrapping rows as JSON.
  // decimal and similar columns have to be casted to text to not loose precision.
  jsonCast?: string;

  // removes the column from update and create, it's for generated and computed columns
  readOnly?: boolean;

  // removes the column from update and create, but it is still allowed to be set in the hooks
  appReadOnly: true | undefined;

  // postgres internal number modifier, it can be present on custom types.
  typmod?: number;
}

export interface ColumnDataCheckBase {
  sql: RawSQLBase;
  name?: string;
}

// current name of the column, set by `name` method
let currentName: string | undefined;

// set current name of the column
export function setCurrentColumnName(name: string): void {
  currentName = name;
}

// consume column name: reset current name and return the value it contained
export const consumeColumnName = () => {
  const name = currentName;
  currentName = undefined;
  return name;
};

// by default, updatedAt and createdAt timestamps are defaulted to now()
const defaultNowFn = 'now()';

// stores SQL to use as default for updatedAt and createdAt
let currentNowFn = defaultNowFn;

// change default SQL for updatedAt and createdAt
export const setDefaultNowFn = (sql: string) => {
  currentNowFn = `(${sql})`; // sql should be wrapped into parenthesis to work properly in migrations
};

// get default SQL for updatedAt and createdAt
export const getDefaultNowFn = () => currentNowFn;

// reset default SQL for updatedAt and createdAt to now()
export const resetDefaultNowFn = () => {
  currentNowFn = defaultNowFn;
};

// default language for full text search
let defaultLanguage = 'english';
// set default language for full text search
export const setDefaultLanguage = (lang?: string) => {
  defaultLanguage = lang || 'english';
};
// get default language for full text search
export const getDefaultLanguage = () => defaultLanguage;

interface AsTypeArgWithType<Schema> {
  type: Schema;
  input?: Schema;
  output?: Schema;
  query?: Schema;
}

interface AsTypeArgWithoutType<Schema> {
  input: Schema;
  output: Schema;
  query: Schema;
}

export type AsTypeArg<Schema> =
  | AsTypeArgWithType<Schema>
  | AsTypeArgWithoutType<Schema>;

export interface PickType {
  type: unknown;
}

export interface PickOutputType {
  outputType: unknown;
}

export interface PickOutputTypeAndOperators {
  outputType: unknown;
  operators: unknown;
}

// Use a lightweight column type across the query builder, this helps TS significantly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryColumn<T = unknown, Op = any> {
  dataType: string;
  type: T;
  outputType: T;
  queryType: T;
  operators: Op;
}

export interface QueryColumnOfDataType<DataType extends string>
  extends QueryColumn {
  dataType: DataType;
}

export interface QueryColumns {
  [K: string]: QueryColumn;
}

export interface QueryColumnInit extends QueryColumn {
  inputType: unknown;
  data: {
    explicitSelect?: boolean;
    primaryKey?: string;
    unique?: string;
    optional?: true;
    isNullable?: true;
    default?: unknown;
    name?: string;
    readOnly?: boolean;
    appReadOnly: true | undefined;
  };
}

export interface QueryColumnsInit {
  [K: string]: QueryColumnInit;
}

export type QueryColumnToNullable<C extends QueryColumn> = {
  [K in keyof C]: K extends 'outputType'
    ? C['outputType'] | null
    : K extends 'queryType'
    ? C['queryType'] | null
    : C[K];
};

export interface ColumnToCodeCtx {
  t: string;
  table: string;
  currentSchema: string;
  migration?: boolean;
  snakeCase?: boolean;
}

// base column type
export abstract class ColumnTypeBase<
  Schema extends ColumnTypeSchemaArg = ColumnTypeSchemaArg,
  Type = unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputSchema = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Ops = any,
  InputType = Type,
  OutputType = Type,
  OutputSchema = InputSchema,
  QueryType = InputType,
  QuerySchema = InputSchema,
  Data extends ColumnDataBase = ColumnDataBase,
> {
  // name of the type in a database
  abstract dataType: string;

  // operators supported by the type, that are available in `where` method
  abstract operators: Ops;

  // turn the column into TS code, used for code generation
  abstract toCode(ctx: ColumnToCodeCtx, key: string): Code;

  // format the column into the database type
  abstract toSQL(): string;

  // Type returned from a database before parsing, it is an output type of db.
  // Unlike `queryType`, it cannot be a union.
  type!: Type;

  // allowed type for creating and updating, it is processed by `encode` function when it's defined.
  inputType!: InputType;

  // type returned from a database and processed by `parse` function when it's defined.
  outputType!: OutputType;

  // Allowed type to use in `where` and other query methods.
  // Input type of db: timestamp can be sent as a string, a number, or Date (serialized by `pg` driver).
  // It is **not** processed by the ORM, only by a database driver.
  queryType!: QueryType;

  declare nullType: unknown;
  declare nullSchema: unknown;
  declare isNullable: boolean;

  // data of the column that specifies column characteristics and validations
  data: Data;

  error: Schema['error'];

  declare _parse: (input: unknown) => unknown;

  constructor(
    schema: ColumnTypeSchemaArg,
    // type for validation lib for inserting and updating records
    // public inputSchema: InputSchema = undefined as InputSchema,
    public inputSchema: InputSchema,
    // type for validation lib for selected data
    public outputSchema: OutputSchema = inputSchema as unknown as OutputSchema,
    // type for validation lib for validating filters
    public querySchema: QuerySchema = inputSchema as unknown as QuerySchema,
  ) {
    this.parse = schema.parse;
    this.parseNull = schema.parseNull;
    this.encode = schema.encode;
    this.asType = schema.asType;
    this.nullable = schema.nullable;
    this.error = schema.error;
    const name = consumeColumnName();
    this.data = (name ? { name } : {}) as Data;
  }

  /**
   * Set a default value to a column. Columns that have defaults become optional when creating a record.
   *
   * If you provide a value or a raw SQL, such default should be set on the column in migration to be applied on a database level.
   *
   * Or you can specify a callback that returns a value. This function will be called for each creating record. Such a default won't be applied to a database.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     // values as defaults:
   *     int: t.integer().default(123),
   *     text: t.text().default('text'),
   *
   *     // raw SQL default:
   *     timestamp: t.timestamp().default(t.sql`now()`),
   *
   *     // runtime default, each new records gets a new random value:
   *     random: t.numeric().default(() => Math.random()),
   *   }));
   * }
   * ```
   *
   * @param value - default value or a function returning a value
   */
  default<
    T extends Pick<ColumnTypeBase, 'type' | 'inputType' | 'data'>,
    Value extends T['inputType'] | null | RawSQLBase | (() => T['inputType']),
  >(this: T, value: Value): ColumnWithDefault<T, Value> {
    return setColumnData(this, 'default', value) as ColumnWithDefault<T, Value>;
  }

  /**
   * Use `hasDefault` to let the column be omitted when creating records.
   *
   * It's better to use {@link default} instead so the value is explicit and serves as a hint.
   */
  hasDefault<T extends PickColumnBaseData>(
    this: T,
  ): ColumnWithDefault<T, RawSQLBase> {
    return this as ColumnWithDefault<T, RawSQLBase>;
  }

  /**
   * Set a database-level validation check to a column. `check` accepts a raw SQL.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     // validate rank to be from 1 to 10
   *     rank: t.integer().check(t.sql`1 >= "rank" AND "rank" <= 10`),
   *     // constraint name can be passed as a second argument
   *     column: t.integer().check(t.sql`...`, 'check_name'),
   *     // a single column can have multiple checks
   *     multiChecksColumn: t
   *       .integer()
   *       .check(t.sql`...`)
   *       .check(t.sql`...`, 'optional_name'),
   *   }));
   * });
   * ```
   *
   * @param sql - raw SQL expression
   * @param name - to specify a constraint name
   */
  check<T extends PickColumnBaseData>(
    this: T,
    sql: RawSQLBase,
    name?: string,
  ): T {
    return pushColumnData(this, 'checks', { sql, name });
  }

  /**
   * Use `nullable` to mark the column as nullable. By default, all columns are required.
   *
   * Nullable columns are optional when creating records.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     name: t.integer().nullable(),
   *   }));
   * }
   * ```
   */
  nullable: Schema['nullable'];

  /**
   * Set a custom function to process value for the column when creating or updating a record.
   *
   * The type of `input` argument will be used as the type of the column when creating and updating.
   *
   * If you have a validation library [installed and configured](/guide/columns-validation-methods.html),
   * first argument is a schema to validate the input.
   *
   * ```ts
   * import { z } from 'zod';
   *
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     // encode boolean, number, or string to text before saving
   *     column: t
   *       .string()
   *       // when having validation library, the first argument is a validation schema
   *       .encode(
   *         z.boolean().or(z.number()).or(z.string()),
   *         (input: boolean | number | string) => String(input),
   *       )
   *       // no schema argument otherwise
   *       .encode((input: boolean | number | string) => String(input)),
   *   }));
   * }
   *
   * // numbers and booleans will be converted to a string:
   * await db.table.create({ column: 123 });
   * await db.table.create({ column: true });
   * await db.table.where({ column: 'true' }).update({ column: false });
   * ```
   *
   * @param fn - function to encode value for a database, argument type is specified by you, return type must be compatible with a database
   */
  encode: Schema['encode'];

  /**
   * Set a custom function to process value after loading it from a database.
   *
   * The type of input is the type of column before `.parse`, the resulting type will replace the type of column.
   *
   * If you have a validation library [installed and configured](/guide/columns-validation-methods.html),
   * first argument is a schema for validating the output.
   *
   * For handling `null` values use {@link parseNull} instead or in addition.
   *
   * ```ts
   * import { z } from 'zod';
   * import { number, integer } from 'valibot';
   *
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     columnZod: t
   *       .string()
   *       // when having validation library, the first argument is a schema
   *       .parse(z.number().int(), (input) => parseInt(input))
   *       // no schema argument otherwise
   *       .parse((input) => parseInt(input)),
   *
   *     columnValibot: t
   *       .string()
   *       .parse(number([integer()]), (input) => parseInt(input))
   *       .parse((input) => parseInt(input)),
   *   }));
   * }
   *
   * // column will be parsed to a number
   * const value: number = await db.table.get('column');
   * ```
   *
   * @param fn - function to parse a value from the database, argument is the type of this column, return type is up to you
   */
  parse: Schema['parse'];

  /**
   * Use `parseNull` to specify runtime defaults at selection time.
   *
   * The `parseNull` function is only triggered for `nullable` columns.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     column: t
   *       .integer()
   *       .parse(String) // parse non-nulls to string
   *       .parseNull(() => false), // replace nulls with false
   *       .nullable(),
   *   }));
   * }
   *
   * const record = await db.table.take()
   * record.column // can be a string or boolean, not null
   * ```
   *
   * If you have a validation library [installed and configured](/guide/columns-validation-methods),
   * first argument is a schema for validating the output.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     column: t
   *       .integer()
   *       .parse(z.string(), String) // parse non-nulls to string
   *       .parseNull(z.literal(false), () => false), // replace nulls with false
   *     .nullable(),
   *   }));
   * }
   *
   * const record = await db.table.take()
   * record.column // can be a string or boolean, not null
   *
   * Table.outputSchema().parse({
   *   column: false, // the schema expects strings or `false` literals, not nulls
   * })
   * ```
   */
  parseNull: Schema['parseNull'];

  /**
   * This method changes a column type without modifying its behavior.
   * This is needed when converting columns to a validation schema, the converter will pick a different type specified by `.as`.
   *
   * Before calling `.as` need to use `.encode` with the input of the same type as the input of the target column,
   * and `.parse` which returns the correct type.
   *
   * ```ts
   * // column has the same type as t.integer()
   * const column = t
   *   .string()
   *   .encode((input: number) => input)
   *   .parse((text) => parseInt(text))
   *   .as(t.integer());
   * ```
   *
   * @param column - other column type to inherit from
   */
  as<
    T extends { inputType: unknown; outputType: unknown; data: ColumnDataBase },
    C extends Omit<ColumnTypeBase, 'inputType' | 'outputType'> & {
      inputType: T['inputType'];
      outputType: T['outputType'];
    },
  >(this: T, column: C): C {
    return setColumnData(
      this,
      'as',
      column as unknown as T['data']['as'],
    ) as unknown as C;
  }

  /**
   * Mark the column as to have specific Typescript type.
   * This can be used to narrow generic column types, such as narrow `string` to a string literal union.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     size: t.text().asType((t) => t<'small' | 'medium' | 'large'>()),
   *   }));
   * }
   *
   * // size will be typed as 'small' | 'medium' | 'large'
   * const size = await db.table.get('size');
   * ```
   *
   * To alter the base, input, output and query types individually, pass them as generic parameters:
   *
   * ```ts
   * const column = t
   *   .text()
   *   .asType((t) => t<Type, InputType, OutputType, QueryType>());
   * ```
   *
   * - The first `Type` is the base one, used as a default for other types.
   * - `InputType` is for `create`, `update` methods.
   * - `OutputType` is for the data that is loaded from a database and parsed if the column has `parse`.
   * - `QueryType` is used in `where` and other query methods, it should be compatible with the actual database column type.
   */
  asType: Schema['asType'];

  input<T extends { inputSchema: unknown }, InputSchema extends Schema['type']>(
    this: T,
    fn: (schema: T['inputSchema']) => InputSchema,
  ): { [K in keyof T]: K extends 'inputSchema' ? InputSchema : T[K] } {
    const cloned = Object.create(this);
    cloned.inputSchema = fn(this.inputSchema);
    return cloned;
  }

  output<
    T extends { outputSchema: unknown },
    OutputSchema extends Schema['type'],
  >(
    this: T,
    fn: (schema: T['outputSchema']) => OutputSchema,
  ): { [K in keyof T]: K extends 'outputSchema' ? OutputSchema : T[K] } {
    const cloned = Object.create(this);
    cloned.outputSchema = fn(this.outputSchema);
    return cloned;
  }

  query<T extends { querySchema: unknown }, QuerySchema extends Schema['type']>(
    this: T,
    fn: (schema: T['querySchema']) => QuerySchema,
  ): { [K in keyof T]: K extends 'querySchema' ? QuerySchema : T[K] } {
    const cloned = Object.create(this);
    cloned.querySchema = fn(this.querySchema);
    return cloned;
  }

  /**
   * Set a database column name.
   *
   * @param name - name of the column in database.
   */
  name<T extends PickColumnBaseData>(this: T, name: string): T {
    return setColumnData(this, 'name', name);
  }

  /**
   * Append `select(false)` to a column to exclude it from the default selection.
   * It won't be selected with `selectAll` or `select('*')` as well.
   *
   * ```ts
   * export class UserTable extends BaseTable {
   *   readonly table = 'user';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     name: t.string(),
   *     password: t.string().select(false),
   *   }));
   * }
   *
   * // only id and name are selected, without password
   * const user = await db.user.find(123);
   *
   * // password is still omitted, even with the wildcard
   * const same = await db.user.find(123).select('*');
   *
   * const comment = await db.comment.find(123).select({
   *   // password is omitted in the sub-selects as well
   *   author: (q) => q.author,
   * });
   *
   * // password is omitted here as well
   * const created = await db.user.create(userData);
   * ```
   *
   * Such a column can only be selected explicitly.
   *
   * ```ts
   * const userWithPassword = await db.user.find(123).select('*', 'password');
   * ```
   */
  select<T extends PickColumnBaseData, Value extends boolean>(
    this: T,
    value: Value,
  ): ColumnDefaultSelect<T, Value> {
    return setColumnData(this, 'explicitSelect', !value) as never;
  }

  /**
   * Forbid the column to be used in [create](/guide/create-update-delete.html#create-insert) and [update](/guide/create-update-delete.html#update) methods.
   *
   * `readOnly` column is still can be set from a [hook](http://localhost:5173/guide/hooks.html#set-values-before-create-or-update).
   *
   * It can have a default.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     column: t.string().default(() => 'default value'),
   *     another: t.string().readOnly(),
   *   }));
   *
   *   init(orm: typeof db) {
   *     this.beforeSave(({ set }) => {
   *       set({ another: 'value' });
   *     });
   *   }
   * }
   *
   * // later in the code
   * db.table.create({ column: 'value' }); // TS error, runtime error
   * ```
   */
  readOnly<T extends PickColumnBaseData>(this: T): T & ColumnDataAppReadOnly {
    return setColumnData(this, 'appReadOnly', true) as never;
  }
}
