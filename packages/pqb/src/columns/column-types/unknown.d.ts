import { VirtualColumn } from './virtual';
import { ColumnSchemaConfig } from '../column-schema';
export declare class UnknownColumn<Schema extends ColumnSchemaConfig> extends VirtualColumn<Schema> {
    static instance: UnknownColumn<import("../default-schema-config").DefaultSchemaConfig>;
    selectable: boolean;
    constructor(schema: Schema);
}
