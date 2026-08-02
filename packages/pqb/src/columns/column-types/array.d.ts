import { Column } from '../column';
import { Code, ColumnToCodeCtx } from '../code';
import { OperatorsArray } from '../operators';
import { ArrayMethodsData } from '../column-data-types';
import { ColumnSchemaConfig, ColumnTypeSchemaArg } from '../column-schema';
export interface ArrayColumnValue {
    __type: unknown;
    inputSchema: any;
    __inputType: unknown;
    __outputType: unknown;
    outputSchema: any;
    __queryType: any;
    querySchema: any;
    toSQL(): string;
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    data: Column.Data;
}
export interface ArrayData<Item extends ArrayColumnValue> extends Column.Data, ArrayMethodsData {
    item: Item;
    arrayDims: number;
}
export declare class ArrayColumn<Schema extends ColumnTypeSchemaArg, Item extends ArrayColumnValue, InputType, OutputType, QueryType> extends Column {
    __schema: Schema;
    dataType: 'array';
    operators: OperatorsArray<Item['__queryType']>;
    data: ArrayData<Item>;
    __type: Item['__type'][];
    __inputType: Item['__type'][];
    inputSchema: InputType;
    __outputType: Item['__outputType'][];
    outputSchema: OutputType;
    __queryType: Item['__queryType'][];
    querySchema: QueryType;
    constructor(schema: Schema, item: Item, __inputType: InputType, defaultEncode?: (input: unknown) => unknown, __outputType?: OutputType, __queryType?: QueryType);
    toSQL(): string;
    toCode(this: ArrayColumn<ColumnSchemaConfig, ArrayColumnValue, unknown, unknown, unknown>, ctx: ColumnToCodeCtx, key: string): Code;
}
