import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Code, ColumnSchemaConfig } from 'orchid-core';
import { Operators, OperatorsBoolean } from './operators';

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

  constructor(schema: Schema) {
    super(schema, schema.boolean() as never);
    this.data.alias = 'boolean';
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, 'boolean()', m);
  }

  parseItem = (input: string) => input[0] === 't';
}
