import { Column } from '../column';
import { columnCode, ColumnToCodeCtx } from '../code';
import { Code } from '../code';
import { Operators } from '../operators';
import {
  DefaultSchemaConfig,
  internalSchemaConfig,
} from '../default-schema-config';
import { ColumnSchemaConfig } from '../column-schema';

// 1 byte, true or false
export class BooleanColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'bool' as const;
  operators = Operators.boolean;
  declare __type: boolean;
  declare __inputType: boolean;
  declare inputSchema: ReturnType<Schema['boolean']>;
  declare __outputType: boolean;
  declare outputSchema: ReturnType<Schema['boolean']>;
  declare __queryType: boolean;
  declare querySchema: ReturnType<Schema['boolean']>;

  private static _instance: BooleanColumn<DefaultSchemaConfig> | undefined;
  static get instance() {
    return (this._instance ??= new BooleanColumn(internalSchemaConfig));
  }

  private static _instanceSkipValueToArray:
    | BooleanColumn<DefaultSchemaConfig>
    | undefined;
  static get instanceSkipValueToArray() {
    let instance = this._instanceSkipValueToArray;
    if (!instance) {
      instance = this._instanceSkipValueToArray = Object.create(this.instance);
      instance!.data.skipValueToArray = true;
    }
    return instance!;
  }

  constructor(schema: Schema) {
    super(schema, schema.boolean() as never);
    this.data.alias = 'boolean';
    this.data.parseItem = parseItem;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, 'boolean()');
  }
}

const parseItem = (input: string) => input[0] === 't';
