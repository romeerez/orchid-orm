import { ColumnType } from './columnType';
import { CreateCtx, CreateSelf, UpdateCtx, UpdateSelf } from '../queryMethods';
import { Operators, OperatorsAny } from './operators';
import { ColumnSchemaConfig, RecordUnknown } from 'orchid-core';

export abstract class VirtualColumn<
  Schema extends ColumnSchemaConfig,
  InputSchema extends Schema['type'] = ReturnType<Schema['never']>,
> extends ColumnType<Schema, unknown, InputSchema, OperatorsAny> {
  dataType = '';
  operators = Operators.any;

  constructor(
    schema: Schema,
    inputSchema: InputSchema = schema.never() as InputSchema,
  ) {
    super(schema, inputSchema);
    // to omit it from selection when selecting *
    this.data.explicitSelect = true;
    this.data.insertable = this.data.updatable = false;
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
