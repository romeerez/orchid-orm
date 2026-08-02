import { Query } from '../query/query';
import { RecordString } from '../utils';
import { Expression, StaticSQLArgs } from '../query/expressions/expression';
import { RawSqlBase } from '../query/expressions/raw-sql';
import { TableData } from '../tableData';
import { ColumnTypeSchemaArg } from './column-schema';
import { Code, ColumnToCodeCtx } from './code';
import { Operator } from './operators';
import { PickQueryInputType } from '../query/pick-query-types';
import { QueryHookUtils } from '../query/extra-features/hooks/hooks';
import type { ColumnDataComputedProp } from '../query';
import type { SelectSqlColumn } from '../query/extra-features/select-sql/select-sql';
import type { ColumnRefExpression } from '../query/expressions/column-ref-expression';
import type { QuerySchema } from '../query/basic-features/schema/schema';
export declare namespace Column {
    export interface IsPrimaryKey<Name extends string> {
        data: {
            primaryKey: Name;
        };
    }
    export type IsUnique<Name extends string> = {
        data: {
            unique: Name;
        };
    };
    export type Nullable<T extends Column.Pick.ForNullable> = {
        [K in keyof T]: K extends '__type' ? T['__type'] | null : K extends '__inputType' ? T['__inputType'] | null : K extends '__outputType' ? T['__outputType'] | (unknown extends T['__nullType'] ? null : T['__nullType']) : K extends '__queryType' ? T['__queryType'] | null : K extends 'data' ? T['data'] & DataNullable : K extends 'operators' ? {
            [K in keyof T['operators']]: K extends 'equals' | 'not' | 'isDistinctFrom' | 'isNotDistinctFrom' ? Operator<T['__queryType'] | null, T> : T['operators'][K];
        } : T[K];
    };
    export type NullableWithSchema<T extends Column.Pick.ForNullable, InputSchema, OutputSchema, QuerySchema> = {
        [K in keyof T]: K extends '__type' ? T['__type'] | null : K extends '__inputType' ? T['__inputType'] | null : K extends 'inputSchema' ? InputSchema : K extends '__outputType' ? T['__outputType'] | (unknown extends T['__nullType'] ? null : T['__nullType']) : K extends 'outputSchema' ? OutputSchema : K extends '__queryType' ? T['__queryType'] | null : K extends 'querySchema' ? QuerySchema : K extends 'data' ? T['data'] & DataNullable : K extends 'operators' ? {
            [K in keyof T['operators']]: K extends 'equals' | 'not' | 'isDistinctFrom' | 'isNotDistinctFrom' ? Operator<T['__queryType'] | null, T> : T['operators'][K];
        } : T[K];
    };
    export type QueryColumnToNullable<C> = {
        [K in keyof C]: K extends '__outputType' | '__queryType' ? C[K] | null : C[K];
    };
    export type QueryColumnToOptional<C> = {
        [K in keyof C]: K extends '__outputType' ? C[K] | undefined : C[K];
    };
    interface DataNullable {
        isNullable: true;
        optional: true;
    }
    export interface OperatorsNullable<Column extends Column.Pick.QueryColumn> {
        equals: Operator<Column['__queryType'] | null, Column>;
        not: Operator<Column['__queryType'] | null, Column>;
        isDistinctFrom: Operator<Column['__queryType'] | null, Column>;
        isNotDistinctFrom: Operator<Column['__queryType'] | null, Column>;
    }
    export type Encode<T, InputSchema, Input> = {
        [K in keyof T]: K extends '__inputType' ? Input : K extends 'inputSchema' ? InputSchema : T[K];
    };
    export type Parse<T extends Pick.ForParse, OutputSchema, Output> = {
        [K in keyof T]: K extends '__outputType' ? null extends T['__type'] ? (Output extends null ? never : Output) | (unknown extends T['__nullType'] ? null : T['__nullType']) : Output : K extends 'outputSchema' ? null extends T['__type'] ? OutputSchema | T['nullSchema'] : OutputSchema : T[K];
    };
    export type ParseNull<T extends Column.Pick.ForParseNull, NullSchema, NullType> = {
        [K in keyof T]: K extends '__outputType' ? null extends T['__type'] ? Exclude<T['__outputType'], null> | NullType : T['__outputType'] : K extends '__nullType' ? NullType : K extends 'outputSchema' ? null extends T['__type'] ? T['outputSchema'] | NullSchema : T['outputSchema'] : K extends 'nullSchema' ? NullSchema : T[K];
    };
    export type HasDefault<T extends Column.Pick.Data> = T & Column.Data.Default;
    type DefaultSelectData<T extends Column.Data, Value> = {
        [K in keyof T]: K extends 'explicitSelect' ? Value extends true ? false : true : T[K];
    };
    export type DefaultSelect<T extends Column.Pick.Data, Value extends boolean> = {
        [K in keyof T]: K extends 'data' ? DefaultSelectData<T['data'], Value> : T[K];
    };
    export interface IsAppReadOnly {
        data: {
            appReadOnly: true;
        };
    }
    export type Generated<T extends Column.Pick.Data> = {
        [K in keyof T]: K extends 'data' ? {
            [K in keyof T['data']]: K extends 'default' ? true : T['data'][K];
        } : K extends '__inputType' ? never : T[K];
    };
    export namespace Pick {
        interface Data {
            data: Column.Data;
        }
        interface Type {
            __type: unknown;
        }
        interface OutputType {
            __outputType: unknown;
        }
        interface InputType {
            __inputType: unknown;
        }
        interface DataAndInputType extends Data, InputType {
        }
        interface NullType {
            __nullType: unknown;
        }
        interface OutputTypeAndOperators extends OutputType {
            operators: unknown;
        }
        interface DataAndDataType extends Data {
            dataType: string;
        }
        interface QueryColumn extends OutputType {
            dataType: string;
            __type: unknown;
            __queryType: unknown;
            operators: any;
        }
        interface QueryColumnOfType<T> {
            dataType: string;
            __type: T;
            __outputType: T;
            __queryType: T;
            operators: any;
        }
        interface QueryColumnOfTypeAndOps<DataType, T, Ops> {
            dataType: DataType;
            __type: T;
            __outputType: T;
            __queryType: T;
            operators: Ops;
        }
        interface QueryColumnOfDataType<T extends string> extends QueryColumn {
            dataType: T;
        }
        interface QueryInit extends QueryColumn, InputType {
            data: Column.QueryData;
        }
        interface OutputSchema {
            outputSchema: any;
        }
        interface NullSchema {
            nullSchema: any;
        }
        interface TypeSchemas extends OutputSchema, NullSchema {
            inputSchema: any;
            querySchema: any;
        }
        interface ForNullable extends Data, Type, InputType, OutputType, TypeSchemas {
            __nullType: unknown;
            __queryType: unknown;
            operators: unknown;
        }
        interface ForParse extends Type, NullType, NullSchema {
        }
        interface ForParseNull extends Type, OutputType, OutputSchema {
        }
        interface ForValidation extends TypeSchemas, DataAndDataType {
        }
    }
    export namespace Shape {
        interface Data {
            [K: string]: Column.Pick.Data;
        }
        interface QueryInit {
            [K: string]: Column.Pick.QueryInit;
        }
        interface ForValidation {
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
        interface TableParamInstance {
            schema?: string;
            table: string;
            nameInDb?: string;
            columns: {
                shape: unknown;
            };
        }
        interface TableParamInstanceInput {
            schema?: QuerySchema;
            table?: string;
            nameInDb?: string;
            columns: {
                shape: unknown;
            };
        }
        interface TableParamWithInstance {
            instance(): TableParamInstanceInput;
        }
        interface TableParamWithData {
            data: {
                columns: unknown;
            };
            instance(): TableParamInstanceInput;
        }
        type TableParam = (new () => TableParamInstance) | TableParamWithInstance | TableParamWithData;
        type ColumnNameOfTable<Table extends Column.ForeignKey.TableParam> = Table extends {
            data: {
                columns: infer R;
            };
        } ? keyof R : Table extends {
            instance(): {
                columns: {
                    shape: infer R;
                };
            };
        } ? keyof R : Table extends new () => {
            columns: {
                shape: infer R;
            };
        } ? keyof R : never;
    }
    export namespace Error {
        interface Messages {
            required?: string;
            invalidType?: string;
        }
        interface Message {
            message?: string;
        }
        type StringOrMessage = string | Message;
    }
    export interface InputOutputQueryTypes {
        __inputType: unknown;
        __outputType: unknown;
        __queryType: unknown;
    }
    export interface InputOutputQueryTypesWithSchemas extends InputOutputQueryTypes {
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
    export interface Data extends ColumnDataComputedProp {
        key: string;
        name?: string;
        optional: true | undefined;
        isNullable?: true;
        primaryKey?: string;
        default: unknown;
        defaultDefault: unknown;
        runtimeDefault?(): unknown;
        explicitSelect?: boolean;
        as?: Column.Pick.Data;
        unique?: string;
        modifyQuery?(q: Query, column: Column.Pick.Data): void;
        checks?: Column.Data.Check[];
        isOfCustomType?: boolean;
        errors?: RecordString;
        defaultTimestamp?: 'createdAt' | 'updatedAt';
        alias?: string;
        extension?: string;
        encode?(input: any): unknown;
        parse?(input: any): unknown;
        parseItem?(input: string): unknown;
        parseNull?(): unknown;
        jsonCast?: string;
        readOnly?: boolean;
        appReadOnly: true | undefined;
        setOnCreate?(arg: QueryHookUtils<PickQueryInputType>): unknown;
        setOnUpdate?(arg: QueryHookUtils<PickQueryInputType>): unknown;
        setOnSave?(arg: QueryHookUtils<PickQueryInputType>): unknown;
        typmod?: number;
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
        generated?: Data.Generated;
        readonly?: boolean;
        valueToArray?: boolean;
        skipValueToArray?: boolean;
    }
    export namespace Data {
        interface Default {
            data: {
                default: true;
                optional: true;
            };
        }
        interface Check {
            sql: RawSqlBase;
            name?: string;
        }
        interface Generated {
            toSQL(ctx: {
                values: unknown[];
                snakeCase: boolean | undefined;
            }, quotedAs?: string): string;
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
    export type AsTypeArg<Schema> = AsTypeArgWithType<Schema> | AsTypeArgWithoutType<Schema>;
    export {};
}
export declare const getForeignKeyTableInstance: (table: Column.ForeignKey.TableParam) => Column.ForeignKey.TableParamInstance;
export declare function makeColumnNullable<T extends Column.Pick.ForNullable, InputSchema, OutputSchema, QuerySchema>(column: T, inputSchema: InputSchema, outputSchema: OutputSchema, querySchema: QuerySchema): Column.NullableWithSchema<T, InputSchema, OutputSchema, QuerySchema>;
export declare const setColumnData: <T extends Column.Pick.Data, K extends keyof T['data']>(q: T, key: K, value: T['data'][K]) => T;
export declare const pushColumnData: <T extends Column.Pick.Data, K extends keyof T['data']>(q: T, key: K, value: unknown) => T;
export declare const setDataValue: <T extends Column.Pick.Data, Key extends string, Value>(item: T, key: Key, value: Value, params?: Column.Error.StringOrMessage) => T;
export declare function setCurrentColumnName(name: string): void;
export declare const consumeColumnName: () => string | undefined;
export declare const setDefaultNowFn: (sql: string) => void;
export declare const getDefaultNowFn: () => string;
export declare const resetDefaultNowFn: () => void;
export declare const setDefaultLanguage: (lang?: string) => void;
export declare const getDefaultLanguage: () => string;
export declare abstract class Column {
    abstract __schema: ColumnTypeSchemaArg;
    abstract dataType: string;
    abstract operators: any;
    abstract toCode(ctx: ColumnToCodeCtx, key: string): Code;
    abstract __type: unknown;
    abstract __inputType: unknown;
    abstract __outputType: unknown;
    abstract __queryType: unknown;
    __nullType: unknown;
    nullSchema: unknown;
    abstract inputSchema: unknown;
    abstract outputSchema: unknown;
    abstract querySchema: unknown;
    data: Column.Data;
    error: this['__schema']['error'];
    _parse?: (input: unknown) => unknown;
    constructor(schema: ColumnTypeSchemaArg, inputSchema: unknown, outputSchema?: unknown, querySchema?: unknown);
    /**
     * Set a default value to a column. Columns that have defaults become optional when creating a record.
     *
     * If you provide a value or a raw SQL, such default should be set on the column in migration to be applied on a database level.
     *
     * Or you can specify a callback that returns a value. This function will be called for each creating record. Such a default won't be applied to a database.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   // values as defaults:
     *   int: t.integer().default(123),
     *   text: t.text().default('text'),
     *
     *   // raw SQL default:
     *   timestamp: t.timestamp().default(t.sql`now()`),
     *
     *   // runtime default, each new records gets a new random value:
     *   random: t.numeric().default(() => Math.random()),
     * }));
     * ```
     *
     * @param value - default value or a function returning a value
     */
    default<T extends Column.Pick.DataAndInputType, Value extends T['__inputType'] | null | RawSqlBase | (() => T['__inputType'])>(this: T, value: Value): Column.HasDefault<T>;
    /**
     * Use `hasDefault` to let the column be omitted when creating records.
     *
     * It's better to use {@link default} instead so the value is explicit and serves as a hint.
     */
    hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
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
    check<T extends Column.Pick.Data>(this: T, sql: RawSqlBase, name?: string): T;
    /**
     * Use `nullable` to mark the column as nullable. By default, all columns are required.
     *
     * Nullable columns are optional when creating records.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   name: t.integer().nullable(),
     * }));
     * ```
     */
    nullable: this['__schema']['nullable'];
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
     * export const Table = defineTable('table', (t) => ({
     *   // encode boolean, number, or string to text before saving
     *   column: t
     *     .string()
     *     // when having validation library, the first argument is a validation schema
     *     .encode(
     *       z.boolean().or(z.number()).or(z.string()),
     *       (input: boolean | number | string) => String(input),
     *     )
     *     // no schema argument otherwise
     *     .encode((input: boolean | number | string) => String(input)),
     * }));
     *
     * // numbers and booleans will be converted to a string:
     * await db.table.create({ column: 123 });
     * await db.table.create({ column: true });
     * await db.table.where({ column: 'true' }).update({ column: false });
     * ```
     *
     * @param fn - function to encode value for a database, argument type is specified by you, return type must be compatible with a database
     */
    encode: this['__schema']['encode'];
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
     * export const Table = defineTable('table', (t) => ({
     *   columnZod: t
     *     .string()
     *     // when having validation library, the first argument is a schema
     *     .parse(z.number().int(), (input) => parseInt(input))
     *     // no schema argument otherwise
     *     .parse((input) => parseInt(input)),
     *
     *   columnValibot: t
     *     .string()
     *     .parse(number([integer()]), (input) => parseInt(input))
     *     .parse((input) => parseInt(input)),
     * }));
     *
     * // column will be parsed to a number
     * const value: number = await db.table.get('column');
     * ```
     *
     * @param fn - function to parse a value from the database, argument is the type of this column, return type is up to you
     */
    parse: this['__schema']['parse'];
    /**
     * Use `parseNull` to specify runtime defaults at selection time.
     *
     * The `parseNull` function is only triggered for `nullable` columns.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   column: t
     *     .integer()
     *     .parse(String) // parse non-nulls to string
     *     .parseNull(() => false), // replace nulls with false
     *     .nullable(),
     * }));
     *
     * const record = await db.table.take()
     * record.column // can be a string or boolean, not null
     * ```
     *
     * If you have a validation library [installed and configured](/guide/columns-validation-methods),
     * first argument is a schema for validating the output.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   column: t
     *     .integer()
     *     .parse(z.string(), String) // parse non-nulls to string
     *     .parseNull(z.literal(false), () => false) // replace nulls with false
     *     .nullable(),
     * }));
     *
     * const record = await db.table.take();
     * record.column; // can be a string or boolean, not null
     *
     * Table.outputSchema().parse({
     *   column: false, // the schema expects strings or `false` literals, not nulls
     * });
     * ```
     */
    parseNull: this['__schema']['parseNull'];
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
    as<T extends {
        __inputType: unknown;
        __outputType: unknown;
        data: Column.Data;
    }, C extends {
        __inputType: T['__inputType'];
        __outputType: T['__outputType'];
    }>(this: T, column: C): C;
    /**
     * @deprecated use narrowType instead
     */
    asType: this['__schema']['asType'];
    /**
     * `narrowType` narrows TypeScript types of a column. It sets input, output, query type altogether.
     *
     * For example, to narrow a `string` type to a union of string literals.
     *
     * When _not_ integrating with [validation libraries](/guide/columns-validation-methods), `narrowType` has the following syntax:
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   size: t.string().narrowType((t) => t<'small' | 'medium' | 'large'>()),
     * }));
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
     * export const Table = defineTable('table', (t) => ({
     *   size: t.text().narrowType(sizeSchema),
     * }));
     *
     * // size will be typed as 'small' | 'medium' | 'large'
     * const size = await db.table.get('size');
     * ```
     *
     * @deprecated use `type` instead
     */
    narrowType: this['__schema']['narrowType'];
    /**
     * Allows to narrow different TypeScript types of a column granularly.
     *
     * Use it when the column's input is different from output.
     *
     * When _not_ integrating with [validation libraries](/guide/columns-validation-methods), `narrowAllTypes` has the following syntax:
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   size: t.string().narrowAllTypes((t) =>
     *     t<{
     *       // what types are accepted when creating/updating
     *       input: 'small' | 'medium' | 'large';
     *       // how types are retured from a database
     *       output: 'small' | 'medium' | 'large';
     *       // what types the column accepts in `where` and similar
     *       query: 'small' | 'medium' | 'large';
     *     }>(),
     *   ),
     * }));
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
     * export const Table = defineTable('table', (t) => ({
     *   size: t.text().narrowAllTypes({
     *     input: sizeSchema,
     *     output: sizeSchema,
     *     query: sizeSchema,
     *   }),
     * }));
     *
     * // size will be typed as 'small' | 'medium' | 'large'
     * const size = await db.table.get('size');
     * ```
     *
     * @deprecated use `type`, `inputType`, `outputType`, `queryType` instead
     */
    narrowAllTypes: this['__schema']['narrowAllTypes'];
    input<T extends {
        inputSchema: unknown;
    }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T['inputSchema']) => InputSchema): {
        [K in keyof T]: K extends 'inputSchema' ? InputSchema : T[K];
    };
    output<T extends {
        outputSchema: unknown;
    }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T['outputSchema']) => OutputSchema): {
        [K in keyof T]: K extends 'outputSchema' ? OutputSchema : T[K];
    };
    query<T extends {
        querySchema: unknown;
    }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T['querySchema']) => QuerySchema): {
        [K in keyof T]: K extends 'querySchema' ? QuerySchema : T[K];
    };
    /**
     * Set a database column name.
     *
     * @param name - name of the column in database.
     */
    name<T extends Column.Pick.Data>(this: T, name: string): T;
    /**
     * Append `select(false)` to a column to exclude it from the default selection.
     * It won't be selected with `selectAll` or `select('*')` as well.
     *
     * ```ts
     * export const UserTable = defineTable('user', (t) => ({
     *   id: t.identity().primaryKey(),
     *   name: t.string(),
     *   password: t.string().select(false),
     * }));
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
    select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
    /**
     * Set SQL to use when selecting this column.
     *
     * The column remains a regular writable database column. Create, update,
     * filters, ordering, grouping, and migrations still use the physical column.
     */
    selectSql<T extends Column.Pick.DataAndDataType, Expr extends Expression>(this: T, fn: (column: ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): SelectSqlColumn<T, Expr>;
    /**
     * Forbid the column to be used in [create](/guide/create-update-delete.html#create-insert) and [update](/guide/create-update-delete.html#update) methods.
     *
     * `readOnly` column is still can be set from a [hook](http://localhost:5173/guide/hooks.html#set-values-before-create-or-update).
     *
     * `readOnly` column can be used together with a `default`.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   id: t.identity().primaryKey(),
     *   column: t.string().default(() => 'default value'),
     *   another: t.string().nullable().readOnly(),
     * })).init((orm: typeof db, hooks) => {
     *   hooks.beforeSave(({ columns, set }) => {
     *     if (columns.include('column')) {
     *       set({ another: 'value' });
     *     }
     *   });
     * });
     *
     * // later in the code
     * db.table.create({ column: 'value' }); // TS error, runtime error
     * ```
     */
    readOnly<T>(this: T): T & Column.IsAppReadOnly;
    /**
     * Set a column value when creating a record.
     * This works for [readOnly](#readonly) columns as well.
     *
     * If no value or undefined is returned, the hook won't have any effect.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   id: t.identity().primaryKey(),
     *   some: t.number(),
     *   column: t
     *     .string()
     *     .setOnCreate(({ columns }) =>
     *       columns.include('some') ? 'value' : undefined,
     *     ),
     * }));
     * ```
     */
    setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: QueryHookUtils<PickQueryInputType>) => T['__inputType'] | void): T;
    /**
     * Set a column value when updating a record.
     * This works for [readOnly](#readonly) columns as well.
     *
     * If no value or undefined is returned, the hook won't have any effect.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   id: t.identity().primaryKey(),
     *   some: t.number(),
     *   column: t
     *     .string()
     *     .setOnUpdate(({ columns }) =>
     *       columns.include('some') ? 'value' : undefined,
     *     ),
     * }));
     * ```
     */
    setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: QueryHookUtils<PickQueryInputType>) => T['__inputType'] | void): T;
    /**
     * Set a column value when creating or updating a record.
     * This works for [readOnly](#readonly) columns as well.
     *
     * If no value or undefined is returned, the hook won't have any effect.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   id: t.identity().primaryKey(),
     *   some: t.number(),
     *   column: t
     *     .string()
     *     .setOnSave(({ columns }) =>
     *       columns.include('some') ? 'value' : undefined,
     *     ),
     * }));
     * ```
     */
    setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: QueryHookUtils<PickQueryInputType>) => T['__inputType'] | void): T;
    /**
     * Mark the column as a primary key.
     * This column type becomes an argument of the `.find` method.
     * So if the primary key is of `integer` type (`identity` or `serial`), `.find` will accept the number,
     * or if the primary key is of `UUID` type, `.find` will expect a string.
     *
     * Using `primaryKey` on a `uuid` column will automatically add a [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) default.
     *
     * ```ts
     * export const Table = defineTable('table', (t) => ({
     *   id: t.uuid().primaryKey(),
     *   // optionally, specify a database-level constraint name:
     *   id: t.uuid().primaryKey('primary_key_name'),
     * }));
     *
     * // primary key can be used by `find` later:
     * db.table.find('97ba9e78-7510-415a-9c03-23d440aec443');
     * ```
     *
     * @param name - to specify a constraint name
     */
    primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name): T & Column.IsPrimaryKey<Name>;
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
     * export const SomeTable = defineTable('someTable', (t) => ({
     *   otherTableId: t.integer().foreignKey(() => OtherTable, 'id'),
     * }));
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
    foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: TableData.References.Options): T;
    foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: TableData.References.Options): T;
    toSQL(): string;
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
    index<T extends Column.Pick.Data>(this: T, ...args: [options?: TableData.Index.ColumnArg]): T;
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
    searchIndex<T extends {
        data: Column['data'];
        dataType: string;
    }>(this: T, ...args: [options?: TableData.Index.TsVectorColumnArg]): T;
    unique<T extends Column.Pick.Data, const Options extends TableData.Index.UniqueColumnArg>(this: T, ...args: [options?: Options]): T & Column.IsUnique<Options['name'] & string>;
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
    exclude<T extends Column.Pick.Data>(this: T, op: string, ...args: [options?: TableData.Exclude.ColumnArg]): T;
    comment<T extends Column.Pick.Data>(this: T, comment: string): T;
    compression<T extends Column.Pick.Data>(this: T, compression: string): T;
    collate<T extends Column.Pick.Data>(this: T, collate: string): T;
    modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
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
    generated<T extends Column.Pick.Data>(this: T, ...args: StaticSQLArgs): Column.Generated<T>;
}
