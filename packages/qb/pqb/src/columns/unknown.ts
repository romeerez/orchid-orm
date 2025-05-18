import { VirtualColumn } from './virtual';
import { ColumnSchemaConfig } from 'orchid-core';
import { RawSQL } from '../sql/rawSql';
import { defaultSchemaConfig } from './defaultSchemaConfig';

// unknown column is used for the case of raw SQL when user doesn't specify a column
export class UnknownColumn<
  Schema extends ColumnSchemaConfig,
> extends VirtualColumn<Schema> {
  static instance = new UnknownColumn(defaultSchemaConfig);

  selectable = true;

  constructor(schema: Schema) {
    super(schema, schema.unknown() as never);
    // include this column when selecting *, unlike the parent VirtualColumn
    this.data.explicitSelect = undefined;
  }
}

RawSQL.prototype.result = { value: UnknownColumn.instance };
