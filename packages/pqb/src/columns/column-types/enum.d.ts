import { Column } from '../column';
import { ColumnToCodeCtx } from '../code';
import { Code } from '../code';
import { ColumnTypeSchemaArg } from '../column-schema';
export declare class EnumColumn<Schema extends ColumnTypeSchemaArg, SchemaType extends Schema['__schemaType'], const T extends readonly string[]> extends Column {
    enumName: string;
    options: T;
    __schema: Schema;
    operators: import("../operators").OperatorsOrdinalText;
    __type: T[number];
    __inputType: T[number];
    inputSchema: SchemaType;
    __outputType: T[number];
    outputSchema: SchemaType;
    __queryType: T[number];
    querySchema: SchemaType;
    dataType: string;
    constructor(schema: Schema, enumName: string, options: T, schemaType: SchemaType);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    toSQL(): string;
}
