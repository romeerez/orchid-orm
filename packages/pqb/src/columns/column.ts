import { Query } from '../query/query';
import { emptyObject, RecordString, RecordUnknown } from '../utils';
import {
  RawSQLValues,
  StaticSQLArgs,
  TemplateLiteralArgs,
  templateLiteralSQLToCode,
} from '../query/expressions/expression';
import { raw, RawSqlBase } from '../query/expressions/raw-sql';
import { TableData } from '../tableData';
import { ColumnTypeSchemaArg } from './column-schema';
import { Code, ColumnToCodeCtx } from './code';

import { Operator } from './operators';
import { PickQueryInputType, PickQueryShape } from '../query/pick-query-types';
import { QueryHookUtils } from '../query/extra-features/hooks/hooks';

export namespace Column {
  export namespace Modifiers {
    // marks the column as a primary, this typing is used in onConflict logic
    export interface IsPrimaryKey<Name extends string> {
      data: {
        primaryKey: Name;
      };
    }

    // marks the column as unique, this typing is used in onConflict logic
    export type IsUnique<Name extends string> = {
      data: {
        unique: Name;
      };
    };

    // marks the column as a nullable, adds `null` type to `type` and `inputType`
    export type Nullable<
      T extends Column.Pick.ForNullable,
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
        ?
            | T['outputType']
            | (unknown extends T['nullType'] ? null : T['nullType'])
        : K extends 'outputSchema'
        ? OutputSchema
        : K extends 'queryType'
        ? T['queryType'] | null
        : K extends 'querySchema'
        ? QuerySchema
        : K extends 'data'
        ? T['data'] & DataNullable
        : K extends 'operators'
        ? {
            [K in keyof T['operators']]: K extends 'equals' | 'not'
              ? Operator<T | null>
              : T['operators'][K];
          }
        : T[K];
    };

    export type QueryColumnToNullable<C> = {
      [K in keyof C]: K extends 'outputType' | 'queryType' ? C[K] | null : C[K];
    };

    export type QueryColumnToOptional<C> = {
      [K in keyof C]: K extends 'outputType' ? C[K] | undefined : C[K];
    };

    interface DataNullable {
      isNullable: true;
      optional: true;
    }

    // allow `null` in .where({ column: { equals: null } }) and the same for `not`
    export interface OperatorsNullable<T> {
      equals: Operator<T | null>;
      not: Operator<T | null>;
    }

    // change the input type of the column
    export type Encode<T, InputSchema, Input> = {
      [K in keyof T]: K extends 'inputType'
        ? Input
        : K extends 'inputSchema'
        ? InputSchema
        : T[K];
    };

    // change the output type of the column
    export type Parse<T extends Pick.ForParse, OutputSchema, Output> = {
      [K in keyof T]: K extends 'outputType'
        ? null extends T['type']
          ?
              | (Output extends null ? never : Output)
              | (unknown extends T['nullType'] ? null : T['nullType'])
          : Output
        : K extends 'outputSchema'
        ? null extends T['type']
          ? OutputSchema | T['nullSchema']
          : OutputSchema
        : T[K];
    };

    // change the output type of null value
    export type ParseNull<
      T extends Column.Pick.ForParseNull,
      NullSchema,
      NullType,
    > = {
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

    type DefaultData<T extends Column.Data, Value> = {
      [K in keyof T]: K extends 'default'
        ? Value extends null
          ? never
          : Value
        : K extends 'optional'
        ? true
        : T[K];
    };

    // adds default type to the column
    // removes the default if the Value is null
    export type Default<T extends Column.Pick.Data, Value> = {
      [K in keyof T]: K extends 'data' ? DefaultData<T['data'], Value> : T[K];
    };

    type DefaultSelectData<T extends Column.Data, Value> = {
      [K in keyof T]: K extends 'explicitSelect'
        ? Value extends true
          ? false
          : true
        : T[K];
    };

    // whether to select column by default or with *
    export type DefaultSelect<
      T extends Column.Pick.Data,
      Value extends boolean,
    > = {
      [K in keyof T]: K extends 'data'
        ? DefaultSelectData<T['data'], Value>
        : T[K];
    };

    export interface IsAppReadOnly {
      data: {
        appReadOnly: true;
      };
    }

    export type Generated<T extends Column.Pick.Data> = {
      [K in keyof T]: K extends 'data'
        ? {
            [K in keyof T['data']]: K extends 'default' ? true : T['data'][K];
          }
        : K extends 'inputType'
        ? never
        : T[K];
    };
  }

  export namespace Pick {
    export interface Data {
      data: Column.Data;
    }

    export interface Type {
      type: unknown;
    }

    export interface OutputType {
      outputType: unknown;
    }

    export interface InputType {
      inputType: unknown;
    }

    export interface DataAndInputType extends Data, InputType {}

    export interface NullType {
      nullType: unknown;
    }

    export interface OutputTypeAndOperators extends OutputType {
      operators: unknown;
    }

    export interface DataAndDataType extends Data {
      dataType: string;
    }

    // Use a lightweight column type across the query builder, this helps TS significantly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export interface QueryColumn extends OutputType {
      dataType: string;
      type: unknown;
      queryType: unknown;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      operators: any;
    }

    export interface QueryColumnOfType<T> {
      dataType: string;
      type: T;
      outputType: T;
      queryType: T;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      operators: any;
    }

    export interface QueryColumnOfTypeAndOps<DataType, T, Ops> {
      dataType: DataType;
      type: T;
      outputType: T;
      queryType: T;
      operators: Ops;
    }

    export interface QueryColumnOfDataType<T extends string>
      extends QueryColumn {
      dataType: T;
    }

    export interface QueryInit extends QueryColumn, InputType {
      data: Column.QueryData;
    }

    export interface OutputSchema {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outputSchema: any;
    }

    export interface NullSchema {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nullSchema: any;
    }

    export interface TypeSchemas extends OutputSchema, NullSchema {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      querySchema: any;
    }

    export interface ForNullable
      extends Data,
        Type,
        InputType,
        OutputType,
        TypeSchemas {
      nullType: unknown;
      queryType: unknown;
      operators: unknown;
    }

    export interface ForParse extends Type, NullType, NullSchema {}

    export interface ForParseNull extends Type, OutputType, OutputSchema {}

    export interface ForValidation extends TypeSchemas, DataAndDataType {}
  }

  export namespace Shape {
    export interface Data {
      [K: string]: Column.Pick.Data;
    }

    export interface QueryInit {
      [K: string]: Column.Pick.QueryInit;
    }

    export interface ForValidation {
      [K: string]: Column.Pick.ForValidation;
    }
  }

  export interface QueryColumns {
    [K: string]: Column.Pick.QueryColumn;
  }

  export interface QueryColumnsInit {
    [K: string]: Pick.QueryInit;
  }

  export namespace ForeignKey {
    export interface TableParamInstance {
      schema?: string;
      table: string;
      columns: PickQueryShape;
    }

    // minimal table class type to use in the foreign key option
    export interface TableParam {
      new (): TableParamInstance;
    }

    // string union of available column names of the table
    export type ColumnNameOfTable<Table extends Column.ForeignKey.TableParam> =
      Table extends new () => { columns: { shape: infer R } } ? keyof R : never;
  }

  export namespace Error {
    // Can be used to customize required and invalidType validation error message on any column.
    // must be a type, because of zod typing
    export interface Messages {
      required?: string;
      invalidType?: string;
    }

    export interface Message {
      message?: string;
    }

    // Parameter of column types to customize an error message.
    export type StringOrMessage = string | Message;
  }

  export interface InputOutputQueryTypes {
    inputType: unknown;
    outputType: unknown;
    queryType: unknown;
  }

  export interface InputOutputQueryTypesWithSchemas
    extends InputOutputQueryTypes {
    inputSchema: unknown;
    outputSchema: unknown;
    querySchema: unknown;
  }

  export interface QueryData {
    explicitSelect?: boolean;
    primaryKey?: string;
    unique?: string;
    optional?: true;
    isNullable?: true;
    default?: unknown;
    name?: string;
    readOnly?: boolean;
    appReadOnly: true | undefined;
  }

  // type of data for ColumnType
  export interface Data {
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
    as?: Column.Pick.Data;

    unique?: string;

    // hook for modifying base query object of the table
    // used for automatic updating of `updatedAt`
    modifyQuery?(q: Query, column: Column.Pick.Data): void;

    // raw database check expression
    checks?: Column.Data.Check[];

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

    // set a value on create
    setOnCreate?(arg: QueryHookUtils<PickQueryInputType>): unknown;

    // set a value on update
    setOnUpdate?(arg: QueryHookUtils<PickQueryInputType>): unknown;

    // set a value on save
    setOnSave?(arg: QueryHookUtils<PickQueryInputType>): unknown;

    // postgres internal number modifier, it can be present on custom types.
    typmod?: number;

    // virtual columns are read only, and they are ignored in update in create,
    // unlike unknown column that is extending virtual
    virtual?: true;

    maxChars?: number;
    numericPrecision?: number;
    numericScale?: number;
    dateTimePrecision?: number;
    validationDefault?: unknown;
    indexes?: TableData.ColumnIndex[];
    excludes?: TableData.ColumnExclude[];
    comment?: string;
    collate?: string;
    compression?: string;
    foreignKeys?: TableData.ColumnReferences[];
    identity?: TableData.Identity;
    // raw SQL for generated columns
    generated?: Data.Generated;
    // computed and generated columns are readonly
    readonly?: boolean;
  }

  export namespace Data {
    export interface Check {
      sql: RawSqlBase;
      name?: string;
    }

    export interface Generated {
      toSQL(
        ctx: { values: unknown[]; snakeCase: boolean | undefined },
        quotedAs?: string,
      ): string;

      toCode(): string;
    }
  }

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
}

// change column type and all schemas to nullable
export function makeColumnNullable<
  T extends Column.Pick.ForNullable,
  InputSchema,
  OutputSchema,
  QuerySchema,
>(
  column: T,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  querySchema: QuerySchema,
) {
  const c = setColumnData(column, 'isNullable', true) as unknown as Column;
  c.inputSchema = inputSchema;
  c.outputSchema = outputSchema;
  c.querySchema = querySchema;
  return c as unknown as Column.Modifiers.Nullable<
    T,
    InputSchema,
    OutputSchema,
    QuerySchema
  >;
}

// clone column type and set data to it
export const setColumnData = <
  T extends Column.Pick.Data,
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
  T extends Column.Pick.Data,
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

// Clone a column or a JSON type and set the value in its data.
export const setDataValue = <
  T extends Column.Pick.Data,
  Key extends string,
  Value,
>(
  item: T,
  key: Key,
  value: Value,
  params?: Column.Error.StringOrMessage,
): T => {
  const cloned = Object.create(item);
  cloned.data = { ...item.data, [key]: value };

  if (params && (typeof params === 'string' || params.message)) {
    (cloned.data.errors ??= {})[key] =
      typeof params === 'string' ? params : params.message;
  }

  return cloned as T;
};

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

export abstract class Column<
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
> {
  // name of the type in a database
  abstract dataType: string;

  // operators supported by the type, that are available in `where` method
  abstract operators: Ops;

  // turn the column into TS code, used for code generation
  abstract toCode(ctx: ColumnToCodeCtx, key: string): Code;

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
  data: Column.Data;

  error: Schema['error'];

  _parse?: (input: unknown) => unknown;

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
    this.narrowType = schema.narrowType;
    this.narrowAllTypes = schema.narrowAllTypes;
    this.nullable = schema.nullable;
    this.error = schema.error;
    const name = consumeColumnName();
    this.data = (name ? { name } : {}) as Column.Data;
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
    T extends Column.Pick.DataAndInputType,
    Value extends T['inputType'] | null | RawSqlBase | (() => T['inputType']),
  >(this: T, value: Value): Column.Modifiers.Default<T, Value> {
    return setColumnData(this, 'default', value) as Column.Modifiers.Default<
      T,
      Value
    >;
  }

  /**
   * Use `hasDefault` to let the column be omitted when creating records.
   *
   * It's better to use {@link default} instead so the value is explicit and serves as a hint.
   */
  hasDefault<T extends Column.Pick.Data>(
    this: T,
  ): Column.Modifiers.Default<T, RawSqlBase> {
    return this as Column.Modifiers.Default<T, RawSqlBase>;
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
  check<T extends Column.Pick.Data>(
    this: T,
    sql: RawSqlBase,
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
    T extends { inputType: unknown; outputType: unknown; data: Column.Data },
    C extends {
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
   * @deprecated use narrowType instead
   */
  asType: Schema['asType'];

  /**
   * `narrowType` narrows TypeScript types of a column. It sets input, output, query type altogether.
   *
   * For example, to narrow a `string` type to a union of string literals.
   *
   * When _not_ integrating with [validation libraries](/guide/columns-validation-methods), `narrowType` has the following syntax:
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     size: t.string().narrowType((t) => t<'small' | 'medium' | 'large'>()),
   *   }));
   * }
   *
   * // size will be typed as 'small' | 'medium' | 'large'
   * const size = await db.table.get('size');
   * ```
   *
   * - `input` is for `create`, `update` methods.
   * - `output` is for the data that is loaded from a database and parsed if the column has `parse`.
   * - `query` is used in `where` and other query methods, it should be compatible with the actual database column type.
   *
   * When integrating with a [validation library](/guide/columns-validation-methods), also provide validation schemas:
   *
   * ```ts
   * const sizeSchema = z.union([
   *   z.literal('small'),
   *   z.literal('medium'),
   *   z.literal('large'),
   * ]);
   *
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     size: t.text().narrowType(sizeSchema),
   *   }));
   * }
   *
   * // size will be typed as 'small' | 'medium' | 'large'
   * const size = await db.table.get('size');
   * ```
   */
  narrowType: Schema['narrowType'];

  /**
   * Allows to narrow different TypeScript types of a column granularly.
   *
   * Use it when the column's input is different from output.
   *
   * When _not_ integrating with [validation libraries](/guide/columns-validation-methods), `narrowAllTypes` has the following syntax:
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     size: t.string().narrowAllTypes((t) =>
   *       t<{
   *         // what types are accepted when creating/updating
   *         input: 'small' | 'medium' | 'large';
   *         // how types are retured from a database
   *         output: 'small' | 'medium' | 'large';
   *         // what types the column accepts in `where` and similar
   *         query: 'small' | 'medium' | 'large';
   *       }>(),
   *     ),
   *   }));
   * }
   *
   * // size will be typed as 'small' | 'medium' | 'large'
   * const size = await db.table.get('size');
   * ```
   *
   * - `input` is for `create`, `update` methods.
   * - `output` is for the data that is loaded from a database and parsed if the column has `parse`.
   * - `query` is used in `where` and other query methods, it should be compatible with the actual database column type.
   *
   * When integrating with a [validation library](/guide/columns-validation-methods), also provide validation schemas:
   *
   * ```ts
   * const sizeSchema = z.union([
   *   z.literal('small'),
   *   z.literal('medium'),
   *   z.literal('large'),
   * ]);
   *
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     size: t.text().narrowAllTypes({
   *       input: sizeSchema,
   *       output: sizeSchema,
   *       query: sizeSchema,
   *     }),
   *   }));
   * }
   *
   * // size will be typed as 'small' | 'medium' | 'large'
   * const size = await db.table.get('size');
   * ```
   */
  narrowAllTypes: Schema['narrowAllTypes'];

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
  name<T extends Column.Pick.Data>(this: T, name: string): T {
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
  select<T extends Column.Pick.Data, Value extends boolean>(
    this: T,
    value: Value,
  ): Column.Modifiers.DefaultSelect<T, Value> {
    return setColumnData(this, 'explicitSelect', !value) as never;
  }

  /**
   * Forbid the column to be used in [create](/guide/create-update-delete.html#create-insert) and [update](/guide/create-update-delete.html#update) methods.
   *
   * `readOnly` column is still can be set from a [hook](http://localhost:5173/guide/hooks.html#set-values-before-create-or-update).
   *
   * `readOnly` column can be used together with a `default`.
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
  readOnly<T>(this: T): T & Column.Modifiers.IsAppReadOnly {
    return setColumnData(this as never, 'appReadOnly', true as never) as never;
  }

  /**
   * Set a column value when creating a record.
   * This works for [readOnly](#readonly) columns as well.
   *
   * If no value or undefined is returned, the hook won't have any effect.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     column: t.string().setOnCreate(() => 'value'),
   *   }));
   * }
   * ```
   */
  setOnCreate<T extends Column.Pick.QueryInit>(
    this: T,
    fn: (arg: QueryHookUtils<PickQueryInputType>) => T['inputType'] | void,
  ): T {
    return setColumnData(this as never, 'setOnCreate', fn as never) as never;
  }

  /**
   * Set a column value when updating a record.
   * This works for [readOnly](#readonly) columns as well.
   *
   * If no value or undefined is returned, the hook won't have any effect.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     column: t.string().setOnUpdate(() => 'value'),
   *   }));
   * }
   * ```
   */
  setOnUpdate<T extends Column.Pick.QueryInit>(
    this: T,
    fn: (arg: QueryHookUtils<PickQueryInputType>) => T['inputType'] | void,
  ): T {
    return setColumnData(this as never, 'setOnUpdate', fn as never) as never;
  }

  /**
   * Set a column value when creating or updating a record.
   * This works for [readOnly](#readonly) columns as well.
   *
   * If no value or undefined is returned, the hook won't have any effect.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     column: t.string().setOnSave(() => 'value'),
   *   }));
   * }
   * ```
   */
  setOnSave<T extends Column.Pick.QueryInit>(
    this: T,
    fn: (arg: QueryHookUtils<PickQueryInputType>) => T['inputType'] | void,
  ): T {
    return setColumnData(this as never, 'setOnSave', fn as never) as never;
  }

  /**
   * Mark the column as a primary key.
   * This column type becomes an argument of the `.find` method.
   * So if the primary key is of `integer` type (`identity` or `serial`), `.find` will accept the number,
   * or if the primary key is of `UUID` type, `.find` will expect a string.
   *
   * Using `primaryKey` on a `uuid` column will automatically add a [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) default.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     id: t.uuid().primaryKey(),
   *     // database-level name can be passed:
   *     id: t.uuid().primaryKey('primary_key_name'),
   *   }));
   * }
   *
   * // primary key can be used by `find` later:
   * db.table.find('97ba9e78-7510-415a-9c03-23d440aec443');
   * ```
   *
   * @param name - to specify a constraint name
   */
  primaryKey<T extends Column.Pick.Data, Name extends string>(
    this: T,
    name?: Name,
  ): T & Column.Modifiers.IsPrimaryKey<Name> {
    return setColumnData(this, 'primaryKey', name ?? (true as never)) as never;
  }

  /**
   * Defines a reference between different tables to enforce data integrity.
   *
   * In [snakeCase](/guide/orm-and-query-builder.html#snakecase-option) mode, columns of both tables are translated to a snake_case.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     otherId: t.integer().foreignKey('otherTableName', 'columnName'),
   *   }));
   * });
   * ```
   *
   * In the migration it's different from OrchidORM table code where a callback with a table is expected:
   *
   * ```ts
   * export class SomeTable extends BaseTable {
   *   readonly table = 'someTable';
   *   columns = this.setColumns((t) => ({
   *     otherTableId: t.integer().foreignKey(() => OtherTable, 'id'),
   *   }));
   * }
   * ```
   *
   * Optionally you can pass the third argument to `foreignKey` with options:
   *
   * ```ts
   * type ForeignKeyOptions = {
   *   // name of the constraint
   *   name?: string;
   *   // see database docs for MATCH in FOREIGN KEY
   *   match?: 'FULL' | 'PARTIAL' | 'SIMPLE';
   *
   *   onUpdate?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
   *   onDelete?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
   * };
   * ```
   *
   * ## composite foreign key
   *
   * Set foreign key from multiple columns in the current table to corresponding columns in the other table.
   *
   * The first argument is an array of columns in the current table, the second argument is another table name, the third argument is an array of columns in another table, and the fourth argument is for options.
   *
   * Options are the same as in a single-column foreign key.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.integer(),
   *     name: t.string(), // string is varchar(255)
   *     ...t.foreignKey(
   *       ['id', 'name'],
   *       'otherTable',
   *       ['foreignId', 'foreignName'],
   *       {
   *         name: 'constraintName',
   *         match: 'FULL',
   *         onUpdate: 'RESTRICT',
   *         onDelete: 'CASCADE',
   *       },
   *     ),
   *   }));
   * });
   * ```
   *
   * @param fn - function returning a table class
   * @param column - column in the foreign table to connect with
   * @param options - {@link ForeignKeyOptions}
   */
  foreignKey<T, Shape>(
    this: T,
    fn: () => new () => { columns: { shape: Shape } },
    column: keyof Shape,
    options?: TableData.References.Options,
  ): T;
  foreignKey<T, Table extends string, Column extends string>(
    this: T,
    table: Table,
    column: Column,
    options?: TableData.References.Options,
  ): T;
  foreignKey(
    fnOrTable: any,
    column: string,
    options: TableData.References.Options = emptyObject,
  ) {
    return pushColumnData(this, 'foreignKeys', {
      fnOrTable,
      foreignColumns: [column],
      options,
    });
  }

  // format the column into the database type
  toSQL(): string {
    return this.dataType;
  }

  /**
   * Add an index to the column.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     // add an index to the name column with default settings:
   *     name: t.text().index(),
   *     // options are described below:
   *     name: t.text().index({ ...options }),
   *     // with a database-level name:
   *     name: t.text().index({ name: 'custom_index_name', ...indexOptions }),
   *   }));
   * });
   * ```
   *
   * Possible options are:
   *
   * ```ts
   * type IndexOptions = {
   *   name?: string,
   *   // NULLS NOT DISTINCT: availabe in Postgres 15+, makes sense only for unique index
   *   nullsNotDistinct?: true;
   *   // index algorithm to use such as GIST, GIN
   *   using?: string;
   *   // specify collation:
   *   collate?: string;
   *   // see `opclass` in the Postgres document for creating the index
   *   opclass?: string;
   *   // specify index order such as ASC NULLS FIRST, DESC NULLS LAST
   *   order?: string;
   *   // include columns to an index to optimize specific queries
   *   include?: MaybeArray<string>;
   *   // see "storage parameters" in the Postgres document for creating an index, for example, 'fillfactor = 70'
   *   with?: string;
   *   // The tablespace in which to create the index. If not specified, default_tablespace is consulted, or temp_tablespaces for indexes on temporary tables.
   *   tablespace?: string;
   *   // WHERE clause to filter records for the index
   *   where?: string;
   *   // mode is for dropping the index
   *   mode?: 'CASCADE' | 'RESTRICT';
   * };
   * ```
   *
   * @param args
   */
  index<T extends Column.Pick.Data>(
    this: T,
    ...args: [options?: TableData.Index.ColumnArg]
  ): T {
    const a = args as
      | [options?: RecordUnknown]
      | [name: string, options?: RecordUnknown];

    return pushColumnData(this, 'indexes', {
      options:
        (typeof a[0] === 'string' ? { ...a[1], name: a[0] } : a[0]) ??
        emptyObject,
    });
  }

  /**
   * `searchIndex` is designed for [full text search](/guide/text-search).
   *
   * It can accept the same options as a regular `index`, but it is `USING GIN` by default, and it is concatenating columns into a `tsvector` database type.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex(['title', 'body']),
   *   }));
   * });
   * ```
   *
   * Produces the following index ('english' is a default language, see [full text search](/guide/text-search.html#language) for changing it):
   *
   * ```sql
   * CREATE INDEX "table_title_body_idx" ON "table" USING GIN (to_tsvector('english', "title" || ' ' || "body"))
   * ```
   *
   * You can set different search weights (`A` to `D`) on different columns inside the index:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex([
   *       { column: 'title', weight: 'A' },
   *       { column: 'body', weight: 'B' },
   *     ]),
   *   }));
   * });
   * ```
   *
   * When the table has localized columns,
   * you can define different indexes for different languages by setting the `language` parameter:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     titleEn: t.text(),
   *     bodyEn: t.text(),
   *     titleFr: t.text(),
   *     bodyFr: t.text(),
   *     ...t.searchIndex(['titleEn', 'bodyEn'], { language: 'english' }),
   *     ...t.searchIndex(['titleFr', 'bodyFr'], { language: 'french' }),
   *   }));
   * });
   * ```
   *
   * Alternatively, different table records may correspond to a single language,
   * then you can define a search index that relies on a language column by using `languageColumn` parameter:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     lang: t.type('regconfig'),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex(['title', 'body'], { languageColumn: 'lang' }),
   *   }));
   * });
   * ```
   *
   * It can be more efficient to use a [generated](/guide/migration-column-methods.html#generated-column) column instead of indexing text column in the way described above,
   * and to set a `searchIndex` on it:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
   *   }));
   * });
   * ```
   *
   * Produces the following index:
   *
   * ```sql
   * CREATE INDEX "table_generatedTsVector_idx" ON "table" USING GIN ("generatedTsVector")
   * ```
   *
   * @param options - index options
   */
  searchIndex<T extends { data: Column['data']; dataType: string }>(
    this: T,
    ...args: [options?: TableData.Index.TsVectorColumnArg]
  ): T {
    const a = args as
      | [options?: RecordUnknown]
      | [name: string, options?: RecordUnknown];

    return pushColumnData(this, 'indexes', {
      options: {
        ...(typeof a[0] === 'string' ? { ...a[1], name: a[0] } : a[0]),
        ...(this.dataType === 'tsvector'
          ? { using: 'GIN' }
          : { tsVector: true }),
      },
    });
  }

  unique<
    T extends Column.Pick.Data,
    const Options extends TableData.Index.ColumnArg,
  >(
    this: T,
    ...args: [options?: Options]
  ): T & Column.Modifiers.IsUnique<Options['name'] & string> {
    const a = args as
      | [options?: RecordUnknown]
      | [name: string, options?: RecordUnknown];

    return pushColumnData(this, 'indexes', {
      options: {
        ...(typeof a[0] === 'string' ? { ...a[1], name: a[0] } : a[0]),
        unique: true,
      },
    }) as never;
  }

  /**
   * Add [EXCLUDE constraint](https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-EXCLUDE) to the column.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     // exclude rows with overlapping time ranges, && is for the `WITH` operator
   *     timeRange: t.type('tstzrange').exclude('&&'),
   *     // with a database-level name:
   *     timeRange: t.type('tstzrange').exclude('&&', 'no_overlap'),
   *     // with options:
   *     timeRange: t.type('tstzrange').exclude('&&', { ...options }),
   *     // with name and options:
   *     name: t.type('tstzrange').exclude('&&', 'no_overlap', { ...options }),
   *   }));
   * });
   * ```
   *
   * Possible options are:
   *
   * ```ts
   * interface ExcludeColumnOptions {
   *   // specify collation:
   *   collate?: string;
   *   // see `opclass` in the Postgres document for creating the index
   *   opclass?: string;
   *   // specify index order such as ASC NULLS FIRST, DESC NULLS LAST
   *   order?: string;
   *   // algorithm to use such as GIST, GIN
   *   using?: string;
   *   // EXCLUDE creates an index under the hood, include columns to the index
   *   include?: MaybeArray<string>;
   *   // see "storage parameters" in the Postgres document for creating an index, for example, 'fillfactor = 70'
   *   with?: string;
   *   // The tablespace in which to create the constraint. If not specified, default_tablespace is consulted, or temp_tablespaces for indexes on temporary tables.
   *   tablespace?: string;
   *   // WHERE clause to filter records for the constraint
   *   where?: string;
   *   // for dropping the index at a down migration
   *   dropMode?: DropMode;
   * }
   * ```
   */
  exclude<T extends Column.Pick.Data>(
    this: T,
    op: string,
    ...args: [options?: TableData.Exclude.ColumnArg]
  ): T {
    const a = args as
      | [options?: RecordUnknown]
      | [name: string, options?: RecordUnknown];

    return pushColumnData(this, 'excludes', {
      with: op,
      options:
        (typeof a[0] === 'string' ? { ...a[1], name: a[0] } : a[0]) ??
        emptyObject,
    });
  }

  comment<T extends Column.Pick.Data>(this: T, comment: string): T {
    return setColumnData(this, 'comment', comment);
  }

  compression<T extends Column.Pick.Data>(this: T, compression: string): T {
    return setColumnData(this, 'compression', compression);
  }

  collate<T extends Column.Pick.Data>(this: T, collate: string): T {
    return setColumnData(this, 'collate', collate);
  }

  modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T {
    return setColumnData(this, 'modifyQuery', cb);
  }

  /**
   * Define a generated column. `generated` accepts a raw SQL.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     two: t.integer().generated`1 + 1`,
   *   }));
   * });
   * ```
   *
   * @param args - raw SQL
   */
  generated<T extends Column.Pick.Data>(
    this: T,
    ...args: StaticSQLArgs
  ): Column.Modifiers.Generated<T> {
    const sql = raw(...args);
    const column = setColumnData(this, 'generated', {
      toSQL(ctx, quoted) {
        return sql.toSQL(ctx, quoted);
      },

      toCode() {
        let sql = '.generated';

        if (Array.isArray(args[0])) {
          sql += templateLiteralSQLToCode(args as TemplateLiteralArgs);
        } else {
          const { raw, values } = args[0] as {
            raw: string;
            values?: RawSQLValues;
          };
          sql += `({ raw: '${raw.replace(/'/g, "\\'")}'${
            values ? `, values: ${JSON.stringify(values)}` : ''
          } })`;
        }

        return sql;
      },
    });
    column.data.readOnly = true;
    return column as never;
  }
}
