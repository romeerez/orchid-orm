import { Column } from '../column';
import { columnCode, ColumnToCodeCtx } from '../code';
import { Code } from '../code';
import { Operators, OperatorsBoolean } from '../operators';
import {
  defaultSchemaConfig,
  DefaultSchemaConfig,
} from '../default-schema-config';
import { ColumnSchemaConfig } from '../column-schema';

// 1 byte, true or false
export class BooleanColumn<Schema extends ColumnSchemaConfig> extends Column<
  Schema,
  boolean,
  ReturnType<Schema['boolean']>,
  OperatorsBoolean
> {
  dataType = 'bool' as const;
  operators = Operators.boolean;

  private static _instance: BooleanColumn<DefaultSchemaConfig> | undefined;
  static get instance() {
    return (this._instance ??= new BooleanColumn(defaultSchemaConfig));
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
