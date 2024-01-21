import { VirtualColumn } from './virtual';
import { ColumnSchemaConfig } from 'orchid-core';
import { RawSQL } from '../sql/rawSql';
import { defaultSchemaConfig } from './defaultSchemaConfig';

// unknown column is used for the case of raw SQL when user doesn't specify a column
export class UnknownColumn<
  Schema extends ColumnSchemaConfig,
> extends VirtualColumn<Schema> {
  constructor(schema: Schema) {
    super(schema, schema.unknown);
  }
}

RawSQL.prototype._type = new UnknownColumn(defaultSchemaConfig);
