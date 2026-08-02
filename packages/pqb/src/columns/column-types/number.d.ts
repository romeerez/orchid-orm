import { Column } from '../column';
import { Code, ColumnToCodeCtx } from '../code';
import { TableData } from '../../tableData';
import { BaseNumberData } from '../column-data-types';
import { ColumnSchemaConfig } from '../column-schema';
export interface NumberColumnData extends BaseNumberData, Column.Data {
    identity?: TableData.Identity;
}
export interface SerialColumnData extends NumberColumnData {
    default: true;
}
export declare abstract class NumberBaseColumn<Schema extends ColumnSchemaConfig, SchemaType extends Schema['__schemaType']> extends Column {
    __schema: Schema;
    __type: number;
    __inputType: number;
    inputSchema: SchemaType;
    data: NumberColumnData;
    __outputType: number;
    outputSchema: SchemaType;
    __queryType: number;
    querySchema: SchemaType;
    operators: import("../operators").OperatorsNumber;
}
export declare abstract class IntegerBaseColumn<Schema extends ColumnSchemaConfig> extends NumberBaseColumn<Schema, ReturnType<Schema['int']>> {
    data: NumberColumnData;
    querySchema: ReturnType<Schema['int']>;
    constructor(schema: Schema);
}
export declare abstract class NumberAsStringBaseColumn<Schema extends ColumnSchemaConfig, InputType = string | number> extends Column {
    __schema: Schema;
    __type: string;
    __inputType: InputType;
    inputSchema: ReturnType<Schema['stringSchema']>;
    operators: import("../operators").OperatorsNumber;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: InputType;
    querySchema: ReturnType<Schema['stringSchema']>;
    data: Column.Data;
    constructor(schema: Schema);
}
export interface DecimalColumnData extends Column.Data {
    numericPrecision?: number;
    numericScale?: number;
}
export declare class DecimalColumn<Schema extends ColumnSchemaConfig> extends NumberAsStringBaseColumn<Schema> {
    data: DecimalColumnData;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: import("../operators").OperatorsNumber;
    dataType: 'numeric';
    constructor(schema: Schema, numericPrecision?: number, numericScale?: number);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    toSQL(): string;
}
export declare class SmallIntColumn<Schema extends ColumnSchemaConfig> extends IntegerBaseColumn<Schema> {
    dataType: 'int2';
    querySchema: ReturnType<Schema['int']>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    identity<T extends Column.Pick.Data>(this: T, options?: TableData.Identity): Column.HasDefault<T>;
}
export declare class IntegerColumn<Schema extends ColumnSchemaConfig> extends IntegerBaseColumn<Schema> {
    dataType: 'int4';
    querySchema: ReturnType<Schema['int']>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    identity<T extends Column.Pick.Data>(this: T, options?: TableData.Identity): Column.HasDefault<T>;
}
export declare class BigIntColumn<Schema extends ColumnSchemaConfig> extends NumberAsStringBaseColumn<Schema, string | number | bigint> {
    dataType: 'int8';
    querySchema: ReturnType<Schema['stringSchema']>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    identity<T extends Column.Pick.Data>(this: T, options?: TableData.Identity): Column.HasDefault<T>;
}
export declare class RealColumn<Schema extends ColumnSchemaConfig> extends NumberBaseColumn<Schema, ReturnType<Schema['number']>> {
    dataType: 'float4';
    querySchema: ReturnType<Schema['number']>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class DoublePrecisionColumn<Schema extends ColumnSchemaConfig> extends NumberAsStringBaseColumn<Schema> {
    dataType: 'float8';
    querySchema: ReturnType<Schema['stringSchema']>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class SmallSerialColumn<Schema extends ColumnSchemaConfig> extends IntegerBaseColumn<Schema> {
    dataType: 'int2';
    data: SerialColumnData;
    querySchema: ReturnType<Schema['int']>;
    constructor(schema: Schema);
    toSQL(): string;
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class SerialColumn<Schema extends ColumnSchemaConfig> extends IntegerBaseColumn<Schema> {
    dataType: 'int4';
    data: SerialColumnData;
    querySchema: ReturnType<Schema['int']>;
    constructor(schema: Schema);
    toSQL(): string;
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class BigSerialColumn<Schema extends ColumnSchemaConfig> extends NumberAsStringBaseColumn<Schema> {
    dataType: 'int8';
    data: SerialColumnData;
    querySchema: ReturnType<Schema['stringSchema']>;
    constructor(schema: Schema);
    toSQL(): string;
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
