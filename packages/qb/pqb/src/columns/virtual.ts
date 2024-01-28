import { ColumnType } from './columnType';
import { CreateCtx, CreateSelf, UpdateCtx, UpdateSelf } from '../queryMethods';
import { Operators, OperatorsAny } from './operators';
import { ColumnSchemaConfig } from 'orchid-core';

export abstract class VirtualColumn<
  Schema extends ColumnSchemaConfig,
  InputSchema extends Schema['type'] = Schema['never'],
> extends ColumnType<Schema, unknown, InputSchema, OperatorsAny> {
  dataType = '';
  operators = Operators.any;

  constructor(
    schema: Schema,
    inputSchema: InputSchema = schema.never as InputSchema,
  ) {
    super(schema, inputSchema);
  }

  toCode(): never {
    throw new Error(`toCode is not implemented for virtual column`);
  }

  create?(
    q: CreateSelf,
    ctx: CreateCtx,
    item: Record<string, unknown>,
    rowIndex: number,
  ): void;

  update?(q: UpdateSelf, ctx: UpdateCtx, set: Record<string, unknown>): void;
}
