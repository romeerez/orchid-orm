import { ColumnType } from './columnType';
import { Query } from '../query/query';
import { CreateCtx, UpdateCtx } from '../queryMethods';
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
    q: Query,
    ctx: CreateCtx,
    item: Record<string, unknown>,
    rowIndex: number,
  ): void;

  update?(q: Query, ctx: UpdateCtx, set: Record<string, unknown>): void;
}
