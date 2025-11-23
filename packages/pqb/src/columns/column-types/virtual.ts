import { Column } from '../column';
import {
  CreateCtx,
  CreateSelf,
  UpdateCtx,
  UpdateSelf,
} from '../../queryMethods';
import { Operators, OperatorsAny } from '../operators';
import { RecordUnknown } from '../../core';
import { ColumnSchemaConfig } from '../column-schema';

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
  ): void;

  update?(q: UpdateSelf, ctx: UpdateCtx, set: RecordUnknown): void;
}
