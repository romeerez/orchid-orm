import { Column } from '../column';
import { ColumnSchemaConfig } from '../column-schema';
import { RecordUnknown } from '../../utils';
import { CreateCtx, CreateSelf } from '../../query/basic-features/mutate/create';
import { UpdateSelf } from '../../query/basic-features/mutate/update';
export declare abstract class VirtualColumn<Schema extends ColumnSchemaConfig, InputSchema extends Schema['__schemaType'] = ReturnType<Schema['never']>> extends Column {
    __schema: Schema;
    dataType: string;
    __type: unknown;
    __inputType: unknown;
    inputSchema: InputSchema;
    __outputType: unknown;
    outputSchema: InputSchema;
    __queryType: unknown;
    querySchema: ReturnType<Schema['never']>;
    operators: import("../operators").OperatorsAny;
    constructor(schema: Schema, inputSchema?: InputSchema);
    toCode(): never;
    create?(q: CreateSelf, ctx: CreateCtx, items: unknown[], rowIndex: number[], count: number): void;
    update?(q: UpdateSelf, set: RecordUnknown): void;
}
