import {
  Code,
  ColumnDataBase,
  ColumnSchemaConfig,
  ColumnToCodeCtx,
  ColumnTypeBase,
  setColumnData,
  singleQuote,
} from 'orchid-core';
import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Operators, OperatorsAny } from './operators';

// for a user-defined type, or for unsupported yet type from some module
export class CustomTypeColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
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
    T extends { inputType: unknown; outputType: unknown; data: ColumnDataBase },
    // Omit is optimal
    C extends Omit<ColumnTypeBase, 'inputType' | 'outputType'> & {
      inputType: T['inputType'];
      outputType: T['outputType'];
    },
  >(this: T, column: C): C {
    const c = setColumnData(
      this,
      'as',
      column as unknown as T['data']['as'],
    ) as unknown as C;

    c.inputSchema = column.inputSchema;
    c.outputSchema = column.outputSchema;
    c.querySchema = column.querySchema;

    return c;
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
