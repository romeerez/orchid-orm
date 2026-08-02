import { Column } from '../column';
import { Code, ColumnToCodeCtx } from '../code';
import { ColumnSchemaConfig } from '../column-schema';
export declare class CustomTypeColumn<Schema extends ColumnSchemaConfig> extends Column {
    typeName: string;
    typeSchema?: string | undefined;
    __schema: Schema;
    operators: import("../operators").OperatorsAny;
    __type: unknown;
    __inputType: unknown;
    inputSchema: ReturnType<Schema['unknown']>;
    __outputType: unknown;
    outputSchema: ReturnType<Schema['unknown']>;
    __queryType: unknown;
    querySchema: ReturnType<Schema['unknown']>;
    data: Column.Data;
    dataType: string;
    constructor(schema: Schema, typeName: string, typeSchema?: string | undefined, extension?: string);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    as<T extends {
        __inputType: unknown;
        __outputType: unknown;
        data: Column.Data;
    }, C extends {
        __inputType: T['__inputType'];
        __outputType: T['__outputType'];
    }>(this: T, column: C): C;
}
export declare class DomainColumn<Schema extends ColumnSchemaConfig> extends CustomTypeColumn<Schema> {
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
