import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Code, ColumnTypeSchemaArg } from 'orchid-core';
import { Operators, OperatorsAny } from './operators';

export class EnumColumn<
  Schema extends ColumnTypeSchemaArg,
  SchemaType extends Schema['type'],
  U extends string = string,
  T extends [U, ...U[]] = [U],
> extends ColumnType<Schema, T[number], SchemaType, OperatorsAny> {
  operators = Operators.any;
  dataType = 'enum';

  constructor(
    schema: Schema,
    public enumName: string,
    public options: T,
    schemaType: SchemaType,
  ) {
    super(schema, schemaType);
    this.inputSchema = this.outputSchema = this.querySchema = schemaType;
  }

  toCode(t: string, migration?: boolean): Code {
    const options = migration
      ? ''
      : `, [${this.options.map((option) => `'${option}'`).join(', ')}]`;
    return columnCode(this, t, `enum('${this.enumName}'${options})`);
  }

  toSQL() {
    const name = this.enumName;
    const index = name.indexOf('.');
    return `"${
      index === -1 ? name : `${name.slice(0, index)}"."${name.slice(index + 1)}`
    }"`;
  }
}
