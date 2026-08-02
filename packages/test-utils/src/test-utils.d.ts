import { Query } from 'pqb';
import { AdapterClass, Column, DriverAdapter, MaybeArray, noop, QueryData, SchemaConfigFnWithOptions, Sql } from 'pqb/internal';
import { zodSchemaConfig, ZodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { createDb as nodePostgresCreateDb } from 'pqb/node-postgres';
import { orchidORM as nodePostgresOrchidORM } from '../../orm/src/adapters/node-postgres';
import { createDb as postgresJsCreateDb } from 'pqb/postgres-js';
import { orchidORM as postgresJsOrchidORM } from '../../orm/src/adapters/postgres-js';
import { createDb as bunCreateDb } from 'pqb/bun';
import { orchidORM as bunOrchidORM } from '../../orm/src/adapters/bun';
export type TestAdapterName = 'postgres-js' | 'node-postgres' | 'bun';
export declare const defaultAdapter: TestAdapterName;
export declare const testAdapterName: TestAdapterName;
export declare const allDriverAdapters: {
    [K in TestAdapterName]?: {
        adapter: DriverAdapter;
        schemaConfig?: SchemaConfigFnWithOptions;
    };
};
export declare const testAdapterConfig: SchemaConfigFnWithOptions | undefined;
export declare const testJsonValue: (x: unknown) => unknown;
export declare const TestAdapter: DriverAdapter;
export declare const createTestDb: typeof nodePostgresCreateDb | typeof postgresJsCreateDb | typeof bunCreateDb;
export declare const testOrchidORM: typeof nodePostgresOrchidORM | typeof postgresJsOrchidORM | typeof bunOrchidORM;
export declare const testRakeDb: import("rake-db").RakeDbFn<MaybeArray<import("pqb/bun").BunAdapterOptions>> | import("rake-db").RakeDbFn<MaybeArray<import("pqb/node-postgres").NodePostgresAdapterOptions>> | import("rake-db").RakeDbFn<MaybeArray<import("pqb/postgres-js").PostgresJsAdapterOptions>>;
export type TestSchemaConfig = ZodSchemaConfig;
export { zodSchemaConfig };
export declare const testDbOptions: {
    databaseURL: string | undefined;
    columnSchema: typeof zodSchemaConfig;
    onnotice: typeof noop;
};
export declare const testSchemaConfig: ZodSchemaConfig;
export declare const testAdapter: AdapterClass;
export declare const testDefaultSchemaConfig: import("pqb/internal").DefaultSchemaConfig;
export declare const testDefaultColumnTypes: import("pqb/internal").DefaultColumnTypes<import("pqb/internal").DefaultSchemaConfig>;
export declare const testColumnTypes: {
    timestamps<T extends Column.Pick.Data>(this: {
        timestamp(): T;
    }): import("pqb/internal").Timestamps<T>;
    timestampsNoTZ<T extends Column.Pick.Data>(this: {
        timestampNoTZ(): T;
    }): import("pqb/internal").Timestamps<T>;
    schema: import("pqb/internal").DefaultSchemaConfig;
    enum: <const T extends readonly [string, ...string[]]>(dataType: string, type: T) => import("pqb/internal").EnumColumn<import("pqb/internal").DefaultSchemaConfig, unknown, T>;
    array: <Item extends import("pqb/internal").ArrayColumnValue>(item: Item) => import("pqb/internal").ArrayColumn<import("pqb/internal").DefaultSchemaConfig, Item, unknown, unknown, unknown>;
    name<T>(this: T, name: string): T;
    sql: import("pqb/internal").SqlFn;
    smallint: () => import("pqb/internal").SmallIntColumn<import("pqb/internal").DefaultSchemaConfig>;
    integer: () => import("pqb/internal").IntegerColumn<import("pqb/internal").DefaultSchemaConfig>;
    bigint: () => import("pqb/internal").BigIntColumn<import("pqb/internal").DefaultSchemaConfig>;
    numeric: (precision?: number, scale?: number) => import("pqb/internal").DecimalColumn<import("pqb/internal").DefaultSchemaConfig>;
    decimal: (precision?: number, scale?: number) => import("pqb/internal").DecimalColumn<import("pqb/internal").DefaultSchemaConfig>;
    real: () => import("pqb/internal").RealColumn<import("pqb/internal").DefaultSchemaConfig>;
    doublePrecision: () => import("pqb/internal").DoublePrecisionColumn<import("pqb/internal").DefaultSchemaConfig>;
    identity(options?: import("pqb/internal").TableData.Identity): Column.HasDefault<import("pqb/internal").IntegerColumn<import("pqb/internal").DefaultSchemaConfig>>;
    smallSerial: () => import("pqb/internal").SmallSerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    serial: () => import("pqb/internal").SerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    bigSerial: () => import("pqb/internal").BigSerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    money: () => import("pqb/internal").MoneyColumn<import("pqb/internal").DefaultSchemaConfig>;
    varchar: (limit?: number) => import("pqb/internal").VarCharColumn<import("pqb/internal").DefaultSchemaConfig>;
    text: () => import("pqb/internal").TextColumn<import("pqb/internal").DefaultSchemaConfig>;
    string: (limit?: number) => import("pqb/internal").StringColumn<import("pqb/internal").DefaultSchemaConfig>;
    citext: () => import("pqb/internal").CitextColumn<import("pqb/internal").DefaultSchemaConfig>;
    bytea(): import("pqb/internal").ByteaColumn<import("pqb/internal").DefaultSchemaConfig>;
    date: () => import("pqb/internal").DateColumn<import("pqb/internal").DefaultSchemaConfig>;
    time(precision?: number): import("pqb/internal").TimeColumn<import("pqb/internal").DefaultSchemaConfig>;
    interval(fields?: string, precision?: number): import("pqb/internal").IntervalColumn<import("pqb/internal").DefaultSchemaConfig>;
    boolean(): import("pqb/internal").BooleanColumn<import("pqb/internal").DefaultSchemaConfig>;
    point(): import("pqb/internal").PointColumn<import("pqb/internal").DefaultSchemaConfig>;
    line(): import("pqb/internal").LineColumn<import("pqb/internal").DefaultSchemaConfig>;
    lseg(): import("pqb/internal").LsegColumn<import("pqb/internal").DefaultSchemaConfig>;
    box(): import("pqb/internal").BoxColumn<import("pqb/internal").DefaultSchemaConfig>;
    path(): import("pqb/internal").PathColumn<import("pqb/internal").DefaultSchemaConfig>;
    polygon(): import("pqb/internal").PolygonColumn<import("pqb/internal").DefaultSchemaConfig>;
    circle(): import("pqb/internal").CircleColumn<import("pqb/internal").DefaultSchemaConfig>;
    cidr(): import("pqb/internal").CidrColumn<import("pqb/internal").DefaultSchemaConfig>;
    inet(): import("pqb/internal").InetColumn<import("pqb/internal").DefaultSchemaConfig>;
    macaddr(): import("pqb/internal").MacAddrColumn<import("pqb/internal").DefaultSchemaConfig>;
    macaddr8(): import("pqb/internal").MacAddr8Column<import("pqb/internal").DefaultSchemaConfig>;
    bit(length: number): import("pqb/internal").BitColumn<import("pqb/internal").DefaultSchemaConfig>;
    bitVarying(length?: number): import("pqb/internal").BitVaryingColumn<import("pqb/internal").DefaultSchemaConfig>;
    tsvector(): import("pqb/internal").TsVectorColumn<import("pqb/internal").DefaultSchemaConfig>;
    tsquery(): import("pqb/internal").TsQueryColumn<import("pqb/internal").DefaultSchemaConfig>;
    uuid(): import("pqb/internal").UUIDColumn<import("pqb/internal").DefaultSchemaConfig>;
    xml(): import("pqb/internal").XMLColumn<import("pqb/internal").DefaultSchemaConfig>;
    json: <T>() => import("pqb/internal").JSONColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, import("pqb/internal").DefaultSchemaConfig>;
    jsonText: <T>() => import("pqb/internal").JSONTextColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, import("pqb/internal").DefaultSchemaConfig>;
    type(dataType: string): import("pqb/internal").CustomTypeColumn<import("pqb/internal").DefaultSchemaConfig>;
    domain(dataType: string): import("pqb/internal").DomainColumn<import("pqb/internal").DefaultSchemaConfig>;
    geography: {
        point(): import("pqb/internal").PostgisGeographyPointColumn<import("pqb/internal").DefaultSchemaConfig>;
    };
    timestamp(precision?: number): Column.Parse<import("pqb/internal").TimestampTZColumn<import("pqb/internal").DefaultSchemaConfig>, unknown, Date>;
    timestampNoTZ(precision?: number): Column.Parse<import("pqb/internal").TimestampColumn<import("pqb/internal").DefaultSchemaConfig>, unknown, Date>;
};
export declare const testDb: import("pqb/internal").DbResult<{
    timestamps<T extends Column.Pick.Data>(this: {
        timestamp(): T;
    }): import("pqb/internal").Timestamps<T>;
    timestampsNoTZ<T extends Column.Pick.Data>(this: {
        timestampNoTZ(): T;
    }): import("pqb/internal").Timestamps<T>;
    schema: import("pqb/internal").DefaultSchemaConfig;
    enum: <const T extends readonly [string, ...string[]]>(dataType: string, type: T) => import("pqb/internal").EnumColumn<import("pqb/internal").DefaultSchemaConfig, unknown, T>;
    array: <Item extends import("pqb/internal").ArrayColumnValue>(item: Item) => import("pqb/internal").ArrayColumn<import("pqb/internal").DefaultSchemaConfig, Item, unknown, unknown, unknown>;
    name<T>(this: T, name: string): T;
    sql: import("pqb/internal").SqlFn;
    smallint: () => import("pqb/internal").SmallIntColumn<import("pqb/internal").DefaultSchemaConfig>;
    integer: () => import("pqb/internal").IntegerColumn<import("pqb/internal").DefaultSchemaConfig>;
    bigint: () => import("pqb/internal").BigIntColumn<import("pqb/internal").DefaultSchemaConfig>;
    numeric: (precision?: number, scale?: number) => import("pqb/internal").DecimalColumn<import("pqb/internal").DefaultSchemaConfig>;
    decimal: (precision?: number, scale?: number) => import("pqb/internal").DecimalColumn<import("pqb/internal").DefaultSchemaConfig>;
    real: () => import("pqb/internal").RealColumn<import("pqb/internal").DefaultSchemaConfig>;
    doublePrecision: () => import("pqb/internal").DoublePrecisionColumn<import("pqb/internal").DefaultSchemaConfig>;
    identity(options?: import("pqb/internal").TableData.Identity): Column.HasDefault<import("pqb/internal").IntegerColumn<import("pqb/internal").DefaultSchemaConfig>>;
    smallSerial: () => import("pqb/internal").SmallSerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    serial: () => import("pqb/internal").SerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    bigSerial: () => import("pqb/internal").BigSerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    money: () => import("pqb/internal").MoneyColumn<import("pqb/internal").DefaultSchemaConfig>;
    varchar: (limit?: number) => import("pqb/internal").VarCharColumn<import("pqb/internal").DefaultSchemaConfig>;
    text: () => import("pqb/internal").TextColumn<import("pqb/internal").DefaultSchemaConfig>;
    string: (limit?: number) => import("pqb/internal").StringColumn<import("pqb/internal").DefaultSchemaConfig>;
    citext: () => import("pqb/internal").CitextColumn<import("pqb/internal").DefaultSchemaConfig>;
    bytea(): import("pqb/internal").ByteaColumn<import("pqb/internal").DefaultSchemaConfig>;
    date: () => import("pqb/internal").DateColumn<import("pqb/internal").DefaultSchemaConfig>;
    time(precision?: number): import("pqb/internal").TimeColumn<import("pqb/internal").DefaultSchemaConfig>;
    interval(fields?: string, precision?: number): import("pqb/internal").IntervalColumn<import("pqb/internal").DefaultSchemaConfig>;
    boolean(): import("pqb/internal").BooleanColumn<import("pqb/internal").DefaultSchemaConfig>;
    point(): import("pqb/internal").PointColumn<import("pqb/internal").DefaultSchemaConfig>;
    line(): import("pqb/internal").LineColumn<import("pqb/internal").DefaultSchemaConfig>;
    lseg(): import("pqb/internal").LsegColumn<import("pqb/internal").DefaultSchemaConfig>;
    box(): import("pqb/internal").BoxColumn<import("pqb/internal").DefaultSchemaConfig>;
    path(): import("pqb/internal").PathColumn<import("pqb/internal").DefaultSchemaConfig>;
    polygon(): import("pqb/internal").PolygonColumn<import("pqb/internal").DefaultSchemaConfig>;
    circle(): import("pqb/internal").CircleColumn<import("pqb/internal").DefaultSchemaConfig>;
    cidr(): import("pqb/internal").CidrColumn<import("pqb/internal").DefaultSchemaConfig>;
    inet(): import("pqb/internal").InetColumn<import("pqb/internal").DefaultSchemaConfig>;
    macaddr(): import("pqb/internal").MacAddrColumn<import("pqb/internal").DefaultSchemaConfig>;
    macaddr8(): import("pqb/internal").MacAddr8Column<import("pqb/internal").DefaultSchemaConfig>;
    bit(length: number): import("pqb/internal").BitColumn<import("pqb/internal").DefaultSchemaConfig>;
    bitVarying(length?: number): import("pqb/internal").BitVaryingColumn<import("pqb/internal").DefaultSchemaConfig>;
    tsvector(): import("pqb/internal").TsVectorColumn<import("pqb/internal").DefaultSchemaConfig>;
    tsquery(): import("pqb/internal").TsQueryColumn<import("pqb/internal").DefaultSchemaConfig>;
    uuid(): import("pqb/internal").UUIDColumn<import("pqb/internal").DefaultSchemaConfig>;
    xml(): import("pqb/internal").XMLColumn<import("pqb/internal").DefaultSchemaConfig>;
    json: <T>() => import("pqb/internal").JSONColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, import("pqb/internal").DefaultSchemaConfig>;
    jsonText: <T>() => import("pqb/internal").JSONTextColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, import("pqb/internal").DefaultSchemaConfig>;
    type(dataType: string): import("pqb/internal").CustomTypeColumn<import("pqb/internal").DefaultSchemaConfig>;
    domain(dataType: string): import("pqb/internal").DomainColumn<import("pqb/internal").DefaultSchemaConfig>;
    geography: {
        point(): import("pqb/internal").PostgisGeographyPointColumn<import("pqb/internal").DefaultSchemaConfig>;
    };
    timestamp(precision?: number): Column.Parse<import("pqb/internal").TimestampTZColumn<import("pqb/internal").DefaultSchemaConfig>, unknown, Date>;
    timestampNoTZ(precision?: number): Column.Parse<import("pqb/internal").TimestampColumn<import("pqb/internal").DefaultSchemaConfig>, unknown, Date>;
}>;
export declare const sql: import("pqb/internal").DbSqlMethod<{
    timestamps<T extends Column.Pick.Data>(this: {
        timestamp(): T;
    }): import("pqb/internal").Timestamps<T>;
    timestampsNoTZ<T extends Column.Pick.Data>(this: {
        timestampNoTZ(): T;
    }): import("pqb/internal").Timestamps<T>;
    schema: import("pqb/internal").DefaultSchemaConfig;
    enum: <const T extends readonly [string, ...string[]]>(dataType: string, type: T) => import("pqb/internal").EnumColumn<import("pqb/internal").DefaultSchemaConfig, unknown, T>;
    array: <Item extends import("pqb/internal").ArrayColumnValue>(item: Item) => import("pqb/internal").ArrayColumn<import("pqb/internal").DefaultSchemaConfig, Item, unknown, unknown, unknown>;
    name<T>(this: T, name: string): T;
    sql: import("pqb/internal").SqlFn;
    smallint: () => import("pqb/internal").SmallIntColumn<import("pqb/internal").DefaultSchemaConfig>;
    integer: () => import("pqb/internal").IntegerColumn<import("pqb/internal").DefaultSchemaConfig>;
    bigint: () => import("pqb/internal").BigIntColumn<import("pqb/internal").DefaultSchemaConfig>;
    numeric: (precision?: number, scale?: number) => import("pqb/internal").DecimalColumn<import("pqb/internal").DefaultSchemaConfig>;
    decimal: (precision?: number, scale?: number) => import("pqb/internal").DecimalColumn<import("pqb/internal").DefaultSchemaConfig>;
    real: () => import("pqb/internal").RealColumn<import("pqb/internal").DefaultSchemaConfig>;
    doublePrecision: () => import("pqb/internal").DoublePrecisionColumn<import("pqb/internal").DefaultSchemaConfig>;
    identity(options?: import("pqb/internal").TableData.Identity): Column.HasDefault<import("pqb/internal").IntegerColumn<import("pqb/internal").DefaultSchemaConfig>>;
    smallSerial: () => import("pqb/internal").SmallSerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    serial: () => import("pqb/internal").SerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    bigSerial: () => import("pqb/internal").BigSerialColumn<import("pqb/internal").DefaultSchemaConfig>;
    money: () => import("pqb/internal").MoneyColumn<import("pqb/internal").DefaultSchemaConfig>;
    varchar: (limit?: number) => import("pqb/internal").VarCharColumn<import("pqb/internal").DefaultSchemaConfig>;
    text: () => import("pqb/internal").TextColumn<import("pqb/internal").DefaultSchemaConfig>;
    string: (limit?: number) => import("pqb/internal").StringColumn<import("pqb/internal").DefaultSchemaConfig>;
    citext: () => import("pqb/internal").CitextColumn<import("pqb/internal").DefaultSchemaConfig>;
    bytea(): import("pqb/internal").ByteaColumn<import("pqb/internal").DefaultSchemaConfig>;
    date: () => import("pqb/internal").DateColumn<import("pqb/internal").DefaultSchemaConfig>;
    time(precision?: number): import("pqb/internal").TimeColumn<import("pqb/internal").DefaultSchemaConfig>;
    interval(fields?: string, precision?: number): import("pqb/internal").IntervalColumn<import("pqb/internal").DefaultSchemaConfig>;
    boolean(): import("pqb/internal").BooleanColumn<import("pqb/internal").DefaultSchemaConfig>;
    point(): import("pqb/internal").PointColumn<import("pqb/internal").DefaultSchemaConfig>;
    line(): import("pqb/internal").LineColumn<import("pqb/internal").DefaultSchemaConfig>;
    lseg(): import("pqb/internal").LsegColumn<import("pqb/internal").DefaultSchemaConfig>;
    box(): import("pqb/internal").BoxColumn<import("pqb/internal").DefaultSchemaConfig>;
    path(): import("pqb/internal").PathColumn<import("pqb/internal").DefaultSchemaConfig>;
    polygon(): import("pqb/internal").PolygonColumn<import("pqb/internal").DefaultSchemaConfig>;
    circle(): import("pqb/internal").CircleColumn<import("pqb/internal").DefaultSchemaConfig>;
    cidr(): import("pqb/internal").CidrColumn<import("pqb/internal").DefaultSchemaConfig>;
    inet(): import("pqb/internal").InetColumn<import("pqb/internal").DefaultSchemaConfig>;
    macaddr(): import("pqb/internal").MacAddrColumn<import("pqb/internal").DefaultSchemaConfig>;
    macaddr8(): import("pqb/internal").MacAddr8Column<import("pqb/internal").DefaultSchemaConfig>;
    bit(length: number): import("pqb/internal").BitColumn<import("pqb/internal").DefaultSchemaConfig>;
    bitVarying(length?: number): import("pqb/internal").BitVaryingColumn<import("pqb/internal").DefaultSchemaConfig>;
    tsvector(): import("pqb/internal").TsVectorColumn<import("pqb/internal").DefaultSchemaConfig>;
    tsquery(): import("pqb/internal").TsQueryColumn<import("pqb/internal").DefaultSchemaConfig>;
    uuid(): import("pqb/internal").UUIDColumn<import("pqb/internal").DefaultSchemaConfig>;
    xml(): import("pqb/internal").XMLColumn<import("pqb/internal").DefaultSchemaConfig>;
    json: <T>() => import("pqb/internal").JSONColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, import("pqb/internal").DefaultSchemaConfig>;
    jsonText: <T>() => import("pqb/internal").JSONTextColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, import("pqb/internal").DefaultSchemaConfig>;
    type(dataType: string): import("pqb/internal").CustomTypeColumn<import("pqb/internal").DefaultSchemaConfig>;
    domain(dataType: string): import("pqb/internal").DomainColumn<import("pqb/internal").DefaultSchemaConfig>;
    geography: {
        point(): import("pqb/internal").PostgisGeographyPointColumn<import("pqb/internal").DefaultSchemaConfig>;
    };
    timestamp(precision?: number): Column.Parse<import("pqb/internal").TimestampTZColumn<import("pqb/internal").DefaultSchemaConfig>, unknown, Date>;
    timestampNoTZ(precision?: number): Column.Parse<import("pqb/internal").TimestampColumn<import("pqb/internal").DefaultSchemaConfig>, unknown, Date>;
}>;
export declare const zodColumnTypes: import("pqb/internal").DefaultColumnTypes<ZodSchemaConfig>;
export declare const testZodColumnTypes: {
    timestamps<T extends Column.Pick.Data>(this: {
        timestamp(): T;
    }): import("pqb/internal").Timestamps<T>;
    timestampsNoTZ<T extends Column.Pick.Data>(this: {
        timestampNoTZ(): T;
    }): import("pqb/internal").Timestamps<T>;
    schema: ZodSchemaConfig;
    enum: <T extends readonly string[]>(dataType: string, type: T) => import("pqb/internal").EnumColumn<ZodSchemaConfig, import("zod/v4").ZodEnum<{ [K in T[number]]: K; }>, T>;
    array: <Item extends import("pqb/internal").ArrayColumnValue>(item: Item) => {
        __schema: ZodSchemaConfig;
        dataType: 'array';
        operators: import("pqb/internal").OperatorsArray<Item["__queryType"]>;
        data: import("pqb/internal").ArrayData<Item>;
        __type: Item["__type"][];
        __inputType: Item["__type"][];
        inputSchema: import("zod/v4").ZodArray<Item["inputSchema"]>;
        __outputType: Item["__outputType"][];
        outputSchema: import("zod/v4").ZodArray<Item["outputSchema"]>;
        __queryType: Item["__queryType"][];
        querySchema: import("zod/v4").ZodArray<Item["querySchema"]>;
        toSQL(): string;
        toCode(this: import("pqb/internal").ArrayColumn<import("pqb/internal").ColumnSchemaConfig, import("pqb/internal").ArrayColumnValue, unknown, unknown, unknown>, ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    name<T>(this: T, name: string): T;
    sql: import("pqb/internal").SqlFn;
    smallint: () => {
        __schema: ZodSchemaConfig;
        __type: number;
        __inputType: number;
        inputSchema: import("zod/v4").ZodNumber;
        __outputType: number;
        outputSchema: import("zod/v4").ZodNumber;
        __queryType: number;
        operators: import("pqb/internal").OperatorsNumber;
        data: import("pqb/internal").NumberColumnData;
        dataType: 'int2';
        querySchema: import("zod/v4").ZodNumber;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        identity<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Identity): Column.HasDefault<T>;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
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
    };
    integer: () => {
        __schema: ZodSchemaConfig;
        __type: number;
        __inputType: number;
        inputSchema: import("zod/v4").ZodNumber;
        __outputType: number;
        outputSchema: import("zod/v4").ZodNumber;
        __queryType: number;
        operators: import("pqb/internal").OperatorsNumber;
        data: import("pqb/internal").NumberColumnData;
        dataType: 'int4';
        querySchema: import("zod/v4").ZodNumber;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        identity<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Identity): Column.HasDefault<T>;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
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
    };
    bigint: () => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string | number | bigint;
        inputSchema: import("zod/v4").ZodString;
        operators: import("pqb/internal").OperatorsNumber;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string | number | bigint;
        data: Column.Data;
        dataType: 'int8';
        querySchema: import("zod/v4").ZodString;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        identity<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Identity): Column.HasDefault<T>;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    numeric: (precision?: number, scale?: number) => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string | number;
        inputSchema: import("zod/v4").ZodString;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string | number;
        data: import("pqb/internal").DecimalColumnData;
        querySchema: import("zod/v4").ZodString;
        operators: import("pqb/internal").OperatorsNumber;
        dataType: 'numeric';
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        toSQL(): string;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    decimal: (precision?: number, scale?: number) => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string | number;
        inputSchema: import("zod/v4").ZodString;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string | number;
        data: import("pqb/internal").DecimalColumnData;
        querySchema: import("zod/v4").ZodString;
        operators: import("pqb/internal").OperatorsNumber;
        dataType: 'numeric';
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        toSQL(): string;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    real: () => {
        __schema: ZodSchemaConfig;
        __type: number;
        __inputType: number;
        inputSchema: import("zod/v4").ZodNumber;
        data: import("pqb/internal").NumberColumnData;
        __outputType: number;
        outputSchema: import("zod/v4").ZodNumber;
        __queryType: number;
        operators: import("pqb/internal").OperatorsNumber;
        dataType: 'float4';
        querySchema: import("zod/v4").ZodNumber;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
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
    };
    doublePrecision: () => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string | number;
        inputSchema: import("zod/v4").ZodString;
        operators: import("pqb/internal").OperatorsNumber;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string | number;
        data: Column.Data;
        dataType: 'float8';
        querySchema: import("zod/v4").ZodString;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    identity(options?: import("pqb/internal").TableData.Identity): Column.HasDefault<{
        __schema: ZodSchemaConfig;
        __type: number;
        __inputType: number;
        inputSchema: import("zod/v4").ZodNumber;
        __outputType: number;
        outputSchema: import("zod/v4").ZodNumber;
        __queryType: number;
        operators: import("pqb/internal").OperatorsNumber;
        data: import("pqb/internal").NumberColumnData;
        dataType: 'int4';
        querySchema: import("zod/v4").ZodNumber;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        identity<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Identity): Column.HasDefault<T>;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
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
    }>;
    smallSerial: () => {
        __schema: ZodSchemaConfig;
        __type: number;
        __inputType: number;
        inputSchema: import("zod/v4").ZodNumber;
        __outputType: number;
        outputSchema: import("zod/v4").ZodNumber;
        __queryType: number;
        operators: import("pqb/internal").OperatorsNumber;
        dataType: 'int2';
        data: import("pqb/internal").SerialColumnData;
        querySchema: import("zod/v4").ZodNumber;
        toSQL(): string;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
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
    };
    serial: () => {
        __schema: ZodSchemaConfig;
        __type: number;
        __inputType: number;
        inputSchema: import("zod/v4").ZodNumber;
        __outputType: number;
        outputSchema: import("zod/v4").ZodNumber;
        __queryType: number;
        operators: import("pqb/internal").OperatorsNumber;
        dataType: 'int4';
        data: import("pqb/internal").SerialColumnData;
        querySchema: import("zod/v4").ZodNumber;
        toSQL(): string;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
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
    };
    bigSerial: () => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string | number;
        inputSchema: import("zod/v4").ZodString;
        operators: import("pqb/internal").OperatorsNumber;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string | number;
        dataType: 'int8';
        data: import("pqb/internal").SerialColumnData;
        querySchema: import("zod/v4").ZodString;
        toSQL(): string;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    money: () => {
        __schema: ZodSchemaConfig;
        dataType: 'money';
        __type: string;
        data: import("pqb/internal").NumberColumnData;
        __inputType: string | number;
        inputSchema: import("zod/v4").ZodNumber;
        __outputType: number;
        outputSchema: import("zod/v4").ZodNumber;
        __queryType: string | number;
        querySchema: import("zod/v4").ZodNumber;
        operators: import("pqb/internal").OperatorsNumber;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
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
    };
    varchar: (limit?: number) => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string;
        inputSchema: import("zod/v4").ZodString;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string;
        querySchema: import("zod/v4").ZodString;
        data: import("pqb/internal").StringData & {
            maxChars?: number;
        };
        operators: import("pqb/internal").OperatorsOrdinalText;
        toSQL(): string;
        dataType: 'varchar';
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    text: () => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string;
        inputSchema: import("zod/v4").ZodString;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string;
        dataType: 'text';
        data: import("pqb/internal").StringData & {
            minArg?: number;
            maxArg?: number;
        };
        querySchema: import("zod/v4").ZodString;
        operators: import("pqb/internal").OperatorsOrdinalText;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    string: (limit?: number) => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: string;
        inputSchema: import("zod/v4").ZodString;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string;
        querySchema: import("zod/v4").ZodString;
        data: import("pqb/internal").StringData & {
            maxChars?: number;
        };
        operators: import("pqb/internal").OperatorsOrdinalText;
        toSQL(): string;
        dataType: 'varchar';
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    citext: () => {
        __type: string;
        __inputType: string;
        inputSchema: import("zod/v4").ZodString;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: string;
        __schema: ZodSchemaConfig;
        dataType: 'citext';
        data: import("pqb/internal").StringData & {
            minArg?: number;
            maxArg?: number;
        };
        querySchema: import("zod/v4").ZodString;
        operators: import("pqb/internal").OperatorsOrdinalText;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        length<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
        nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
        datetime<T>(this: T, params?: import("pqb/internal").StringData['datetime'] & Exclude<Column.Error.StringOrMessage, string>): T;
        ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;
        trim<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
        toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
    };
    bytea(): import("pqb/internal").ByteaColumn<ZodSchemaConfig>;
    date: () => {
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: import("pqb/internal").DateColumnInput;
        inputSchema: import("zod/v4").ZodDate;
        data: import("pqb/internal").DateColumnData;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: import("pqb/internal").DateColumnInput;
        querySchema: import("zod/v4").ZodDate;
        operators: import("pqb/internal").OperatorsDate;
        asNumber: <T extends Column.Pick.ForParse>(this: T) => Column.Parse<T, import("zod/v4").ZodNumber, number>;
        asDate: <T extends Column.Pick.ForParse>(this: T) => Column.Parse<T, import("zod/v4").ZodDate, Date>;
        dateParsedByDriver?: boolean | undefined;
        dataType: 'date';
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
    };
    time(precision?: number): import("pqb/internal").TimeColumn<ZodSchemaConfig>;
    interval(fields?: string, precision?: number): import("pqb/internal").IntervalColumn<ZodSchemaConfig>;
    boolean(): import("pqb/internal").BooleanColumn<ZodSchemaConfig>;
    point(): import("pqb/internal").PointColumn<ZodSchemaConfig>;
    line(): import("pqb/internal").LineColumn<ZodSchemaConfig>;
    lseg(): import("pqb/internal").LsegColumn<ZodSchemaConfig>;
    box(): import("pqb/internal").BoxColumn<ZodSchemaConfig>;
    path(): import("pqb/internal").PathColumn<ZodSchemaConfig>;
    polygon(): import("pqb/internal").PolygonColumn<ZodSchemaConfig>;
    circle(): import("pqb/internal").CircleColumn<ZodSchemaConfig>;
    cidr(): import("pqb/internal").CidrColumn<ZodSchemaConfig>;
    inet(): import("pqb/internal").InetColumn<ZodSchemaConfig>;
    macaddr(): import("pqb/internal").MacAddrColumn<ZodSchemaConfig>;
    macaddr8(): import("pqb/internal").MacAddr8Column<ZodSchemaConfig>;
    bit(length: number): import("pqb/internal").BitColumn<ZodSchemaConfig>;
    bitVarying(length?: number): import("pqb/internal").BitVaryingColumn<ZodSchemaConfig>;
    tsvector(): import("pqb/internal").TsVectorColumn<ZodSchemaConfig>;
    tsquery(): import("pqb/internal").TsQueryColumn<ZodSchemaConfig>;
    uuid(): import("pqb/internal").UUIDColumn<ZodSchemaConfig>;
    xml(): import("pqb/internal").XMLColumn<ZodSchemaConfig>;
    json: <ZodSchema extends import("zod/v4").ZodType = import("zod/v4").ZodUnknown>(schema?: ZodSchema) => {
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __schema: ZodSchemaConfig;
        dataType: 'jsonb';
        __type: ZodSchema["_output"];
        __inputType: ZodSchema["_output"];
        inputSchema: ZodSchema;
        __outputType: ZodSchema["_output"];
        outputSchema: ZodSchema;
        __queryType: ZodSchema["_output"];
        querySchema: ZodSchema;
        operators: import("pqb/internal").OperatorsJson;
        __nullType: unknown;
        nullSchema: unknown;
        data: Column.Data;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
    };
    jsonText: <ZodSchema extends import("zod/v4").ZodType = import("zod/v4").ZodUnknown>(schema?: ZodSchema) => {
        __schema: ZodSchemaConfig;
        dataType: 'json';
        __type: ZodSchema["_output"];
        __inputType: ZodSchema["_output"];
        inputSchema: ZodSchema;
        __outputType: ZodSchema["_output"];
        outputSchema: ZodSchema;
        __queryType: ZodSchema["_output"];
        querySchema: ZodSchema;
        operators: import("pqb/internal").OperatorsText;
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        data: Column.Data;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        toSQL(): string;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
    };
    type(dataType: string): import("pqb/internal").CustomTypeColumn<ZodSchemaConfig>;
    domain(dataType: string): import("pqb/internal").DomainColumn<ZodSchemaConfig>;
    geography: {
        point(): import("pqb/internal").PostgisGeographyPointColumn<ZodSchemaConfig>;
    };
    timestamp(): Column.Parse<{
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: import("pqb/internal").DateColumnInput;
        inputSchema: import("zod/v4").ZodDate;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: import("pqb/internal").DateColumnInput;
        querySchema: import("zod/v4").ZodDate;
        operators: import("pqb/internal").OperatorsDate;
        asNumber: <T extends Column.Pick.ForParse>(this: T) => Column.Parse<T, import("zod/v4").ZodNumber, number>;
        asDate: <T extends Column.Pick.ForParse>(this: T) => Column.Parse<T, import("zod/v4").ZodDate, Date>;
        dateParsedByDriver?: boolean | undefined;
        data: import("pqb/internal").DateColumnData & {
            dateTimePrecision?: number;
        };
        toSQL(): string;
        dataType: 'timestamptz';
        baseDataType: 'timestamp';
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
    }, import("zod/v4").ZodDate, Date>;
    timestampNoTZ(): Column.Parse<{
        __schema: ZodSchemaConfig;
        __type: string;
        __inputType: import("pqb/internal").DateColumnInput;
        inputSchema: import("zod/v4").ZodDate;
        __outputType: string;
        outputSchema: import("zod/v4").ZodString;
        __queryType: import("pqb/internal").DateColumnInput;
        querySchema: import("zod/v4").ZodDate;
        operators: import("pqb/internal").OperatorsDate;
        asNumber: <T extends Column.Pick.ForParse>(this: T) => Column.Parse<T, import("zod/v4").ZodNumber, number>;
        asDate: <T extends Column.Pick.ForParse>(this: T) => Column.Parse<T, import("zod/v4").ZodDate, Date>;
        dateParsedByDriver?: boolean | undefined;
        data: import("pqb/internal").DateColumnData & {
            dateTimePrecision?: number;
        };
        toSQL(): string;
        dataType: 'timestamp';
        toCode(ctx: import("pqb/internal").ColumnToCodeCtx, key: string): import("pqb/internal").Code;
        __nullType: unknown;
        nullSchema: unknown;
        error: <T>(this: T, error: Column.Error.Messages) => T;
        _parse?: ((input: unknown) => unknown) | undefined;
        default<T extends Column.Pick.DataAndInputType, Value extends T["__inputType"] | null | import("pqb/internal").RawSqlBase | (() => T["__inputType"])>(this: T, value: Value): Column.HasDefault<T>;
        hasDefault<T extends Column.Pick.Data>(this: T): Column.HasDefault<T>;
        check<T extends Column.Pick.Data>(this: T, sql: import("pqb/internal").RawSqlBase, name?: string): T;
        nullable: <T extends Column.Pick.ForNullable>(this: T) => Column.NullableWithSchema<T, import("zod/v4").ZodNullable<T['inputSchema']>, T['nullSchema'] extends import("zod/v4").ZodType ? import("zod/v4").ZodUnion<[T['outputSchema'], T['nullSchema']]> : import("zod/v4").ZodNullable<T['outputSchema']>, import("zod/v4").ZodNullable<T['querySchema']>>;
        encode: <T extends Column.Pick.Type, InputSchema extends import("zod/v4").ZodType, Input = InputSchema["_output"]>(this: T, _schema: InputSchema, fn: (input: Input) => unknown) => Column.Encode<T, InputSchema, Input>;
        parse: <T extends Column.Pick.ForParse, OutputSchema extends import("zod/v4").ZodType, Output = OutputSchema["_output"]>(this: T, _schema: OutputSchema, fn: (input: T['__type']) => Output) => Column.Parse<T, OutputSchema, Output>;
        parseNull: <T extends Column.Pick.ForParseNull, NullSchema extends import("zod/v4").ZodType, NullType = NullSchema["_output"]>(this: T, _schema: NullSchema, fn: () => NullType) => Column.ParseNull<T, NullSchema, NullType>;
        as<T extends {
            __inputType: unknown;
            __outputType: unknown;
            data: Column.Data;
        }, C extends {
            __inputType: T["__inputType"];
            __outputType: T["__outputType"];
        }>(this: T, column: C): C;
        asType: <T, Types extends Column.AsTypeArg<import("zod/v4").ZodType>, TypeSchema extends import("zod/v4").ZodType = Types extends {
            type: import("zod/v4").ZodType;
        } ? Types["type"] : never, Type = TypeSchema["_output"]>(this: T, types: Types) => { [K in keyof T]: K extends '__type' ? Type : K extends '__inputType' ? Types['input'] extends import("zod/v4").ZodType ? Types['input']['_output'] : Type : K extends 'inputSchema' ? Types['input'] extends import("zod/v4").ZodType ? Types['input'] : TypeSchema : K extends '__outputType' ? Types['output'] extends import("zod/v4").ZodType ? Types['output']['_output'] : Type : K extends 'outputSchema' ? Types['output'] extends import("zod/v4").ZodType ? Types['output'] : TypeSchema : K extends '__queryType' ? Types['query'] extends import("zod/v4").ZodType ? Types['query']['_output'] : Type : K extends 'querySchema' ? Types['query'] extends import("zod/v4").ZodType ? Types['query'] : TypeSchema : T[K]; };
        narrowType: <T extends Column.InputOutputQueryTypesWithSchemas, Type extends {
            _output: T['__inputType'] extends never ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType'];
        }>(this: T, type: Type) => { [K in keyof T]: K extends '__inputType' ? T['__inputType'] extends never ? never : Type['_output'] : K extends '__outputType' | '__queryType' ? Type['_output'] : K extends 'inputSchema' ? T['__inputType'] extends never ? import("zod/v4").ZodNever : Type : K extends 'outputSchema' | 'querySchema' ? Type : T[K]; };
        narrowAllTypes: <T extends Column.InputOutputQueryTypesWithSchemas, Types extends {
            input?: {
                _output: T['__inputType'];
            };
            output?: {
                _output: T['__outputType'];
            };
            query?: {
                _output: T['__queryType'];
            };
        }>(this: T, types: Types) => { [K in keyof T]: K extends '__inputType' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input']['_output'] : T['__inputType'] : K extends 'inputSchema' ? Types['input'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['input'] : T['inputSchema'] : K extends '__outputType' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output']['_output'] : T['__outputType'] : K extends 'outputSchema' ? Types['output'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['output'] : T['outputSchema'] : K extends '__queryType' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query']['_output'] : T['__queryType'] : K extends 'querySchema' ? Types['query'] extends import("orchid-orm-schema-to-zod").BareZodType ? Types['query'] : T['querySchema'] : T[K]; };
        input<T extends {
            inputSchema: unknown;
        }, InputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["inputSchema"]) => InputSchema): { [K in keyof T]: K extends "inputSchema" ? InputSchema : T[K]; };
        output<T extends {
            outputSchema: unknown;
        }, OutputSchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["outputSchema"]) => OutputSchema): { [K in keyof T]: K extends "outputSchema" ? OutputSchema : T[K]; };
        query<T extends {
            querySchema: unknown;
        }, QuerySchema extends this['__schema']['__schemaType']>(this: T, fn: (schema: T["querySchema"]) => QuerySchema): { [K in keyof T]: K extends "querySchema" ? QuerySchema : T[K]; };
        name<T extends Column.Pick.Data>(this: T, name: string): T;
        select<T extends Column.Pick.Data, Value extends boolean>(this: T, value: Value): Column.DefaultSelect<T, Value>;
        selectSql<T extends Column.Pick.DataAndDataType, Expr extends import("pqb").Expression>(this: T, fn: (column: import("pqb/internal").ColumnRefExpression<T & Column.Pick.QueryColumn>) => Expr): import("pqb/internal").SelectSqlColumn<T, Expr>;
        readOnly<T>(this: T): T & Column.IsAppReadOnly;
        setOnCreate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnUpdate<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        setOnSave<T extends Column.Pick.QueryInit>(this: T, fn: (arg: import("pqb/internal").QueryHookUtils<import("pqb/internal").PickQueryInputType>) => void | T["__inputType"]): T;
        primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name | undefined): T & Column.IsPrimaryKey<Name>;
        foreignKey<T, Table extends Column.ForeignKey.TableParam>(this: T, fn: () => Table, column: Column.ForeignKey.ColumnNameOfTable<Table>, options?: import("pqb/internal").TableData.References.Options): T;
        foreignKey<T, Table extends string, Column extends string>(this: T, table: Table, column: Column, options?: import("pqb/internal").TableData.References.Options): T;
        index<T extends Column.Pick.Data>(this: T, options?: import("pqb/internal").TableData.Index.ColumnArg<string> | undefined): T;
        searchIndex<T extends {
            data: Column['data'];
            dataType: string;
        }>(this: T, options?: import("pqb/internal").TableData.Index.TsVectorColumnArg | undefined): T;
        unique<T extends Column.Pick.Data, const Options extends import("pqb/internal").TableData.Index.UniqueColumnArg>(this: T, options?: Options | undefined): T & Column.IsUnique<Options["name"] & string>;
        exclude<T extends Column.Pick.Data>(this: T, op: string, options?: import("pqb/internal").TableData.Exclude.ColumnArg | undefined): T;
        comment<T extends Column.Pick.Data>(this: T, comment: string): T;
        compression<T extends Column.Pick.Data>(this: T, compression: string): T;
        collate<T extends Column.Pick.Data>(this: T, collate: string): T;
        modifyQuery<T extends Column.Pick.Data>(this: T, cb: (q: Query) => void): T;
        generated<T extends Column.Pick.Data>(this: T, ...args: import("pqb/internal").StaticSQLArgs): Column.Generated<T>;
        min<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
        max<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
    }, import("zod/v4").ZodDate, Date>;
};
export declare const jsonBuildObjectAllSql: (table: {
    q: QueryData;
    shape: Column.QueryColumns;
}, as: string) => string;
export declare const line: (s: string) => string;
export declare const expectSql: (sql: MaybeArray<Sql>, text: string, values?: unknown[]) => void;
export type AssertEqual<T, Expected> = [T] extends [Expected] ? [Expected] extends [T] ? true : false : false;
export declare const assertType: <T, Expected>(..._: AssertEqual<T, Expected> extends true ? [] : ['invalid type']) => void;
export declare const now: Date;
export declare const asMock: (fn: unknown) => jest.Mock;
export declare const useTestDatabase: (db?: {
    $qb: Query;
} | Query) => void;
