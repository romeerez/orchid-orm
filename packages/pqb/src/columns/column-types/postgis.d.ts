import { Code, ColumnToCodeCtx } from '../code';
import { Column } from '../column';
import { ColumnSchemaConfig } from '../column-schema';
export interface PostgisPoint {
    lon: number;
    lat: number;
    srid?: number;
}
declare const encode: ({ srid, lon, lat }: PostgisPoint) => string;
export declare class PostgisGeographyPointColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: string;
    __type: PostgisPoint;
    __inputType: PostgisPoint;
    inputSchema: ReturnType<Schema['geographyPointSchema']>;
    __outputType: PostgisPoint;
    outputSchema: ReturnType<Schema['geographyPointSchema']>;
    __queryType: PostgisPoint;
    querySchema: ReturnType<Schema['geographyPointSchema']>;
    operators: import("../operators").OperatorsAny;
    static encode: typeof encode;
    static isDefaultPoint(typmod: number): boolean;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare const postgisTypmodToSql: (typmod: number) => string;
export {};
