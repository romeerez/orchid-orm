import { Column } from '../column';
import { Operators, OperatorsAny } from '../operators';
import { ColumnSchemaConfig } from '../column-schema';
import { RecordUnknown } from '../../utils';
import {
  CreateCtx,
  CreateSelf,
} from '../../query/basic-features/mutate/create';
import { UpdateSelf } from '../../query/basic-features/mutate/update';

export abstract class VirtualColumn<
  Schema extends ColumnSchemaConfig,
  InputSchema extends Schema['type'] = ReturnType<Schema['never']>,
> extends Column<Schema, unknown, InputSchema, OperatorsAny> {
  dataType = '';
  operators = Operators.any;

  constructor(
    schema: Schema,
    inputSchema: InputSchema = schema.never() as InputSchema,
  ) {
    super(schema, inputSchema);
    // to omit it from selection when selecting *
    this.data.explicitSelect = this.data.appReadOnly = this.data.virtual = true;
  }

  toCode(): never {
    throw new Error(`toCode is not implemented for virtual column`);
  }

  create?(
    q: CreateSelf,
    ctx: CreateCtx,
    item: RecordUnknown,
    rowIndex: number,
    one?: boolean,
  ): void;

  update?(q: UpdateSelf, set: RecordUnknown): void;
}
