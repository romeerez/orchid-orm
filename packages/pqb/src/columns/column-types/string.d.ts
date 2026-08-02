import { Column } from '../column';
import { NumberColumnData } from './number';
import { Code, ColumnToCodeCtx } from '../code';
import { OperatorsOrdinalText, OperatorsText } from '../operators';
import { DefaultSchemaConfig } from '../default-schema-config';
import { StringData } from '../column-data-types';
import { ColumnSchemaConfig } from '../column-schema';
import { StaticSQLArgs } from '../../query/expressions/expression';
import { SearchWeightRecord } from '../../query';
export type TextColumnData = StringData;
export declare abstract class TextBaseColumn<Schema extends ColumnSchemaConfig, Ops = OperatorsText> extends Column {
    __schema: Schema;
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    data: TextColumnData;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: Ops;
    constructor(schema: Schema, schemaType?: ReturnType<Schema['stringSchema']>);
}
export declare abstract class LimitedTextBaseColumn<Schema extends ColumnSchemaConfig> extends TextBaseColumn<Schema, OperatorsOrdinalText> {
    data: TextColumnData & {
        maxChars?: number;
    };
    operators: OperatorsOrdinalText;
    constructor(schema: Schema, limit?: number);
    toSQL(): string;
}
export declare class VarCharColumn<Schema extends ColumnSchemaConfig> extends LimitedTextBaseColumn<Schema> {
    dataType: 'varchar';
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class StringColumn<Schema extends ColumnSchemaConfig> extends VarCharColumn<Schema> {
    constructor(schema: Schema, limit?: number);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class TextColumn<Schema extends ColumnSchemaConfig> extends TextBaseColumn<Schema, OperatorsOrdinalText> {
    dataType: 'text';
    data: TextColumnData & {
        minArg?: number;
        maxArg?: number;
    };
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsOrdinalText;
    private static _instance;
    static get instance(): TextColumn<DefaultSchemaConfig>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class ByteaColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'bytea';
    operators: OperatorsOrdinalText;
    __type: string;
    __inputType: Buffer;
    inputSchema: ReturnType<Schema['buffer']>;
    __outputType: Buffer;
    outputSchema: ReturnType<Schema['buffer']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class PointColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'point';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class LineColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'line';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class LsegColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'lseg';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class BoxColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'box';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class PathColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'path';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class PolygonColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'polygon';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class CircleColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'circle';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class MoneyColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'money';
    __type: string;
    data: NumberColumnData;
    __inputType: string | number;
    inputSchema: ReturnType<Schema['number']>;
    __outputType: number;
    outputSchema: ReturnType<Schema['number']>;
    __queryType: string | number;
    querySchema: ReturnType<Schema['number']>;
    operators: import("../operators").OperatorsNumber;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class CidrColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'cidr';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class InetColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'inet';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsOrdinalText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class MacAddrColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'macaddr';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsOrdinalText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class MacAddr8Column<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'macaddr8';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsOrdinalText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class BitColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'bit';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['bit']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['bit']>;
    __queryType: string;
    querySchema: ReturnType<Schema['bit']>;
    operators: OperatorsOrdinalText;
    data: Column.Data & {
        length: number;
    };
    constructor(schema: Schema, length: number);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    toSQL(): string;
}
export declare class BitVaryingColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'varbit';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['bit']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['bit']>;
    __queryType: string;
    querySchema: ReturnType<Schema['bit']>;
    operators: OperatorsOrdinalText;
    data: Column.Data & {
        length?: number;
    };
    constructor(schema: Schema, length?: number);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    toSQL(): string;
}
type TsVectorGeneratedColumns = string[] | SearchWeightRecord;
export declare class TsVectorColumn<Schema extends ColumnSchemaConfig> extends Column {
    defaultLanguage: string;
    __schema: Schema;
    dataType: 'tsvector';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsOrdinalText;
    constructor(schema: Schema, defaultLanguage?: string);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
    /**
     * For `tsvector` column type, it can also accept language (optional) and columns:
     *
     * ```ts
     * import { change } from '../dbScript';
     *
     * change(async (db) => {
     *   await db.createTable('post', (t) => ({
     *     id: t.id(),
     *     title: t.text(),
     *     body: t.text(),
     *     // join title and body into a single ts_vector
     *     generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
     *     // with language:
     *     spanishTsVector: t
     *       .tsvector()
     *       .generated('spanish', ['title', 'body'])
     *       .searchIndex(),
     *   }));
     * });
     * ```
     *
     * @param args
     */
    generated<T extends Column.Pick.Data>(this: T, ...args: StaticSQLArgs | [language: string, columns: TsVectorGeneratedColumns] | [columns: TsVectorGeneratedColumns]): Column.Generated<T>;
}
export declare class TsQueryColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'tsquery';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsOrdinalText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class UUIDColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'uuid';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['uuid']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['uuid']>;
    __queryType: string;
    querySchema: ReturnType<Schema['uuid']>;
    operators: OperatorsOrdinalText;
    constructor(schema: Schema);
    /**
     * see {@link Column.primaryKey}
     */
    primaryKey<T extends Column.Pick.Data, Name extends string>(this: T, name?: Name): // using & bc otherwise the return type doesn't match `primaryKey` in ColumnType and TS complains
    T & {
        data: {
            primaryKey: Name;
            default: true;
        };
    };
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class XMLColumn<Schema extends ColumnSchemaConfig> extends Column {
    __schema: Schema;
    dataType: 'xml';
    __type: string;
    __inputType: string;
    inputSchema: ReturnType<Schema['stringSchema']>;
    __outputType: string;
    outputSchema: ReturnType<Schema['stringSchema']>;
    __queryType: string;
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsText;
    private static _instance;
    static get instance(): XMLColumn<DefaultSchemaConfig>;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export declare class CitextColumn<Schema extends ColumnSchemaConfig> extends TextBaseColumn<Schema, OperatorsOrdinalText> {
    __schema: Schema;
    dataType: 'citext';
    data: TextColumnData & {
        minArg?: number;
        maxArg?: number;
    };
    querySchema: ReturnType<Schema['stringSchema']>;
    operators: OperatorsOrdinalText;
    constructor(schema: Schema);
    toCode(ctx: ColumnToCodeCtx, key: string): Code;
}
export {};
