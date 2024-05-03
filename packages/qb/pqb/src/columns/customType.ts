import {
  Code,
  ColumnSchemaConfig,
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `type(${singleQuote(this.dataType)})`, m);
  }

  as<
    T extends Pick<ColumnTypeBase, 'inputType' | 'outputType' | 'data'>,
    C extends Omit<ColumnTypeBase, 'inputType' | 'outputType'> &
      Pick<T, 'inputType' | 'outputType'>,
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
  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `domain(${singleQuote(this.dataType)})`, m);
  }
}
