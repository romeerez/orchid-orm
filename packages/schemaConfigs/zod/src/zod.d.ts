import { Column, ArrayColumn, BigIntColumn, BigSerialColumn, CitextColumn, DateColumn, DecimalColumn, DoublePrecisionColumn, EnumColumn, IntegerColumn, JSONColumn, JSONTextColumn, MoneyColumn, RealColumn, SerialColumn, SmallIntColumn, SmallSerialColumn, StringColumn, TextColumn, TimestampColumn, TimestampTZColumn, VarCharColumn, ArrayColumnValue, ColumnSchemaGetterColumns, ColumnSchemaGetterTableClass, StringData, ColumnSchemaConfig, AdapterSchemaConfigOptions } from 'pqb/internal';
import { ZodArray, ZodBoolean, ZodDate, ZodEnum, ZodNever, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodString, ZodType, ZodTypeAny, ZodUnion, ZodUnknown, core } from 'zod/v4';
declare class ZodJSONColumn<ZodSchema extends ZodTypeAny> extends JSONColumn<ZodSchema['_output'], ZodSchemaConfig, ZodSchema> {
    constructor(schemaConfig: ZodSchemaConfig, schema: ZodSchema, encodedByDriver?: boolean);
}
declare class ZodJSONTextColumn<ZodSchema extends ZodTypeAny> extends JSONTextColumn<ZodSchema['_output'], ZodSchemaConfig, ZodSchema> {
    constructor(schemaConfig: ZodSchemaConfig, schema: ZodSchema);
}
interface ArrayMethods<Value> {
    min<T>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;
    max<T>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;
    length<T>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;
    nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
}
interface ZodArrayColumn<Item extends ArrayColumnValue> extends ArrayColumn<ZodSchemaConfig, Item, ZodArray<Item['inputSchema']>, ZodArray<Item['outputSchema']>, ZodArray<Item['querySchema']>>, ArrayMethods<number> {
}
declare class ZodArrayColumn<Item extends ArrayColumnValue> extends ArrayColumn<ZodSchemaConfig, Item, ZodArray<Item['inputSchema']>, ZodArray<Item['outputSchema']>, ZodArray<Item['querySchema']>> {
    constructor(schemaConfig: ZodSchemaConfig, item: Item);
}
interface NumberMethods {
    lt<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
    lte<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
    max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
    gt<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
    gte<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
    min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
    positive<T>(this: T, params?: Column.Error.StringOrMessage): T;
    nonNegative<T>(this: T, params?: Column.Error.StringOrMessage): T;
    negative<T>(this: T, params?: Column.Error.StringOrMessage): T;
    nonPositive<T>(this: T, params?: Column.Error.StringOrMessage): T;
    step<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
    int<T>(this: T, params?: Column.Error.StringOrMessage): T;
    finite<T>(this: T, params?: Column.Error.StringOrMessage): T;
    safe<T>(this: T, params?: Column.Error.StringOrMessage): T;
}
interface SmallIntColumnZod extends SmallIntColumn<ZodSchemaConfig>, NumberMethods {
}
declare class SmallIntColumnZod extends SmallIntColumn<ZodSchemaConfig> {
}
interface IntegerColumnZod extends IntegerColumn<ZodSchemaConfig>, NumberMethods {
}
declare class IntegerColumnZod extends IntegerColumn<ZodSchemaConfig> {
}
interface RealColumnZod extends RealColumn<ZodSchemaConfig>, NumberMethods {
}
declare class RealColumnZod extends RealColumn<ZodSchemaConfig> {
}
interface SmallSerialColumnZod extends SmallSerialColumn<ZodSchemaConfig>, NumberMethods {
}
declare class SmallSerialColumnZod extends SmallSerialColumn<ZodSchemaConfig> {
}
interface SerialColumnZod extends SerialColumn<ZodSchemaConfig>, NumberMethods {
}
declare class SerialColumnZod extends SerialColumn<ZodSchemaConfig> {
}
interface StringMethods extends ArrayMethods<number> {
    email<T>(this: T, params?: Column.Error.StringOrMessage): T;
    url<T>(this: T, params?: Column.Error.StringOrMessage): T;
    emoji<T>(this: T, params?: Column.Error.StringOrMessage): T;
    uuid<T>(this: T, params?: Column.Error.StringOrMessage): T;
    cuid<T>(this: T, params?: Column.Error.StringOrMessage): T;
    cuid2<T>(this: T, params?: Column.Error.StringOrMessage): T;
    ulid<T>(this: T, params?: Column.Error.StringOrMessage): T;
    regex<T>(this: T, value: RegExp, params?: Column.Error.StringOrMessage): T;
    includes<T, Value extends string>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;
    startsWith<T, Value extends string>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;
    endsWith<T, Value extends string>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;
    datetime<T>(this: T, params?: StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
    ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
    ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
    trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
    toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
}
interface BigIntColumnZod extends BigIntColumn<ZodSchemaConfig>, StringMethods {
}
declare class BigIntColumnZod extends BigIntColumn<ZodSchemaConfig> {
}
interface DecimalColumnZod extends DecimalColumn<ZodSchemaConfig>, StringMethods {
}
declare class DecimalColumnZod extends DecimalColumn<ZodSchemaConfig> {
}
interface DoublePrecisionColumnZod extends DoublePrecisionColumn<ZodSchemaConfig>, StringMethods {
}
declare class DoublePrecisionColumnZod extends DoublePrecisionColumn<ZodSchemaConfig> {
}
interface BigSerialColumnZod extends BigSerialColumn<ZodSchemaConfig>, StringMethods {
}
declare class BigSerialColumnZod extends BigSerialColumn<ZodSchemaConfig> {
}
interface MoneyColumnZod extends MoneyColumn<ZodSchemaConfig>, NumberMethods {
}
declare class MoneyColumnZod extends MoneyColumn<ZodSchemaConfig> {
}
interface VarCharColumnZod extends VarCharColumn<ZodSchemaConfig>, StringMethods {
}
declare class VarCharColumnZod extends VarCharColumn<ZodSchemaConfig> {
}
interface TextColumnZod extends TextColumn<ZodSchemaConfig>, StringMethods {
}
declare class TextColumnZod extends TextColumn<ZodSchemaConfig> {
}
interface StringColumnZod extends StringColumn<ZodSchemaConfig>, StringMethods {
}
declare class StringColumnZod extends StringColumn<ZodSchemaConfig> {
}
interface CitextColumnZod extends CitextColumn<ZodSchemaConfig>, StringMethods {
}
declare class CitextColumnZod extends CitextColumn<ZodSchemaConfig> {
}
interface DateMethods {
    min<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
    max<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
}
interface DateColumnZod extends DateColumn<ZodSchemaConfig>, DateMethods {
}
declare class DateColumnZod extends DateColumn<ZodSchemaConfig> {
}
interface TimestampNoTzColumnZod extends TimestampColumn<ZodSchemaConfig>, DateMethods {
}
declare class TimestampNoTzColumnZod extends TimestampColumn<ZodSchemaConfig> {
}
interface TimestampColumnZod extends TimestampTZColumn<ZodSchemaConfig>, DateMethods {
}
declare class TimestampColumnZod extends TimestampTZColumn<ZodSchemaConfig> {
}
type PointSchemaZod = ZodObject<{
    srid: ZodOptional<ZodNumber>;
    lon: ZodNumber;
    lat: ZodNumber;
}>;
export interface BareZodType {
    _output: unknown;
}
export interface ZodSchemaConfig extends ColumnSchemaConfig {
    __schemaType: ZodTypeAny;
    parse<T extends Column.Pick.ForParse, OutputSchema extends ZodTypeAny, Output = OutputSchema['_output']>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output): Column.Parse<T, OutputSchema, Output>;
    parseNull<T extends Column.Pick.ForParseNull, NullSchema extends ZodTypeAny, NullType = NullSchema['_output']>(this: T, _schema: NullSchema, fn: () => NullType): Column.ParseNull<T, NullSchema, NullType>;
    encode<T extends Column.Pick.Type, InputSchema extends ZodTypeAny, Input = InputSchema['_output']>(this: T, _schema: InputSchema, fn: (input: Input) => unknown): Column.Encode<T, InputSchema, Input>;
    /**
     * @deprecated use narrowType instead
     */
    asType<T, Types extends Column.AsTypeArg<ZodTypeAny>, TypeSchema extends ZodTypeAny = Types extends {
        type: ZodTypeAny;
    } ? Types['type'] : never, Type = TypeSchema['_output']>(this: T, types: Types): {
        [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends ZodTypeAny ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends ZodTypeAny ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends ZodTypeAny ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends ZodTypeAny ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends ZodTypeAny ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends ZodTypeAny ? Types['query'] : TypeSchema : T[K];
    };
    narrowType<T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
        _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
    }>(this: T, type: Type): {
        [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K];
    };
    narrowAllTypes<T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
        input?: {
            _output: T['__inputType'];
        };
        output?: {
            _output: T['__outputType'];
        };
        query?: {
            _output: T['__queryType'];
        };
    }>(this: T, types: Types): {
        [K in keyof T]: K extends '__inputType' ? Types['input'] extends BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends BareZodType ? Types['query'] : T['querySchema'] : T[K];
    };
    dateAsNumber<T extends Column.Pick.ForParse>(this: T): Column.Parse<T, ZodNumber, number>;
    dateAsDate<T extends Column.Pick.ForParse>(this: T): Column.Parse<T, ZodDate, Date>;
    enum<T extends readonly string[]>(dataType: string, type: T): EnumColumn<ZodSchemaConfig, ZodEnum<{
        [K in T[number]]: K;
    }>, T>;
    array<Item extends ArrayColumnValue>(item: Item): ZodArrayColumn<Item>;
    nullable<T extends Column.Pick.ForNullable>(this: T): Column.NullableWithSchema<T, ZodNullable<T['inputSchema']>, T['nullSchema'] extends ZodTypeAny ? ZodUnion<[T['outputSchema'], T['nullSchema']]> : ZodNullable<T['outputSchema']>, ZodNullable<T['querySchema']>>;
    json<ZodSchema extends ZodTypeAny = ZodUnknown>(schema?: ZodSchema): ZodJSONColumn<ZodSchema>;
    jsonText<ZodSchema extends ZodTypeAny = ZodUnknown>(schema?: ZodSchema): ZodJSONTextColumn<ZodSchema>;
    boolean(): ZodBoolean;
    buffer(): ZodType<Buffer>;
    unknown(): ZodUnknown;
    never(): ZodNever;
    stringSchema(): ZodString;
    stringMin(max: number): ZodString;
    stringMax(max: number): ZodString;
    stringMinMax(min: number, max: number): ZodString;
    number(): ZodNumber;
    int(): ZodNumber;
    stringNumberDate(): ZodDate;
    timeInterval(): ZodObject<{
        years: ZodOptional<ZodNumber>;
        months: ZodOptional<ZodNumber>;
        days: ZodOptional<ZodNumber>;
        hours: ZodOptional<ZodNumber>;
        minutes: ZodOptional<ZodNumber>;
        seconds: ZodOptional<ZodNumber>;
    }>;
    bit(max: number): ZodString;
    uuid(): ZodString;
    inputSchema<T extends ColumnSchemaGetterTableClass>(this: T): MapSchema<T, 'inputSchema'>;
    outputSchema<T extends ColumnSchemaGetterTableClass>(this: T): MapSchema<T, 'outputSchema'>;
    querySchema<T extends ColumnSchemaGetterTableClass>(this: T): QuerySchema<T>;
    createSchema<T extends ColumnSchemaGetterTableClass>(this: T): CreateSchema<T>;
    updateSchema<T extends ColumnSchemaGetterTableClass>(this: T): UpdateSchema<T>;
    pkeySchema<T extends ColumnSchemaGetterTableClass>(this: T): PkeySchema<T>;
    error<T>(this: T, error: Column.Error.Messages): T;
    smallint(): SmallIntColumnZod;
    integer(): IntegerColumnZod;
    real(): RealColumnZod;
    smallSerial(): SmallSerialColumnZod;
    serial(): SerialColumnZod;
    bigint(): BigIntColumnZod;
    decimal(precision?: number, scale?: number): DecimalColumnZod;
    doublePrecision(): DoublePrecisionColumnZod;
    bigSerial(): BigSerialColumnZod;
    money(): MoneyColumnZod;
    varchar(limit?: number): VarCharColumnZod;
    text(): TextColumnZod;
    string(limit?: number): StringColumnZod;
    citext(): CitextColumnZod;
    date(): DateColumnZod;
    timestampNoTZ(precision?: number): TimestampNoTzColumnZod;
    timestamp(precision?: number): TimestampColumnZod;
    geographyPointSchema(): PointSchemaZod;
}
export declare const zodSchemaConfig: (options?: AdapterSchemaConfigOptions) => ZodSchemaConfig;
type MapSchema<T extends ColumnSchemaGetterTableClass, Key extends 'inputSchema' | 'outputSchema' | 'querySchema'> = ZodObject<{
    [K in keyof ColumnSchemaGetterColumns<T>]: ColumnSchemaGetterColumns<T>[K][Key];
}, core.$strict>;
type QuerySchema<T extends ColumnSchemaGetterTableClass> = ZodObject<{
    [K in keyof ColumnSchemaGetterColumns<T>]: ZodOptional<ColumnSchemaGetterColumns<T>[K]['querySchema']>;
}, core.$strict>;
type CreateSchema<T extends ColumnSchemaGetterTableClass> = ZodObject<{
    [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string ? never : K]: ColumnSchemaGetterColumns<T>[K]['data']['isNullable'] extends true ? ZodOptional<ColumnSchemaGetterColumns<T>[K]['inputSchema']> : ColumnSchemaGetterColumns<T>[K]['data']['default'] extends true ? ZodOptional<ColumnSchemaGetterColumns<T>[K]['inputSchema']> : ColumnSchemaGetterColumns<T>[K]['inputSchema'];
}, core.$strict>;
type UpdateSchema<T extends ColumnSchemaGetterTableClass> = ZodObject<{
    [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string ? never : K]: ZodOptional<ColumnSchemaGetterColumns<T>[K]['inputSchema']>;
}, core.$strict>;
type PkeySchema<T extends ColumnSchemaGetterTableClass> = ZodObject<{
    [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string ? K : never]: ColumnSchemaGetterColumns<T>[K]['inputSchema'];
}, core.$strict>;
export {};
