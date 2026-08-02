import { Column } from '../column';
import { Code, ColumnToCodeCtx } from '../code';
import { DateColumnData } from '../column-data-types';
import { ColumnSchemaConfig } from '../column-schema';
import { PostgresInterval } from '../../adapters/driver-adapter-shared';
export type DateColumnInput = string | number | Date;
declare const parseStringOrDateToNumber: (value: unknown) => number;
export declare const getDateAsNumberFn: (column: {
    data: Column.Data;
    dateParsedByDriver?: boolean;
}) => typeof parseStringOrDateToNumber;
declare const parseDateToDate: (value: unknown) => Date;
export declare const getDateAsDateFn: (column: {
    data: Column.Data;
    dateParsedByDriver?: boolean;
}) => typeof parseDateToDate;
export declare abstract class DateBaseColumn<Schema extends ColumnSchemaConfig> extends Column {
    dateParsedByDriver?: boolean | undefined;
    __schema: Schema;
    __type: string;
    __inputType: DateColumnInput;
    inputSchema: ReturnType<Schema['stringNumberDate']>;
    data: DateColumnData;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: DateColumnInput;
    querySchema: ReturnType<Schema['stringNumberDate']>;
    operators: import("../operators").OperatorsDate;
    asNumber: Schema['dateAsNumber'];
    asDate: Schema['dateAsDate'];
    constructor(schema: Schema, dateParsedByDriver?: boolean | undefined);
}
export declare class DateColumn<Schema extends ColumnSchemaConfig> extends DateBaseColumn<Schema> {
    dataType: 'date';
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare abstract class DateTimeBaseClass<Schema extends ColumnSchemaConfig> extends DateBaseColumn<Schema> {
    data: DateColumnData & {
        dateTimePrecision?: number;
    };
    constructor(schema: Schema, dateTimePrecision?: number, dateParsedByDriver?: boolean);
    toSQL(): string;
}
export declare abstract class DateTimeTzBaseClass<Schema extends ColumnSchemaConfig> extends DateTimeBaseClass<Schema> {
    abstract baseDataType: string;
    toSQL(): string;
}
export declare class TimestampColumn<Schema extends ColumnSchemaConfig> extends DateTimeBaseClass<Schema> {
    dataType: 'timestamp';
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class TimestampTZColumn<Schema extends ColumnSchemaConfig> extends DateTimeTzBaseClass<Schema> {
    dataType: 'timestamptz';
    baseDataType: 'timestamp';
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class TimeColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    __type: string;
    __inputType: ReturnType<Schema['stringSchema']>;
    inputSchema: ReturnType<Schema['stringSchema']>;
    data: DateColumnData & {
        dateTimePrecision?: number;
    };
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    dataType: 'time';
    operators: import("../operators").OperatorsTime;
    constructor(schema: Schema, dateTimePrecision?: number);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class IntervalColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    __type: PostgresInterval;
    data: Column.Data & {
        fields?: string;
        precision?: number;
    };
    __inputType: Partial<PostgresInterval>;
    inputSchema: ReturnType<Schema['timeInterval']>;
    __outputType: PostgresInterval;
    outputSchema: ReturnType<Schema['timeInterval']>;
    __queryType: PostgresInterval;
    querySchema: ReturnType<Schema['timeInterval']>;
    dataType: 'interval';
    operators: import("../operators").OperatorsDate;
    constructor(schema: Schema, fields?: string, precision?: number, parse?: (input: string) => PostgresInterval);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    toSQL(): string;
}
export {};
