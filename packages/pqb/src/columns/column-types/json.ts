import { Column } from '../column';
import { columnCode, ColumnToCodeCtx } from '../code';
import { Operators } from '../operators';
import { Code } from '../code';
import {
  DefaultSchemaConfig,
  internalSchemaConfig,
} from '../default-schema-config';
import { ColumnSchemaConfig, ColumnTypeSchemaArg } from '../column-schema';

export const encodeJson = (x: unknown) => (x === null ? x : JSON.stringify(x));

// Type of JSON column (jsonb).
export class JSONColumn<
  T,
  Schema extends ColumnTypeSchemaArg,
  InputSchema = Schema['__schemaType'],
> extends Column {
  declare __schema: Schema;
  dataType = 'jsonb' as const;
  declare __type: T;
  declare __inputType: T;
  declare inputSchema: InputSchema;
  declare __outputType: T;
  declare outputSchema: InputSchema;
  declare __queryType: T;
  declare querySchema: InputSchema;
  operators = Operators.json;

  constructor(
    schema: Schema,
    __inputType: Schema['__schemaType'],
    encodedByDriver = true,
  ) {
    super(schema, __inputType as InputSchema);
    if (!encodedByDriver) {
      this.data.encode = encodeJson;
    }
    this.data.parseItem = JSON.parse;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `json()`);
  }
}

// JSON non-binary type, stored as a text in the database, so it doesn't have rich functionality.
export class JSONTextColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'json' as const;
  declare __type: unknown;
  declare __inputType: unknown;
  declare inputSchema: ReturnType<Schema['unknown']>;
  declare __outputType: unknown;
  declare outputSchema: ReturnType<Schema['unknown']>;
  declare __queryType: unknown;
  declare querySchema: ReturnType<Schema['unknown']>;
  operators = Operators.text;

  private static _instance: JSONTextColumn<DefaultSchemaConfig> | undefined;
  static get instance() {
    return (this._instance ??= new JSONTextColumn(internalSchemaConfig));
  }

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `jsonText()`);
  }
}
