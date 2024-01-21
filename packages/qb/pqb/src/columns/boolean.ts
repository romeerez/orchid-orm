import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Code, ColumnSchemaConfig } from 'orchid-core';
import { Operators, OperatorsBoolean } from './operators';

// 1 byte, true or false
export class BooleanColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<Schema, boolean, Schema['boolean'], OperatorsBoolean> {
  dataType = 'boolean' as const;
  operators = Operators.boolean;

  constructor(schema: Schema) {
    super(schema, schema.boolean);
  }

  toCode(t: string): Code {
    return columnCode(this, t, 'boolean()');
  }

  parseItem = (input: string) => input[0] === 't';
}
