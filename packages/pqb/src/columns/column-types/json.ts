import { Column } from '../column';
import { columnCode, ColumnToCodeCtx } from '../code';
import { Operators } from '../operators';
import { Code } from '../code';
import {
  DefaultSchemaConfig,
  internalSchemaConfig,
} from '../default-schema-config';
import { ColumnTypeSchemaArg } from '../column-schema';

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
    __inputType: InputSchema,
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
export class JSONTextColumn<
  T,
  Schema extends ColumnTypeSchemaArg,
  InputSchema = Schema['__schemaType'],
> extends Column {
  declare __schema: Schema;
  dataType = 'json' as const;
  declare __type: T;
  declare __inputType: T;
  declare inputSchema: InputSchema;
  declare __outputType: T;
  declare outputSchema: InputSchema;
  declare __queryType: T;
  declare querySchema: InputSchema;
  operators = Operators.text;

  private static _instance:
    | JSONTextColumn<unknown, DefaultSchemaConfig>
    | undefined;
  static get instance() {
    return (this._instance ??= new JSONTextColumn(
      internalSchemaConfig,
      undefined,
    ));
  }

  constructor(schema: Schema, __inputType: InputSchema) {
    super(schema, __inputType as InputSchema);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `jsonText()`);
  }
}
