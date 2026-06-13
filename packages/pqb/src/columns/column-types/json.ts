import { Column } from '../column';
import { columnCode, ColumnToCodeCtx } from '../code';
import { Operators, OperatorsJson, OperatorsText } from '../operators';
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
  InputSchema = Schema['type'],
> extends Column<Schema, T, InputSchema, OperatorsJson> {
  dataType = 'jsonb' as const;
  operators = Operators.json;

  constructor(
    schema: Schema,
    inputType: Schema['type'],
    encodedByDriver = true,
  ) {
    super(schema, inputType as InputSchema);
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
export class JSONTextColumn<Schema extends ColumnSchemaConfig> extends Column<
  Schema,
  unknown,
  ReturnType<Schema['unknown']>,
  OperatorsText
> {
  dataType = 'json' as const;
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
