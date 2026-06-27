import { Column } from '../column';
import { columnCode, ColumnToCodeCtx } from '../code';
import { Code } from '../code';
import { Operators } from '../operators';
import { ColumnTypeSchemaArg } from '../column-schema';

export class EnumColumn<
  Schema extends ColumnTypeSchemaArg,
  SchemaType extends Schema['__schemaType'],
  const T extends readonly string[],
> extends Column {
  declare __schema: Schema;
  operators = Operators.ordinalText;
  declare __type: T[number];
  declare __inputType: T[number];
  declare inputSchema: SchemaType;
  declare __outputType: T[number];
  declare outputSchema: SchemaType;
  declare __queryType: T[number];
  declare querySchema: SchemaType;
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

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const options = ctx.migration
      ? ''
      : `, [${this.options.map((option) => `'${option}'`).join(', ')}]`;
    return columnCode(this, ctx, key, `enum('${this.enumName}'${options})`);
  }

  toSQL() {
    const name = this.enumName;
    const index = name.indexOf('.');
    return `"${
      index === -1 ? name : `${name.slice(0, index)}"."${name.slice(index + 1)}`
    }"`;
  }
}
