import { DateColumn, TimestampColumn, TimestampTZColumn } from './column-types/date-time';
import { EnumColumn } from './column-types/enum';
import { ArrayColumn, ArrayColumnValue } from './column-types/array';
import { JSONColumn, JSONTextColumn } from './column-types/json';
import { BigIntColumn, BigSerialColumn, DecimalColumn, DoublePrecisionColumn, IntegerColumn, RealColumn, SerialColumn, SmallIntColumn, SmallSerialColumn } from './column-types/number';
import { CitextColumn, MoneyColumn, StringColumn, TextColumn, VarCharColumn } from './column-types/string';
import { Column } from './column';
import { ColumnSchemaConfig } from './column-schema';
import { MaybeArray } from '../utils';
import { AdapterSchemaConfigOptions } from '../adapters/adapter';
export interface DefaultSchemaConfig extends ColumnSchemaConfig<Column> {
    nullable<T extends Column.Pick.ForNullable>(this: T): Column.Nullable<T>;
    parse<T extends Column.Pick.ForParse, Output>(this: T, fn: (input: T['__type']) => Output): Column.Parse<T, unknown, Output>;
    parseNull<T extends Column.Pick.ForParseNull, Output>(this: T, fn: () => Output): Column.ParseNull<T, unknown, Output>;
    encode<T extends Column.Pick.Type, Input>(this: T, fn: (input: Input) => unknown): Column.Encode<T, unknown, Input>;
    /**
     * @deprecated use narrowType instead
     */
    asType<T, Types extends {
        type: unknown;
        __inputType: unknown;
        __outputType: unknown;
        __queryType: unknown;
    }>(this: T, _fn: (type: <Type, Input = Type, Output = Type, Query = Type>() => {
        type: Type;
        __inputType: Input;
        __outputType: Output;
        __queryType: Query;
    }) => Types): {
        [K in keyof T]: K extends '__type' ? Types['type'] : K extends keyof Types ? Types[K] : T[K];
    };
    narrowType<T extends Column.InputOutputQueryTypes, Types extends Column.InputOutputQueryTypes>(this: T, _fn: (type: <Type extends T['__inputType'] extends T['__outputType'] & T['__queryType'] ? T['__outputType'] & T['__queryType'] : T['__inputType'] & T['__outputType'] & T['__queryType']>() => {
        __inputType: T['__inputType'] extends never ? never : Type;
        __outputType: Type;
        __queryType: Type;
    }) => Types): {
        [K in keyof T]: K extends keyof Types ? Types[K] : T[K];
    };
    narrowAllTypes<T extends Column.InputOutputQueryTypes, Types extends Column.InputOutputQueryTypes>(this: T, _fn: (type: <Types extends {
        input?: T['__inputType'];
        output?: T['__outputType'];
        query?: T['__queryType'];
    }>() => {
        __inputType: undefined extends Types['input'] ? T['__inputType'] : Types['input'];
        __outputType: undefined extends Types['output'] ? T['__outputType'] : Types['output'];
        __queryType: undefined extends Types['query'] ? T['__queryType'] : Types['query'];
    }) => Types): {
        [K in keyof T]: K extends keyof Types ? Types[K] : T[K];
    };
    dateAsNumber<T extends Column.Pick.ForParse>(this: T): Column.Parse<T, unknown, number>;
    dateAsDate<T extends Column.Pick.ForParse>(this: T): Column.Parse<T, unknown, Date>;
    enum<const T extends readonly [string, ...string[]]>(dataType: string, type: T): EnumColumn<DefaultSchemaConfig, unknown, T>;
    array<Item extends ArrayColumnValue>(item: Item): ArrayColumn<DefaultSchemaConfig, Item, unknown, unknown, unknown>;
    json<T>(): JSONColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, DefaultSchemaConfig>;
    jsonText<T>(): JSONTextColumn<unknown extends T ? MaybeArray<string | number | boolean | object> : T, DefaultSchemaConfig>;
    inputSchema(): undefined;
    outputSchema(): undefined;
    querySchema(): undefined;
    updateSchema(): undefined;
    pkeySchema(): undefined;
    smallint(): SmallIntColumn<DefaultSchemaConfig>;
    integer(): IntegerColumn<DefaultSchemaConfig>;
    real(): RealColumn<DefaultSchemaConfig>;
    smallSerial(): SmallSerialColumn<DefaultSchemaConfig>;
    serial(): SerialColumn<DefaultSchemaConfig>;
    bigint(): BigIntColumn<DefaultSchemaConfig>;
    decimal(precision?: number, scale?: number): DecimalColumn<DefaultSchemaConfig>;
    doublePrecision(): DoublePrecisionColumn<DefaultSchemaConfig>;
    bigSerial(): BigSerialColumn<DefaultSchemaConfig>;
    money(): MoneyColumn<DefaultSchemaConfig>;
    varchar(limit?: number): VarCharColumn<DefaultSchemaConfig>;
    text(): TextColumn<DefaultSchemaConfig>;
    string(limit?: number): StringColumn<DefaultSchemaConfig>;
    citext(): CitextColumn<DefaultSchemaConfig>;
    date(): DateColumn<DefaultSchemaConfig>;
    timestampNoTZ(precision?: number): TimestampColumn<DefaultSchemaConfig>;
    timestamp(precision?: number): TimestampTZColumn<DefaultSchemaConfig>;
}
export declare const defaultSchemaConfig: (options?: AdapterSchemaConfigOptions) => DefaultSchemaConfig;
export declare const internalSchemaConfig: DefaultSchemaConfig;
