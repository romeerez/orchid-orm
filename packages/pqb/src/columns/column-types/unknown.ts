import { VirtualColumn } from './virtual';
import { RawSQL } from '../../query/expressions/raw-sql';
import { defaultSchemaConfig } from '../default-schema-config';
import { ColumnSchemaConfig } from '../column-schema';

// unknown column is used for the case of raw SQL when user doesn't specify a column
export class UnknownColumn<
  Schema extends ColumnSchemaConfig,
> extends VirtualColumn<Schema> {
  static instance = new UnknownColumn(defaultSchemaConfig);

  selectable = true;

  constructor(schema: Schema) {
    super(schema, schema.unknown() as never);
    // include this column when selecting *, unlike the parent VirtualColumn
    this.data.explicitSelect =
      this.data.appReadOnly =
      this.data.virtual =
        undefined;
  }
}

RawSQL.prototype.result = { value: UnknownColumn.instance };
