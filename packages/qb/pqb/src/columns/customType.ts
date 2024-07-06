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
import { Operators } from './operators';

// for a user-defined type, or for unsupported yet type from some module
export class CustomTypeColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  unknown,
  ReturnType<Schema['unknown']>,
  typeof Operators.any
> {
  operators = Operators.any;

  constructor(schema: Schema, public dataType: string) {
    super(
      schema,
      schema.unknown() as never,
      schema.unknown() as never,
      schema.unknown() as never,
    );
    this.data.isOfCustomType = true;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `type(${singleQuote(this.dataType)})`);
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
