import { Column } from '../column';
import { ColumnToCodeCtx } from '../code';
import { Code } from '../code';
import { DefaultSchemaConfig } from '../default-schema-config';
import { ColumnTypeSchemaArg } from '../column-schema';
export declare const encodeJson: (x: unknown) => string | null;
export declare class JSONColumn<T, Schema extends ColumnTypeSchemaArg, InputSchema = Schema['__schemaType']> extends Column {
    __schema: Schema;
    dataType: 'jsonb';
    __type: T;
    __inputType: T;
    inputSchema: InputSchema;
    __outputType: T;
    outputSchema: InputSchema;
    __queryType: T;
    querySchema: InputSchema;
    operators: import("../operators").OperatorsJson;
    constructor(schema: Schema, __inputType: InputSchema, encodedByDriver?: boolean);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class JSONTextColumn<T, Schema extends ColumnTypeSchemaArg, InputSchema = Schema['__schemaType']> extends Column {
    __schema: Schema;
    dataType: 'json';
    __type: T;
    __inputType: T;
    inputSchema: InputSchema;
    __outputType: T;
    outputSchema: InputSchema;
    __queryType: T;
    querySchema: InputSchema;
    operators: import("../operators").OperatorsText;
    private static _instance;
    static get instance(): JSONTextColumn<unknown, DefaultSchemaConfig, unknown>;
    constructor(schema: Schema, __inputType: InputSchema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
