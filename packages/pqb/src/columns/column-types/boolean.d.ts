import { Column } from '../column';
import { ColumnToCodeCtx } from '../code';
import { Code } from '../code';
import { DefaultSchemaConfig } from '../default-schema-config';
import { ColumnSchemaConfig } from '../column-schema';
export declare class BooleanColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'bool';
    operators: import("../operators").OperatorsBoolean;
    __type: boolean;
    __inputType: boolean;
    inputSchema: ReturnType<Schema['boolean']>;
    __outputType: boolean;
    outputSchema: ReturnType<Schema['boolean']>;
    __queryType: boolean;
    querySchema: ReturnType<Schema['boolean']>;
    private static _instance;
    static get instance(): BooleanColumn<DefaultSchemaConfig>;
    private static _instanceSkipValueToArray;
    static get instanceSkipValueToArray(): BooleanColumn<DefaultSchemaConfig>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
