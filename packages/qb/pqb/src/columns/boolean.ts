import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Code, ColumnSchemaConfig, ColumnToCodeCtx } from 'orchid-core';
import { Operators, OperatorsBoolean } from './operators';
import {
  defaultSchemaConfig,
  DefaultSchemaConfig,
} from './defaultSchemaConfig';

// 1 byte, true or false
export class BooleanColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
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
