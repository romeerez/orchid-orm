import { singleQuote } from '../../utils';
import { Column, setColumnData } from '../column';
import { Code, columnCode, ColumnToCodeCtx } from '../code';
import { Operators, OperatorsAny } from '../operators';
import { ColumnSchemaConfig } from '../column-schema';

// for a user-defined type, or for unsupported yet type from some module
export class CustomTypeColumn<Schema extends ColumnSchemaConfig> extends Column<
  Schema,
  unknown,
  ReturnType<Schema['unknown']>,
  OperatorsAny
> {
  operators = Operators.any;
  public dataType: string;

  constructor(
    schema: Schema,
    public typeName: string,
    public typeSchema?: string,
    extension?: string,
  ) {
    super(
      schema,
      schema.unknown() as never,
      schema.unknown() as never,
      schema.unknown() as never,
    );
    this.dataType = typeSchema ? typeSchema + '.' + typeName : typeName;
    this.data.isOfCustomType = true;
    this.data.extension = extension;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const {
      dataType,
      data: { typmod },
    } = this;

    return columnCode(
      this,
      ctx,
      key,
      `type(${singleQuote(
        (dataType.startsWith(ctx.currentSchema)
          ? dataType.slice(ctx.currentSchema.length + 1)
          : dataType) +
          (typmod !== undefined && typmod !== -1 && !dataType.includes('(')
            ? `(${typmod})`
            : ''),
      )})`,
    );
  }

  as<
    T extends { inputType: unknown; outputType: unknown; data: Column.Data },
    C extends {
      inputType: T['inputType'];
      outputType: T['outputType'];
    },
  >(this: T, column: C): C {
    const c = column as unknown as Column.Pick.TypeSchemas;
    const extended = setColumnData(
      this,
      'as',
      column as unknown as T['data']['as'],
    ) as unknown as Column.Pick.TypeSchemas;

    extended.inputSchema = c.inputSchema;
    extended.outputSchema = c.outputSchema;
    extended.querySchema = c.querySchema;

    return extended as never;
  }
}

// domain column type: https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/
export class DomainColumn<
  Schema extends ColumnSchemaConfig,
> extends CustomTypeColumn<Schema> {
  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `domain(${singleQuote(this.dataType)})`);
  }
}
